/**
 * Eval-Synth: Auto-transpile eval functions to synthesizable Verilog.
 *
 * Parses eval functions with acorn, validates the AST against a whitelist
 * of synthesizable JS constructs, and transpiles to Verilog assign/case
 * statements. This allows user-defined primitives with simple combinational
 * eval functions to be automatically exported to Verilog without needing
 * hand-written entries in primitive-map.ts.
 */

import { parse } from 'acorn';
import type { PrimitiveContext } from './primitive-map.js';

// ============================================================================
// Types
// ============================================================================

/** Result of parsing an eval function */
export interface ParsedEval {
  /** The function body AST */
  body: any;
  /** Destructured parameter names from the eval signature */
  paramNames: string[];
}

/** Result of validating a parsed eval AST */
export interface SynthValidation {
  valid: boolean;
  errors: string[];
}

/** Combined parsed + validated AST ready for transpilation */
export interface SynthResult {
  ast: ParsedEval;
  validation: SynthValidation;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse an eval function's source into an acorn AST.
 * Handles arrow functions and regular functions.
 * Returns null if parsing fails.
 */
export function parseEvalSource(fn: Function): ParsedEval | null {
  try {
    const source = fn.toString();

    // Wrap in parentheses to parse as expression (arrow functions need this)
    const program = parse(`(${source})`, {
      ecmaVersion: 2020,
      sourceType: 'module',
    }) as any;

    // Extract the function expression
    const exprStmt = program.body[0];
    if (exprStmt?.type !== 'ExpressionStatement') return null;

    const fnExpr = exprStmt.expression;
    if (fnExpr.type !== 'ArrowFunctionExpression' && fnExpr.type !== 'FunctionExpression') {
      return null;
    }

    // Extract destructured parameter names
    const paramNames = extractParamNames(fnExpr.params);
    if (!paramNames) return null;

    // Get the function body
    let body: any;
    if (fnExpr.body.type === 'BlockStatement') {
      body = fnExpr.body;
    } else {
      // Arrow with expression body: ({ a, b }) => ({ out: a & b })
      // Wrap in a return statement for uniform handling
      body = {
        type: 'BlockStatement',
        body: [{ type: 'ReturnStatement', argument: fnExpr.body }],
      };
    }

    return { body, paramNames };
  } catch {
    return null;
  }
}

/**
 * Extract destructured parameter names from function params.
 * Handles: ({ a, b }) and ({ a, b, carry_in })
 * Also handles renamed destructuring: ({ in: a }) => paramNames includes 'a' mapped from 'in'
 */
function extractParamNames(params: any[]): string[] | null {
  if (params.length !== 1) return null;
  const param = params[0];

  if (param.type !== 'ObjectPattern') return null;

  const names: string[] = [];
  for (const prop of param.properties) {
    if (prop.type !== 'Property') return null;
    // For { in: a }, the value is the local binding name
    const binding = prop.value;
    if (binding.type !== 'Identifier') return null;
    names.push(binding.name);
  }
  return names;
}

/**
 * Build a mapping from local binding name to original port name.
 * Handles destructuring renames like { in: a } → { a: 'in' }
 */
function buildParamMapping(fn: Function): Map<string, string> | null {
  try {
    const source = fn.toString();
    const program = parse(`(${source})`, { ecmaVersion: 2020, sourceType: 'module' }) as any;
    const fnExpr = program.body[0]?.expression;
    if (!fnExpr) return null;

    const param = fnExpr.params[0];
    if (param?.type !== 'ObjectPattern') return null;

    const mapping = new Map<string, string>();
    for (const prop of param.properties) {
      if (prop.type !== 'Property') return null;
      const key = prop.key;
      const value = prop.value;
      if (key.type !== 'Identifier' || value.type !== 'Identifier') return null;
      // key.name is the original port name, value.name is the local binding
      mapping.set(value.name, key.name);
    }
    return mapping;
  } catch {
    return null;
  }
}

// ============================================================================
// Validator
// ============================================================================

/** Operators allowed in synthesizable expressions */
const ALLOWED_BINARY_OPS = new Set([
  '&', '|', '^', '<<', '>>', '>>>',  // bitwise
  '+', '-', '*',                       // arithmetic
  '===', '!==', '<', '>', '<=', '>=', // comparison
  '==', '!=',                          // loose comparison (some compiled JS uses these)
]);

const ALLOWED_LOGICAL_OPS = new Set(['&&', '||', '??']);
const ALLOWED_UNARY_OPS = new Set(['~', '!', '-', '+']);

/** Options for validation */
export interface ValidateOptions {
  /** Names of mem() state fields — allows memory[addr] indexing */
  memStateNames?: string[];
  /** If true, this is an onTick function — allows memory[addr] = value assignment */
  isOnTick?: boolean;
}

/**
 * Validate that an AST is within the synthesizable subset.
 * Returns errors for each non-synthesizable construct found.
 */
export function validateSynthAST(
  parsed: ParsedEval,
  inputNames: string[],
  _outputNames: string[],
  options?: ValidateOptions,
): SynthValidation {
  const errors: string[] = [];
  const declaredConsts = new Set<string>();
  const declaredLetResults = new Set<string>();
  const memNames = new Set(options?.memStateNames ?? []);
  const isOnTick = options?.isOnTick ?? false;
  const allowedIdents = new Set([...parsed.paramNames, ...inputNames]);

  function validateNode(node: any): void {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'BlockStatement':
        for (const stmt of node.body) validateNode(stmt);
        break;

      case 'ReturnStatement':
        validateReturnValue(node.argument);
        break;

      case 'VariableDeclaration': {
        if (node.kind === 'var') {
          errors.push('var declarations are not synthesizable — use const');
          break;
        }
        for (const decl of node.declarations) {
          if (decl.id?.type !== 'Identifier') {
            errors.push('Destructuring in variable declarations is not synthesizable');
            break;
          }
          const name = decl.id.name;
          if (node.kind === 'const') {
            declaredConsts.add(name);
            allowedIdents.add(name);
            if (decl.init) validateExpr(decl.init);
          } else if (node.kind === 'let') {
            // Allow let only for the switch-result pattern
            declaredLetResults.add(name);
            allowedIdents.add(name);
            if (decl.init) validateExpr(decl.init);
          }
        }
        break;
      }

      case 'SwitchStatement':
        validateExpr(node.discriminant);
        for (const c of node.cases) {
          if (c.test) validateExpr(c.test);
          for (const stmt of c.consequent) validateNode(stmt);
        }
        break;

      case 'BreakStatement':
        break; // OK

      case 'EmptyStatement':
        break; // OK — stray semicolons (e.g. after type annotations)

      case 'ExpressionStatement':
        // Allow assignment expressions
        if (node.expression?.type === 'AssignmentExpression') {
          const left = node.expression.left;
          if (left?.type === 'Identifier' && declaredLetResults.has(left.name)) {
            // switch-result pattern: let result; switch { case: result = ...; }
            validateExpr(node.expression.right);
          } else if (isOnTick && left?.type === 'MemberExpression' && left.computed
            && left.object?.type === 'Identifier' && memNames.has(left.object.name)) {
            // onTick memory write: memory[addr] = value
            validateExpr(left.property); // validate index
            validateExpr(node.expression.right);
          } else {
            errors.push(`Assignment to '${left?.name ?? describeMember(left)}' is not synthesizable`);
          }
        } else {
          errors.push(`Expression statement is not synthesizable: ${node.expression?.type}`);
        }
        break;

      case 'IfStatement':
        // Allow if/else chains (map to ternary or case)
        validateExpr(node.test);
        validateNode(node.consequent);
        if (node.alternate) validateNode(node.alternate);
        break;

      default:
        errors.push(`Statement type '${node.type}' is not synthesizable`);
    }
  }

  function validateExpr(node: any): void {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'BinaryExpression':
        if (!ALLOWED_BINARY_OPS.has(node.operator)) {
          errors.push(`Operator '${node.operator}' is not synthesizable`);
        }
        validateExpr(node.left);
        validateExpr(node.right);
        break;

      case 'LogicalExpression':
        if (!ALLOWED_LOGICAL_OPS.has(node.operator)) {
          errors.push(`Logical operator '${node.operator}' is not synthesizable`);
        }
        validateExpr(node.left);
        validateExpr(node.right);
        break;

      case 'UnaryExpression':
        if (!ALLOWED_UNARY_OPS.has(node.operator)) {
          errors.push(`Unary operator '${node.operator}' is not synthesizable`);
        }
        validateExpr(node.argument);
        break;

      case 'ConditionalExpression':
        validateExpr(node.test);
        validateExpr(node.consequent);
        validateExpr(node.alternate);
        break;

      case 'Identifier':
        if (!allowedIdents.has(node.name)) {
          errors.push(`Reference to '${node.name}' is not synthesizable — not an input or declared const`);
        }
        break;

      case 'Literal':
        if (typeof node.value !== 'number' && typeof node.value !== 'boolean') {
          errors.push(`Literal type '${typeof node.value}' is not synthesizable — only numbers and booleans allowed`);
        }
        break;

      case 'ObjectExpression':
        // Allowed in return statement for output shape
        for (const prop of node.properties) {
          if (prop.type !== 'Property') {
            errors.push('Spread properties are not synthesizable');
            continue;
          }
          validateExpr(prop.value);
        }
        break;

      case 'ParenthesizedExpression':
        validateExpr(node.expression);
        break;

      case 'SequenceExpression':
        for (const expr of node.expressions) validateExpr(expr);
        break;

      case 'AssignmentExpression':
        // Only valid inside switch case for let-result pattern
        if (node.left?.type === 'Identifier' && declaredLetResults.has(node.left.name)) {
          validateExpr(node.right);
        } else {
          errors.push('Assignment expressions are not synthesizable outside switch-result pattern');
        }
        break;

      case 'CallExpression':
        errors.push(`Function calls are not synthesizable: ${describeCall(node)}`);
        break;

      case 'MemberExpression':
        // Allow computed indexing on mem state: memory[addr], memory[addr + 1]
        if (node.computed && node.object?.type === 'Identifier' && memNames.has(node.object.name)) {
          validateExpr(node.property); // validate the index expression
        } else {
          errors.push(`Member access is not synthesizable: ${describeMember(node)}`);
        }
        break;

      case 'NewExpression':
        errors.push('new expressions are not synthesizable');
        break;

      case 'AwaitExpression':
        errors.push('await is not synthesizable');
        break;

      case 'YieldExpression':
        errors.push('yield is not synthesizable');
        break;

      case 'TemplateLiteral':
        errors.push('Template literals are not synthesizable');
        break;

      case 'ArrayExpression':
        errors.push('Array expressions are not synthesizable');
        break;

      case 'ThisExpression':
        errors.push('this is not synthesizable');
        break;

      default:
        errors.push(`Expression type '${node.type}' is not synthesizable`);
    }
  }

  function validateReturnValue(node: any): void {
    if (!node) {
      errors.push('Return statement must return an output object');
      return;
    }
    validateExpr(node);
  }

  validateNode(parsed.body);
  return { valid: errors.length === 0, errors };
}

function describeCall(node: any): string {
  if (node.callee?.type === 'Identifier') return node.callee.name + '()';
  if (node.callee?.type === 'MemberExpression') return describeMember(node.callee) + '()';
  return '<call>';
}

function describeMember(node: any): string {
  const obj = node.object?.type === 'Identifier' ? node.object.name : '?';
  const prop = node.property?.type === 'Identifier' ? node.property.name : '?';
  return `${obj}.${prop}`;
}

// ============================================================================
// AST-to-Verilog Transpiler
// ============================================================================

interface TranspileContext {
  /** Mapping from local binding name → Verilog wire name */
  inputWires: Map<string, string>;
  /** Mapping from output port name → Verilog wire name */
  outputWires: Map<string, string>;
  /** Mapping from local binding name → original port name */
  paramMapping: Map<string, string>;
  /** Locally declared const/let names → Verilog wire names */
  localWires: Map<string, string>;
  /** Names of mem() state fields (for memory[addr] transpilation) */
  memStateNames: Set<string>;
  /** Node ID prefix for unique wire names */
  nodeId: string;
  /** Default width for intermediate wires */
  defaultWidth: number;
  /** Whether this is an onTick context (uses <= instead of =) */
  isOnTick: boolean;
  /** Verilog lines to emit */
  lines: string[];
  /** Declarations (wire/reg) to emit */
  declarations: string[];
}

/**
 * Transpile a validated eval AST to Verilog statements.
 *
 * Requires PrimitiveContext for wire name resolution and width info.
 * The eval function is needed to rebuild the param mapping.
 */
export function emitVerilogFromEval(
  parsed: ParsedEval,
  evalFn: Function,
  ctx: PrimitiveContext,
  _inputNames: string[],
  outputNames: string[],
  options?: { memStateNames?: string[]; isOnTick?: boolean },
): { lines: string[]; declarations: string[] } {
  const paramMapping = buildParamMapping(evalFn);
  if (!paramMapping) {
    return { lines: [`// ERROR: could not parse eval parameter mapping for "${ctx.primitiveType}"`], declarations: [] };
  }

  // Build input wire mapping: local binding name → Verilog wire
  const inputWires = new Map<string, string>();
  for (const [localName, portName] of paramMapping) {
    const wire = ctx.wires.inputs.get(portName);
    if (wire) inputWires.set(localName, wire);
  }

  // Build output wire mapping: port name → Verilog wire
  const outputWires = new Map<string, string>();
  for (const name of outputNames) {
    const wire = ctx.wires.outputs.get(name);
    if (wire) outputWires.set(name, wire);
  }

  // Map state keys to reg names so eval/onTick can reference them.
  // Both mem state (array-indexed) and scalar state (reg) get mapped.
  const nodeId = ctx.nodeId.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  for (const stateKey of options?.memStateNames ?? []) {
    inputWires.set(stateKey, `${nodeId}_${stateKey}`);
  }
  // Also check: any param that isn't already mapped (not an input port) is likely a state key
  if (paramMapping) {
    for (const [localName] of paramMapping) {
      if (!inputWires.has(localName)) {
        // Not an input port — must be a scalar state key
        inputWires.set(localName, `${nodeId}_${localName}`);
      }
    }
  }

  // Determine default width from args or largest output
  const argWidth = typeof ctx.args.width === 'number' ? ctx.args.width : 0;
  const defaultWidth = Math.max(argWidth, 1);

  const tc: TranspileContext = {
    inputWires,
    outputWires,
    paramMapping,
    localWires: new Map(),
    memStateNames: new Set(options?.memStateNames ?? []),
    nodeId: ctx.nodeId.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
    defaultWidth,
    isOnTick: options?.isOnTick ?? false,
    lines: [],
    declarations: [],
  };

  emitBlock(tc, parsed.body);

  return { lines: tc.lines, declarations: tc.declarations };
}

function emitBlock(tc: TranspileContext, block: any): void {
  for (const stmt of block.body) {
    emitStatement(tc, stmt);
  }
}

function emitStatement(tc: TranspileContext, node: any): void {
  switch (node.type) {
    case 'BlockStatement':
      emitBlock(tc, node);
      break;

    case 'ReturnStatement':
      emitReturn(tc, node.argument);
      break;

    case 'VariableDeclaration':
      for (const decl of node.declarations) {
        const name = decl.id.name;
        const wireName = `${tc.nodeId}_${name}`;

        if (node.kind === 'const' && decl.init) {
          const w = tc.defaultWidth;
          const widthStr = w > 1 ? `[${w - 1}:0] ` : '';
          tc.declarations.push(`wire ${widthStr}${wireName};`);
          tc.localWires.set(name, wireName);
          tc.lines.push(`assign ${wireName} = ${emitExpr(tc, decl.init)};`);
        } else if (node.kind === 'let') {
          // let-result pattern: will be assigned in switch cases
          const w = tc.defaultWidth;
          const widthStr = w > 1 ? `[${w - 1}:0] ` : '';
          tc.declarations.push(`reg ${widthStr}${wireName};`);
          tc.localWires.set(name, wireName);
        }
      }
      break;

    case 'SwitchStatement':
      emitSwitch(tc, node);
      break;

    case 'ExpressionStatement':
      // Handle memory write: memory[addr] = value
      if (tc.isOnTick && node.expression?.type === 'AssignmentExpression') {
        const left = node.expression.left;
        if (left?.type === 'MemberExpression' && left.computed
          && left.object?.type === 'Identifier' && tc.memStateNames.has(left.object.name)) {
          const memName = `${tc.nodeId}_${left.object.name}`;
          const index = emitExpr(tc, left.property);
          const value = emitExpr(tc, node.expression.right);
          tc.lines.push(`${memName}[${index}] <= ${value};`);
        }
      }
      // Other expression statements handled inside switch emission
      break;

    case 'IfStatement':
      emitIf(tc, node);
      break;
  }
}

function emitReturn(tc: TranspileContext, node: any): void {
  if (!node || node.type !== 'ObjectExpression') return;

  for (const prop of node.properties) {
    if (prop.type !== 'Property') continue;
    const name = prop.key.type === 'Identifier' ? prop.key.name : null;
    if (!name) continue;

    if (tc.isOnTick) {
      // onTick return: state assignments (non-blocking)
      // Skip identity assignments like { memory: memory } (state passthrough)
      if (prop.value.type === 'Identifier' && prop.value.name === name) continue;
      // For mem state, the return value is the whole memory — skip (writes handled by assignment statements)
      if (tc.memStateNames.has(name)) continue;
      // Scalar state: value <= expr
      const regName = `${tc.nodeId}_${name}`;
      const expr = emitExpr(tc, prop.value);
      tc.lines.push(`${regName} <= ${expr};`);
    } else {
      // eval return: output assignments (combinational)
      const wire = tc.outputWires.get(name);
      if (!wire) continue;
      const expr = emitExpr(tc, prop.value);
      tc.lines.push(`assign ${wire} = ${expr};`);
    }
  }
}

function emitSwitch(tc: TranspileContext, node: any): void {
  const disc = emitExpr(tc, node.discriminant);

  // Collect all assignment targets in this switch (let-result variables)
  const assignTargets = new Set<string>();
  for (const c of node.cases) {
    for (const stmt of c.consequent) {
      if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'AssignmentExpression') {
        const name = stmt.expression.left?.name;
        if (name && tc.localWires.has(name)) assignTargets.add(name);
      }
    }
  }

  if (assignTargets.size > 0) {
    // Emit as always @(*) case block for let-result pattern
    tc.lines.push(`always @(*) begin`);
    tc.lines.push(`  case (${disc})`);

    for (const c of node.cases) {
      if (c.test) {
        const testVal = emitExpr(tc, c.test);
        tc.lines.push(`    ${testVal}: begin`);
      } else {
        tc.lines.push(`    default: begin`);
      }

      for (const stmt of c.consequent) {
        if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'AssignmentExpression') {
          const target = tc.localWires.get(stmt.expression.left.name);
          const value = emitExpr(tc, stmt.expression.right);
          if (target) tc.lines.push(`      ${target} = ${value};`);
        }
        // Skip BreakStatement
      }

      tc.lines.push(`    end`);
    }

    // Add default if not present
    const hasDefault = node.cases.some((c: any) => !c.test);
    if (!hasDefault) {
      tc.lines.push(`    default: begin`);
      for (const name of assignTargets) {
        const wire = tc.localWires.get(name);
        if (wire) tc.lines.push(`      ${wire} = 0;`);
      }
      tc.lines.push(`    end`);
    }

    tc.lines.push(`  endcase`);
    tc.lines.push(`end`);
  }
}

function emitIf(tc: TranspileContext, node: any): void {
  const assignTargets = new Set<string>();
  const hasMemWrite = collectAssignTargets(node, assignTargets, tc);

  if (assignTargets.size > 0 || hasMemWrite) {
    if (!tc.isOnTick) {
      // Combinational always block for let-result pattern
      tc.lines.push(`always @(*) begin`);
    }
    // In onTick context, the if is emitted inside the already-open always @(posedge) block
    emitIfInner(tc, node);
    if (!tc.isOnTick) {
      tc.lines.push(`end`);
    }
  }
}

function emitIfInner(tc: TranspileContext, node: any): void {
  const cond = emitExpr(tc, node.test);
  tc.lines.push(`  if (${cond}) begin`);
  emitIfBody(tc, node.consequent);
  if (node.alternate) {
    if (node.alternate.type === 'IfStatement') {
      tc.lines.push(`  end else`);
      emitIfInner(tc, node.alternate);
    } else {
      tc.lines.push(`  end else begin`);
      emitIfBody(tc, node.alternate);
      tc.lines.push(`  end`);
    }
  } else {
    tc.lines.push(`  end`);
  }
}

function emitIfBody(tc: TranspileContext, node: any): void {
  const stmts = node.type === 'BlockStatement' ? node.body : [node];
  for (const stmt of stmts) {
    if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'AssignmentExpression') {
      const left = stmt.expression.left;
      if (left?.type === 'Identifier' && tc.localWires.has(left.name)) {
        // let-result assignment
        const target = tc.localWires.get(left.name);
        const value = emitExpr(tc, stmt.expression.right);
        if (target) tc.lines.push(`    ${target} = ${value};`);
      } else if (left?.type === 'MemberExpression' && left.computed
        && left.object?.type === 'Identifier' && tc.memStateNames.has(left.object.name)) {
        // memory write: memory[addr] = value → memory[addr] <= value
        const memName = `${tc.nodeId}_${left.object.name}`;
        const index = emitExpr(tc, left.property);
        const value = emitExpr(tc, stmt.expression.right);
        tc.lines.push(`    ${memName}[${index}] <= ${value};`);
      }
    } else if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
      for (const prop of stmt.argument.properties) {
        if (prop.type !== 'Property') continue;
        const outputName = prop.key.type === 'Identifier' ? prop.key.name : null;
        if (!outputName) continue;
        const wire = tc.outputWires.get(outputName);
        if (wire) tc.lines.push(`    ${wire} = ${emitExpr(tc, prop.value)};`);
      }
    }
  }
}

/** Returns true if any memory write is found */
function collectAssignTargets(node: any, targets: Set<string>, tc: TranspileContext): boolean {
  if (!node) return false;
  let hasMemWrite = false;
  if (node.type === 'ExpressionStatement' && node.expression?.type === 'AssignmentExpression') {
    const left = node.expression.left;
    if (left?.type === 'Identifier' && tc.localWires.has(left.name)) {
      targets.add(left.name);
    } else if (left?.type === 'MemberExpression' && left.computed
      && left.object?.type === 'Identifier' && tc.memStateNames.has(left.object.name)) {
      hasMemWrite = true;
    }
  }
  if (node.type === 'BlockStatement') {
    for (const s of node.body) {
      if (collectAssignTargets(s, targets, tc)) hasMemWrite = true;
    }
  }
  if (node.type === 'IfStatement') {
    if (collectAssignTargets(node.consequent, targets, tc)) hasMemWrite = true;
    if (collectAssignTargets(node.alternate, targets, tc)) hasMemWrite = true;
  }
  return hasMemWrite;
}

// ============================================================================
// Expression Emitter
// ============================================================================

const JS_TO_VERILOG_OP: Record<string, string> = {
  '===': '==',
  '!==': '!=',
  '>>>': '>>',  // Verilog >> on unsigned is logical shift
  '&&': '&',    // for 1-bit logical AND → bitwise
  '||': '|',    // for 1-bit logical OR → bitwise
};

function emitExpr(tc: TranspileContext, node: any): string {
  if (!node) return '0';

  switch (node.type) {
    case 'BinaryExpression': {
      // Special case: (x >>> 0) is unsigned coercion in JS — no-op in Verilog
      if (node.operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        return emitExpr(tc, node.left);
      }
      // Special case: (x | 0) is signed coercion in JS → $signed() in Verilog
      if (node.operator === '|' && node.right.type === 'Literal' && node.right.value === 0) {
        return `$signed(${emitExpr(tc, node.left)})`;
      }
      const op = JS_TO_VERILOG_OP[node.operator] ?? node.operator;
      return `(${emitExpr(tc, node.left)} ${op} ${emitExpr(tc, node.right)})`;
    }

    case 'LogicalExpression': {
      // ?? (nullish coalescing) — hardware signals are never null/undefined,
      // so (x ?? default) is always x. Emit just the left operand.
      if (node.operator === '??') {
        return emitExpr(tc, node.left);
      }
      const op = JS_TO_VERILOG_OP[node.operator] ?? node.operator;
      return `(${emitExpr(tc, node.left)} ${op} ${emitExpr(tc, node.right)})`;
    }

    case 'UnaryExpression': {
      if (node.operator === '!') {
        return `(~${emitExpr(tc, node.argument)})`;
      }
      return `(${node.operator}${emitExpr(tc, node.argument)})`;
    }

    case 'ConditionalExpression': {
      const test = emitExpr(tc, node.test);
      const cons = emitExpr(tc, node.consequent);
      const alt = emitExpr(tc, node.alternate);
      return `(${test} ? ${cons} : ${alt})`;
    }

    case 'Identifier': {
      // Check local wires first (const/let declarations)
      if (tc.localWires.has(node.name)) return tc.localWires.get(node.name)!;
      // Then input wires
      if (tc.inputWires.has(node.name)) return tc.inputWires.get(node.name)!;
      return node.name;
    }

    case 'Literal': {
      if (typeof node.value === 'boolean') return node.value ? '1' : '0';
      if (typeof node.value === 'number') return formatNumericLiteral(node.value, node.raw);
      return String(node.value);
    }

    case 'MemberExpression': {
      // memory[addr] → mem_name[addr_expr]
      if (node.computed && node.object?.type === 'Identifier' && tc.memStateNames.has(node.object.name)) {
        const memName = `${tc.nodeId}_${node.object.name}`;
        const index = emitExpr(tc, node.property);
        return `${memName}[${index}]`;
      }
      return `/* unsupported member: ${node.object?.name}.${node.property?.name} */`;
    }

    case 'AssignmentExpression': {
      // Inside switch case: just the RHS
      return emitExpr(tc, node.right);
    }

    case 'ParenthesizedExpression':
      return emitExpr(tc, node.expression);

    default:
      return `/* unsupported: ${node.type} */`;
  }
}

/**
 * Format a numeric literal for Verilog.
 * Preserves hex literals as Verilog hex.
 */
function formatNumericLiteral(value: number, raw?: string): string {
  if (raw && /^0x/i.test(raw)) {
    // Convert JS hex to Verilog hex
    const hexVal = (value >>> 0).toString(16).toUpperCase();
    return `'h${hexVal}`;
  }
  return String(value);
}

// ============================================================================
// Public API — integration with export pipeline
// ============================================================================

/**
 * Try to emit Verilog for a primitive by transpiling its eval function.
 * Returns null if the eval is not parseable or not synthesizable.
 *
 * This is the main integration point — called from primitive-map.ts as a
 * fallback when no hand-written Verilog mapping exists.
 */
export function tryEmitFromEval(
  ctx: PrimitiveContext,
  getEval: (name: string) => { evalFn: Function; inputNames: string[]; outputNames: string[]; stateKeys?: string[]; onTickFn?: Function } | undefined,
): { lines: string[]; declarations: string[] } | null {
  const entry = getEval(ctx.primitiveType);
  if (!entry) return null;

  // For now, memStateNames are state keys that use array indexing (mem() state).
  // We detect them by checking if the eval function body uses computed member access on them.
  // Scalar state keys (reg) are NOT mem state — they're just identifiers.
  const memStateNames: string[] = [];
  const scalarStateKeys: string[] = [];
  if (entry.stateKeys) {
    for (const key of entry.stateKeys) {
      // Heuristic: if the eval source contains `key[` it's array-indexed (mem state)
      const src = entry.evalFn.toString();
      if (src.includes(`${key}[`)) {
        memStateNames.push(key);
      } else {
        scalarStateKeys.push(key);
      }
    }
  }
  // Try transpiling eval
  const parsed = parseEvalSource(entry.evalFn);
  if (!parsed) return null;

  const validation = validateSynthAST(parsed, entry.inputNames, entry.outputNames, { memStateNames });
  if (!validation.valid) return null;

  const evalResult = emitVerilogFromEval(parsed, entry.evalFn, ctx, entry.inputNames, entry.outputNames, { memStateNames });

  // Emit reg declarations + initial-zero blocks for scalar state keys.
  // The user's declared initializer (`state: { foo: 42 }`) is not yet
  // threaded through this path — see #131. For now, default to literal 0
  // for both the `initial` block and the reset arm below. This is a strict
  // improvement over the prior behavior (state regs came up as X on
  // hardware); circuits with a non-zero declared initializer reset to 0
  // here until #131 lands.
  const scalarRegNames: string[] = [];
  if (entry.stateKeys && entry.stateKeys.length > 0) {
    const nodeId = ctx.nodeId.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const w = typeof ctx.args.width === 'number' ? ctx.args.width : 8;
    for (const key of entry.stateKeys) {
      if (memStateNames.includes(key)) continue; // memory-kind state handled elsewhere
      const widthStr = w > 1 ? `[${w - 1}:0] ` : '';
      const regName = `${nodeId}_${key}`;
      scalarRegNames.push(regName);
      evalResult.declarations.push(`reg ${widthStr}${regName};`);
      const initLiteral = w > 1 ? `${w}'d0` : `1'b0`;
      evalResult.lines.push(`initial ${regName} = ${initLiteral};`);
    }
  }

  // If there's an onTick, try transpiling it too
  if (entry.onTickFn) {
    const onTickParsed = parseEvalSource(entry.onTickFn);
    if (!onTickParsed) return null;

    const onTickValidation = validateSynthAST(onTickParsed, entry.inputNames, entry.outputNames, {
      memStateNames,
      isOnTick: true,
    });
    if (!onTickValidation.valid) return null;

    const onTickResult = emitVerilogFromEval(onTickParsed, entry.onTickFn, ctx, entry.inputNames, entry.outputNames, {
      memStateNames,
      isOnTick: true,
    });

    // Wrap onTick output in always @(posedge clk) with a synchronous reset
    // arm that zeros every scalar state reg. See #131 — the user's declared
    // `state: { foo: 42 }` initializer is not yet threaded through, so the
    // reset arm uses literal 0 (matching the `initial` block above) rather
    // than the user's declared value.
    const onTickLines = onTickResult.lines.filter(l => l.trim().length > 0);
    if (onTickLines.length > 0) {
      evalResult.lines.push(`always @(posedge ${ctx.clockName}) begin`);
      if (scalarRegNames.length > 0) {
        const w = typeof ctx.args.width === 'number' ? ctx.args.width : 8;
        const resetLiteral = w > 1 ? `${w}'d0` : `1'b0`;
        evalResult.lines.push(`  if (!${ctx.resetName}) begin`);
        for (const regName of scalarRegNames) {
          evalResult.lines.push(`    ${regName} <= ${resetLiteral};`);
        }
        evalResult.lines.push(`  end else begin`);
        evalResult.lines.push(...onTickLines.map(l => `    ${l}`));
        evalResult.lines.push(`  end`);
      } else {
        evalResult.lines.push(...onTickLines.map(l => `  ${l}`));
      }
      evalResult.lines.push(`end`);
    }
    evalResult.declarations.push(...onTickResult.declarations);
  }

  return evalResult;
}

/**
 * Check whether a component's eval is synthesizable.
 * Useful for tooling/UI to show synthesis status.
 */
export function checkSynthesizable(
  evalFn: Function,
  inputNames: string[],
  outputNames: string[],
): SynthValidation {
  const parsed = parseEvalSource(evalFn);
  if (!parsed) return { valid: false, errors: ['Could not parse eval function source'] };
  return validateSynthAST(parsed, inputNames, outputNames);
}

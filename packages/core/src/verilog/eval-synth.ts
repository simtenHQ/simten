/**
 * Eval-synth: Verilog for a primitive with no hand-written mapping, translated
 * from its own `eval` and `onTick`.
 *
 * The functions are parsed with acorn and run symbolically: every expression
 * becomes an exact `Value` (see eval-values.ts), every `const`/`let` binding a
 * wire, and control flow (if/else, switch, early returns) becomes choices
 * between values, so the result is plain continuous assignments plus one
 * clocked block for `onTick`'s state. Checking and emitting are the same pass,
 * so the two can't disagree: whatever can't be translated exactly throws
 * `Unsupported` with the reason, and the exporter reports the primitive as
 * unsupported instead of emitting Verilog that differs from the simulator.
 *
 * What the simulator does, and so what the translation follows:
 * - `eval` gets the node's arguments, then its inputs (an unconnected input
 *   reads 0), then its state. `onTick` the same, except an unconnected input
 *   is left out, so it falls back to an argument of that name or is undefined.
 * - An output is stored masked to its port width. State is stored as returned,
 *   unmasked, so a next-state value must provably fit the state's width.
 * - `onTick` returns the next state. With one scalar state field, leaving it
 *   out keeps the old value; with several, every field must be returned.
 * - Memory writes in `onTick` take effect after the tick, like `<=`.
 */

import {
  type AssignmentExpression,
  type AssignmentProperty,
  type Expression,
  type Function as FunctionNode,
  type Literal,
  type MemberExpression,
  type ObjectExpression,
  type Pattern,
  parse,
  type RestElement,
  type Statement,
  type SwitchCase,
  type SwitchStatement,
} from 'acorn';
import type { Behavior, BehaviorFn } from '../circuit/behavior.js';
import type { ArgumentValue, MemoryValue, StateBlock } from '../ir/circuit-ir.js';
import { memoryContentsToMap } from '../ir/memory-contents.js';
import { type PrimitiveContext, sanitizeId } from './emitters/helpers.js';
import {
  and,
  binary,
  choose,
  fitsUnsigned,
  isSimple,
  type Kind,
  literal,
  Nets,
  not,
  or,
  port,
  Unsupported,
  unary,
  unsupported,
  type Value,
} from './eval-values.js';

/** Result of checking whether behavior can be translated. */
export interface SynthValidation {
  valid: boolean;
  errors: string[];
}

/** Verilog for one primitive. `clocked` when it needs the module's clock and reset. */
interface Synthesized {
  lines: string[];
  declarations: string[];
  clocked: boolean;
}

// ============================================================================
// Parsing
// ============================================================================

/** One destructured parameter: `{ in: a = 0 }` is key `in`, local `a`, fallback `0`. */
interface Param {
  key: string;
  local: string;
  fallback?: Expression;
}

interface ParsedFn {
  params: Param[];
  /** A block body, or an arrow function's expression body. */
  body: Statement[] | Expression;
}

function parseExpression(source: string): Expression | undefined {
  try {
    const statement = parse(source, { ecmaVersion: 'latest' }).body[0];
    return statement?.type === 'ExpressionStatement' ? statement.expression : undefined;
  } catch {
    return undefined;
  }
}

function parseFn(fn: BehaviorFn): ParsedFn {
  const source = fn.toString();
  // A method (`eval({ a }) { ... }`) prints without `function`.
  const node = parseExpression(`(${source})`) ?? parseExpression(`(function ${source})`);
  if (node?.type !== 'ArrowFunctionExpression' && node?.type !== 'FunctionExpression') {
    return unsupported('its source could not be parsed as a function');
  }
  return {
    params: paramsOf(node),
    body: node.body.type === 'BlockStatement' ? node.body.body : node.body,
  };
}

function paramsOf(fn: FunctionNode): Param[] {
  if (fn.params.length === 0) return [];
  const [pattern] = fn.params;
  if (fn.params.length > 1 || pattern.type !== 'ObjectPattern') {
    return unsupported('it takes something other than one destructured object');
  }
  return pattern.properties.map(paramOf);
}

function paramOf(prop: AssignmentProperty | RestElement): Param {
  if (prop.type === 'RestElement') return unsupported('it collects the rest of its inputs (...)');
  const key = keyName(prop.key, prop.computed);
  if (key === undefined) return unsupported('it destructures a computed key');
  return { key, ...bindingOf(prop.value) };
}

function bindingOf(value: Pattern): { local: string; fallback?: Expression } {
  if (value.type === 'Identifier') return { local: value.name };
  if (value.type === 'AssignmentPattern' && value.left.type === 'Identifier') {
    return { local: value.left.name, fallback: value.right };
  }
  return unsupported('it destructures a parameter in a nested pattern');
}

function keyName(key: Expression | { type: 'PrivateIdentifier' }, computed: boolean) {
  if (computed) return undefined;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return undefined;
}

// ============================================================================
// State
// ============================================================================

interface Memory {
  name: string;
  reg: string;
  depth: number;
  width: number;
  contents: Map<number, number>;
}

interface Scalar {
  reg: string;
  width: number;
  init: bigint;
}

interface StateShape {
  scalars: Map<string, Scalar>;
  memories: Map<string, Memory>;
}

function initialOf(key: string, value: unknown, width: number): bigint {
  const v = typeof value === 'boolean' ? Number(value) : (value ?? 0);
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= 2 ** width) {
    return unsupported(
      `state '${key}' starts at ${String(value)}, not a ${width}-bit unsigned value`,
    );
  }
  return BigInt(v);
}

function memoryOf(key: string, block: StateBlock, prefix: string, args: PrimitiveContext['args']) {
  if (block.stateType.kind !== 'memory') throw new Error('not a memory');
  const contents = new Map<number, number>();
  const declared = (block.initialValue as MemoryValue | undefined)?.data;
  if (declared) for (const [a, v] of memoryContentsToMap(declared)) contents.set(a, v);
  const own = args[key];
  if (own && typeof own === 'object')
    for (const [a, v] of memoryContentsToMap(own)) contents.set(a, v);
  return {
    name: key,
    reg: `${prefix}_${key}`,
    depth: 2 ** block.stateType.addressWidth,
    width: block.stateType.dataWidth,
    contents,
  };
}

function stateShape(ctx: PrimitiveContext, keys: string[], prefix: string): StateShape {
  const shape: StateShape = { scalars: new Map(), memories: new Map() };
  for (const key of keys) {
    const block = ctx.state?.find((b) => b.name === key);
    if (!block) return unsupported(`its state '${key}' has no declared type`);
    if (block.stateType.kind === 'memory') {
      shape.memories.set(key, memoryOf(key, block, prefix, ctx.args));
      continue;
    }
    const width = block.stateType.kind === 'bus' ? block.stateType.width : 1;
    const init = initialOf(key, ctx.args[key] ?? block.initialValue, width);
    shape.scalars.set(key, { reg: `${prefix}_${key}`, width, init });
  }
  return shape;
}

// ============================================================================
// Symbolic execution
// ============================================================================

type Binding =
  | { kind: 'value'; value: Value | null; mutable: boolean }
  | { kind: 'memory'; memory: Memory };
type Env = Map<string, Binding>;

/** Whether the function has returned (`flag`), and what, where it has. */
interface Returned {
  flag: Value | true;
  values: Map<string, Value>;
}

interface State {
  env: Env;
  ret: Returned | null;
}

interface MemoryWrite {
  guard: string | null;
  memory: Memory;
  addr: Value;
  value: Value;
}

/** How the translator sees one function: an `eval`, or an `onTick`. */
interface Role {
  name: 'eval' | 'onTick';
  /** The keys a return is read for: outputs, or state fields. */
  keys: ReadonlySet<string>;
  /** onTick with one scalar state field: its value when a return leaves it out. */
  hold?: { key: string; value: Value };
}

const bool = (code: string): Value => ({
  code,
  width: 1,
  signed: false,
  lo: 0n,
  hi: 1n,
  kind: 'bool',
});

/** `v` as a one-bit truth value. */
function truth(v: Value): Value {
  return v.width === 1 && !v.signed ? v : bool(`(${v.code} != 0)`);
}

function negate(code: string): string {
  return isSimple(code) ? `!${code}` : `!(${code})`;
}

function andGuard(guard: string | null, code: string): string {
  return guard ? `(${guard} && ${code})` : code;
}

function flagValue(flag: Value | true): Value {
  return flag === true ? literal(1n, 'bool') : flag;
}

function sameKeys(a: Map<string, Value>, b: Map<string, Value>): void {
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    if (!a.has(key) || !b.has(key)) {
      unsupported(`it returns '${key}' on some paths but not on others`);
    }
  }
}

function describe(node: Expression): string {
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    if (callee.type === 'Identifier') return `calls ${callee.name}()`;
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
      const prop = keyName(callee.property, callee.computed) ?? '…';
      return `calls ${callee.object.name}.${prop}()`;
    }
    return 'calls a function';
  }
  return `uses ${node.type}`;
}

/** The index in `memory[index]`. */
function indexOf(node: MemberExpression): Expression {
  if (node.property.type === 'PrivateIdentifier') return unsupported('it uses a private field');
  return node.property;
}

class Translator {
  readonly writes: MemoryWrite[] = [];
  private readonly written = new Set<Memory>();

  constructor(
    private readonly nets: Nets,
    private readonly role: Role,
  ) {}

  // ── Expressions ──────────────────────────────────────────────────────

  expr(node: Expression, env: Env): Value {
    switch (node.type) {
      case 'Literal':
        return this.literal(node);
      case 'Identifier':
        return this.lookup(node.name, env);
      case 'BinaryExpression':
        if (node.left.type === 'PrivateIdentifier') return unsupported('it uses a private field');
        return binary(
          node.operator,
          this.expr(node.left, env),
          this.expr(node.right, env),
          this.nets,
        );
      case 'LogicalExpression': {
        const left = this.expr(node.left, env);
        // A port, state or argument is never null or undefined.
        if (node.operator === '??') return left;
        const right = this.expr(node.right, env);
        return node.operator === '&&' ? and(left, right) : or(left, right);
      }
      case 'UnaryExpression':
        return unary(node.operator, this.expr(node.argument, env), this.nets);
      case 'ConditionalExpression':
        return choose(
          this.expr(node.test, env),
          this.expr(node.consequent, env),
          this.expr(node.alternate, env),
        );
      case 'MemberExpression':
        return this.memoryRead(node, env);
      default:
        return unsupported(`it ${describe(node)}`);
    }
  }

  private literal(node: Literal): Value {
    if (typeof node.value === 'boolean') return literal(node.value ? 1n : 0n, 'bool');
    if (typeof node.value === 'number' && Number.isInteger(node.value)) {
      return literal(BigInt(node.value));
    }
    return unsupported(`it uses the literal ${node.raw ?? String(node.value)}`);
  }

  private lookup(name: string, env: Env): Value {
    const binding = env.get(name);
    if (!binding) return unsupported(`it reads '${name}', which it never defines`);
    if (binding.kind === 'memory') {
      return unsupported(`it uses memory '${name}' other than by indexing it`);
    }
    if (!binding.value) return unsupported(`it reads '${name}' where it may not be assigned`);
    return binding.value;
  }

  private memoryOf(node: MemberExpression, env: Env): Memory {
    const name = node.object.type === 'Identifier' ? node.object.name : undefined;
    const binding = name === undefined ? undefined : env.get(name);
    if (!node.computed || binding?.kind !== 'memory') {
      const prop = keyName(node.property, node.computed) ?? '[…]';
      return unsupported(`it reads ${name ?? '…'}.${prop}, which isn't a memory word`);
    }
    return binding.memory;
  }

  private memoryRead(node: MemberExpression, env: Env): Value {
    const memory = this.memoryOf(node, env);
    if (this.written.has(memory)) {
      return unsupported(`it reads memory '${memory.name}' after writing it in the same onTick`);
    }
    const addr = this.expr(indexOf(node), env);
    if (addr.lo < 0n) return unsupported(`it reads memory '${memory.name}' at a negative address`);
    const word = port(`${memory.reg}[${addr.code}]`, memory.width);
    if (addr.hi < BigInt(memory.depth)) return word;
    // Past the end reads 0 in the simulator, x in Verilog.
    return port(
      `((${addr.code} < ${memory.depth}) ? ${word.code} : ${memory.width}'d0)`,
      memory.width,
    );
  }

  // ── Statements ───────────────────────────────────────────────────────

  block(stmts: Statement[], st: State, guard: string | null): State {
    const declared = new Set<string>();
    for (const s of stmts) {
      if (s.type === 'VariableDeclaration') {
        for (const d of s.declarations) if (d.id.type === 'Identifier') declared.add(d.id.name);
      }
    }
    let cur: State = { env: new Map(st.env), ret: st.ret };
    for (const s of stmts) {
      if (cur.ret?.flag === true) break;
      const g = cur.ret ? andGuard(guard, negate(cur.ret.flag.code)) : guard;
      cur = this.statement(s, cur, g);
    }
    // Names declared here go out of scope; assignments to outer ones carry out.
    const env: Env = new Map(st.env);
    for (const key of st.env.keys()) {
      const inner = cur.env.get(key);
      if (!declared.has(key) && inner) env.set(key, inner);
    }
    return { env, ret: cur.ret };
  }

  private statement(s: Statement, st: State, guard: string | null): State {
    switch (s.type) {
      case 'BlockStatement':
        return this.block(s.body, st, guard);
      case 'EmptyStatement':
        return st;
      case 'VariableDeclaration':
        if (s.kind !== 'const' && s.kind !== 'let') return unsupported(`it declares a ${s.kind}`);
        for (const d of s.declarations) {
          if (d.id.type !== 'Identifier') return unsupported('it destructures a declaration');
          const value = d.init ? this.nets.bind(this.expr(d.init, st.env), d.id.name) : null;
          st.env.set(d.id.name, { kind: 'value', value, mutable: s.kind === 'let' });
        }
        return st;
      case 'ExpressionStatement':
        if (s.expression.type !== 'AssignmentExpression') {
          return unsupported(`it has a statement that ${describe(s.expression)}`);
        }
        this.assign(s.expression, st.env, guard);
        return st;
      case 'IfStatement': {
        const c = this.expr(s.test, st.env);
        const alternate = s.alternate;
        return this.branch(
          c,
          (b, g) => this.block([s.consequent], b, g),
          alternate ? (b, g) => this.block([alternate], b, g) : undefined,
          st,
          guard,
        );
      }
      case 'SwitchStatement':
        return this.switchStatement(s, st, guard);
      case 'ReturnStatement': {
        if (s.argument?.type !== 'ObjectExpression') {
          return unsupported('it returns something other than an object literal');
        }
        const values = this.returned(s.argument, st.env);
        return { env: st.env, ret: this.sequence(st.ret, { flag: true, values }) };
      }
      default:
        return unsupported(`it uses a ${s.type}`);
    }
  }

  private assign(node: AssignmentExpression, env: Env, guard: string | null): void {
    if (node.left.type === 'MemberExpression') {
      this.memoryWrite(node, node.left, env, guard);
      return;
    }
    if (node.left.type !== 'Identifier') unsupported('it assigns to a pattern');
    const name = node.left.name;
    const binding = env.get(name);
    if (binding?.kind !== 'value' || !binding.mutable) {
      unsupported(`it assigns to '${name}', which isn't a let it declared`);
    }
    let value = this.expr(node.right, env);
    if (node.operator !== '=') {
      const op = node.operator.slice(0, -1);
      value = binary(op, this.lookup(name, env), value, this.nets);
    }
    env.set(name, { kind: 'value', value: this.nets.bind(value, name), mutable: true });
  }

  private memoryWrite(
    node: AssignmentExpression,
    target: MemberExpression,
    env: Env,
    guard: string | null,
  ): void {
    const memory = this.memoryOf(target, env);
    if (this.role.name !== 'onTick') unsupported(`its eval writes memory '${memory.name}'`);
    if (node.operator !== '=') unsupported(`it updates memory '${memory.name}' in place`);
    const addr = this.nets.bind(this.expr(indexOf(target), env), `${memory.name}_addr`);
    const value = this.nets.bind(this.expr(node.right, env), `${memory.name}_data`);
    if (addr.lo < 0n || addr.hi >= BigInt(memory.depth)) {
      unsupported(
        `it writes memory '${memory.name}' at an address that can be outside 0..${memory.depth - 1}`,
      );
    }
    if (!fitsUnsigned(value, memory.width)) {
      unsupported(
        `it writes memory '${memory.name}' a value that can be outside its ${memory.width}-bit words`,
      );
    }
    this.writes.push({ guard, memory, addr, value });
    this.written.add(memory);
  }

  private branch(
    c: Value,
    then: (st: State, guard: string | null) => State,
    otherwise: ((st: State, guard: string | null) => State) | undefined,
    st: State,
    guard: string | null,
  ): State {
    const t = truth(c);
    const base: State = { env: st.env, ret: null };
    const a = then(base, andGuard(guard, t.code));
    const b = otherwise ? otherwise(base, andGuard(guard, negate(t.code))) : base;
    const env: Env = new Map(st.env);
    for (const [key, outer] of st.env) {
      env.set(key, this.mergeBinding(t, key, outer, a.env.get(key), b.env.get(key)));
    }
    return { env, ret: this.sequence(st.ret, this.choice(t, a.ret, b.ret)) };
  }

  private mergeBinding(
    c: Value,
    key: string,
    outer: Binding,
    a: Binding | undefined,
    b: Binding | undefined,
  ): Binding {
    if (outer.kind !== 'value' || a?.kind !== 'value' || b?.kind !== 'value') return outer;
    if (a.value === b.value) return a;
    if (!a.value || !b.value) return { ...outer, value: null };
    return { ...outer, value: this.nets.bind(choose(c, a.value, b.value), key) };
  }

  /** What `if (c)` returns, from what each side returns. */
  private choice(c: Value, a: Returned | null, b: Returned | null): Returned | null {
    if (!a && !b) return null;
    if (a && b) {
      sameKeys(a.values, b.values);
      const values = new Map<string, Value>();
      for (const [key, v] of a.values)
        values.set(key, this.bindRet(choose(c, v, b.values.get(key) as Value), key));
      const flag =
        a.flag === true && b.flag === true
          ? true
          : this.bindRet(choose(c, flagValue(a.flag), flagValue(b.flag)), 'returned');
      return { flag, values };
    }
    const one = (a ?? b) as Returned;
    const side = a ? c : not(c);
    const flag = one.flag === true ? side : this.bindRet(and(side, one.flag), 'returned');
    return { flag, values: one.values };
  }

  /** `next` runs only where `prev` hasn't returned. */
  private sequence(prev: Returned | null, next: Returned | null): Returned | null {
    if (!prev) return next;
    if (!next || prev.flag === true) return prev;
    sameKeys(prev.values, next.values);
    const flag = prev.flag;
    const values = new Map<string, Value>();
    for (const [key, v] of prev.values)
      values.set(key, this.bindRet(choose(flag, v, next.values.get(key) as Value), key));
    return {
      flag: next.flag === true ? true : this.bindRet(or(flag, next.flag), 'returned'),
      values,
    };
  }

  private bindRet(v: Value, key: string): Value {
    return this.nets.bind(v, `${key}_ret`);
  }

  private returned(node: ObjectExpression, env: Env): Map<string, Value> {
    const values = new Map<string, Value>();
    for (const prop of node.properties) {
      if (prop.type !== 'Property' || prop.kind !== 'init' || prop.method) {
        return unsupported('it returns an object with a spread, getter or method');
      }
      const key = keyName(prop.key, prop.computed);
      if (key === undefined) return unsupported('it returns an object with a computed key');
      if (!this.role.keys.has(key)) continue;
      const binding = env.get(key);
      if (binding?.kind === 'memory' && this.role.name === 'onTick') {
        const v = prop.value;
        if (v.type !== 'Identifier' || env.get(v.name) !== binding) {
          return unsupported(`its onTick returns something other than memory '${key}' for it`);
        }
        values.set(key, port('0', 1));
        continue;
      }
      values.set(key, this.expr(prop.value as Expression, env));
    }
    const hold = this.role.hold;
    if (hold && !values.has(hold.key)) values.set(hold.key, hold.value);
    return values;
  }

  // ── switch ───────────────────────────────────────────────────────────

  private switchStatement(s: SwitchStatement, st: State, guard: string | null): State {
    const d = this.nets.bind(this.expr(s.discriminant, st.env), 'case');
    const groups = caseGroups(s.cases);
    const run = (i: number, cur: State, g: string | null): State => {
      if (i === groups.length) return cur;
      const group = groups[i];
      if (group.tests.length === 0) return this.block(group.body, cur, g);
      let c: Value | null = null;
      for (const t of group.tests) {
        const eq = binary('===', d, this.expr(t, cur.env), this.nets);
        c = c ? or(c, eq) : eq;
      }
      return this.branch(
        c as Value,
        (b, bg) => this.block(group.body, b, bg),
        (b, bg) => run(i + 1, b, bg),
        cur,
        g,
      );
    };
    return run(0, st, guard);
  }
}

interface CaseGroup {
  /** Empty for `default`. */
  tests: Expression[];
  body: Statement[];
}

/**
 * A switch as a chain of tests, `default` last. Labels with no statements
 * share the next body; a body has to end in `break` or `return` (or be the
 * last), since falling into the next case doesn't translate.
 */
function caseGroups(cases: SwitchCase[]): CaseGroup[] {
  const groups: CaseGroup[] = [];
  let fallback: CaseGroup | undefined;
  let tests: Expression[] = [];
  let isDefault = false;
  cases.forEach((c, i) => {
    if (c.test) tests.push(c.test);
    else isDefault = true;
    if (c.consequent.length === 0 && i < cases.length - 1) return;
    const body = [...c.consequent];
    const last = body[body.length - 1];
    if (last?.type === 'BreakStatement' && !last.label) body.pop();
    else if (last?.type !== 'ReturnStatement' && i < cases.length - 1) {
      unsupported('a switch case falls through into the next one');
    }
    if (isDefault) fallback = { tests: [], body };
    else groups.push({ tests, body });
    tests = [];
    isDefault = false;
  });
  return fallback ? [...groups, fallback] : groups;
}

// ============================================================================
// Translating a behavior
// ============================================================================

function argument(key: string, value: ArgumentValue): Value {
  if (typeof value === 'boolean') return literal(value ? 1n : 0n, 'bool');
  if (typeof value === 'number' && Number.isInteger(value)) return literal(BigInt(value));
  return unsupported(`it reads argument '${key}', which isn't an integer`);
}

/** What a parameter of `role` reads, before falling back to its default. */
function resolve(
  key: string,
  ctx: PrimitiveContext,
  behavior: Behavior,
  state: (key: string) => Binding | undefined,
  role: Role['name'],
): Binding | undefined {
  const fromState = state(key);
  if (fromState) return fromState;
  if (behavior.inputNames.includes(key)) {
    const wire = ctx.wires.inputs.get(key);
    if (wire)
      return { kind: 'value', value: port(wire, ctx.ports?.inputs.get(key) ?? 32), mutable: false };
    if (role === 'eval') return { kind: 'value', value: literal(0n), mutable: false };
  }
  const arg = ctx.args[key];
  if (arg !== undefined) return { kind: 'value', value: argument(key, arg), mutable: false };
  return undefined;
}

/** Run one function: the values its returns give each key. */
function run(
  fn: BehaviorFn,
  role: Role,
  nets: Nets,
  lookup: (key: string) => Binding | undefined,
): { values: Map<string, Value>; writes: MemoryWrite[] } {
  const parsed = parseFn(fn);
  const t = new Translator(nets, role);
  const env: Env = new Map();
  for (const p of parsed.params) {
    const binding =
      lookup(p.key) ??
      (p.fallback && { kind: 'value', value: t.expr(p.fallback, env), mutable: false });
    if (!binding) {
      return unsupported(
        `it reads '${p.key}', which is not an input, state or argument of this node`,
      );
    }
    env.set(p.local, binding);
  }
  const body: Statement[] = Array.isArray(parsed.body)
    ? parsed.body
    : [{ type: 'ReturnStatement', argument: parsed.body, start: 0, end: 0 }];
  const st = t.block(body, { env, ret: null }, null);
  if (st.ret?.flag !== true) return unsupported('it does not return on every path');
  return { values: st.ret.values, writes: t.writes };
}

interface Translation {
  outputs: Map<string, Value>;
  next: Map<string, Value>;
  writes: MemoryWrite[];
  nets: Nets;
}

/**
 * Translate `behavior` once, reading each scalar state field as `kinds` says
 * and as a constant where `constant` says onTick never changes it.
 */
function translate(
  ctx: PrimitiveContext,
  behavior: Behavior,
  shape: StateShape,
  kinds: Map<string, Kind>,
  constant: Set<string>,
): Translation {
  const nets = new Nets(sanitizeId(ctx.nodeId));
  const state = (key: string): Binding | undefined => {
    const memory = shape.memories.get(key);
    if (memory) return { kind: 'memory', memory };
    const scalar = shape.scalars.get(key);
    if (!scalar) return undefined;
    const value =
      constant.has(key) || !behavior.onTickFn
        ? literal(scalar.init)
        : { ...port(scalar.reg, scalar.width), kind: kinds.get(key) ?? 'num' };
    return { kind: 'value', value, mutable: false };
  };
  let next = new Map<string, Value>();
  let writes: MemoryWrite[] = [];
  if (behavior.onTickFn) {
    const keys = new Set(behavior.stateKeys ?? []);
    const only = keys.size === 1 ? [...keys][0] : undefined;
    const held = only !== undefined && shape.scalars.has(only) ? state(only) : undefined;
    const role: Role = {
      name: 'onTick',
      keys,
      hold:
        held?.kind === 'value' && held.value
          ? { key: only as string, value: held.value }
          : undefined,
    };
    const lookup = (key: string) => resolve(key, ctx, behavior, state, 'onTick');
    ({ values: next, writes } = within('onTick', () =>
      run(behavior.onTickFn as BehaviorFn, role, nets, lookup),
    ));
    for (const key of keys) {
      if (!next.has(key)) unsupported(`its onTick does not return state '${key}'`);
    }
  }
  const role: Role = { name: 'eval', keys: new Set(behavior.outputNames) };
  const lookup = (key: string) => resolve(key, ctx, behavior, state, 'eval');
  const { values: outputs } = within('eval', () => run(behavior.evalFn, role, nets, lookup));
  return { outputs, next, writes, nets };
}

/** Run `fn`, saying which function a reason it fails for is about. */
function within<T>(where: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Unsupported && !e.message.startsWith(where)) {
      throw new Unsupported(`${where}: ${e.message}`);
    }
    throw e;
  }
}

/**
 * Translate until the state fields' kinds and which ones never change are
 * settled: both are learned from onTick, and both change how onTick and eval
 * read the fields.
 */
function settle(
  ctx: PrimitiveContext,
  behavior: Behavior,
  shape: StateShape,
): { t: Translation; constant: Set<string> } {
  const kinds = new Map<string, Kind>();
  const constant = new Set<string>();
  // Both only grow (a field joins `constant`, a kind turns 'mixed'), so this ends.
  for (;;) {
    const t = translate(ctx, behavior, shape, kinds, constant);
    let changed = false;
    for (const [key, scalar] of shape.scalars) {
      const v = t.next.get(key);
      if (!v) continue;
      if (v.code === scalar.reg && !constant.has(key)) {
        constant.add(key);
        changed = true;
      }
      const kind = v.kind === (kinds.get(key) ?? 'num') ? v.kind : 'mixed';
      if (kind !== (kinds.get(key) ?? 'num')) {
        kinds.set(key, kind);
        changed = true;
      }
    }
    if (!changed) return { t, constant };
  }
}

function literalOf(value: bigint, width: number): string {
  return width > 1 ? `${width}'d${value}` : `1'b${value}`;
}

function outputLines(ctx: PrimitiveContext, t: Translation, outputNames: string[]): string[] {
  const lines: string[] = [];
  for (const name of outputNames) {
    const wire = ctx.wires.outputs.get(name);
    if (!wire) continue;
    // An output no return gives is never written, so stays 0.
    const v = t.outputs.get(name) ?? literal(0n);
    const width = ctx.ports?.outputs.get(name) ?? 32;
    // The simulator stores the low `width` bits. A value that fits needs no
    // mask, even in a wider net; one that doesn't goes through a net of the
    // port's width, which keeps exactly those bits.
    const code = fitsUnsigned(v, width) ? v.code : t.nets.wire(width, false, v.code, `${name}_out`);
    lines.push(`assign ${wire} = ${code};`);
  }
  return lines;
}

function memoryLines(memory: Memory, target: PrimitiveContext['target']): string[] {
  if (target !== 'simulation') return [];
  // Unwritten words read 0 in the simulator, so the memory starts zeroed.
  const lines = [
    `initial begin : ${memory.reg}_init`,
    '  integer k;',
    `  for (k = 0; k < ${memory.depth}; k = k + 1) ${memory.reg}[k] = ${memory.width}'d0;`,
  ];
  for (const addr of [...memory.contents.keys()].sort((a, b) => a - b)) {
    lines.push(`  ${memory.reg}[${addr}] = ${memory.width}'d${memory.contents.get(addr)};`);
  }
  lines.push('end');
  return lines;
}

function clockedBlock(
  ctx: PrimitiveContext,
  shape: StateShape,
  t: Translation,
  live: Scalar[],
): string[] {
  const updates: string[] = [];
  for (const [key, scalar] of shape.scalars) {
    if (live.includes(scalar)) updates.push(`${scalar.reg} <= ${(t.next.get(key) as Value).code};`);
  }
  for (const w of t.writes) {
    const write = `${w.memory.reg}[${w.addr.code}] <= ${w.value.code};`;
    updates.push(w.guard ? `if (${w.guard}) ${write}` : write);
  }
  if (updates.length === 0) return [];
  const lines = [`always @(posedge ${ctx.clockName}) begin`];
  if (live.length > 0) {
    lines.push(`  if (!${ctx.resetName}) begin`);
    for (const s of live) lines.push(`    ${s.reg} <= ${literalOf(s.init, s.width)};`);
    lines.push('  end else begin');
  } else {
    // Memories keep their contents through reset.
    lines.push(`  if (${ctx.resetName}) begin`);
  }
  lines.push(...updates.map((u) => `    ${u}`), '  end', 'end');
  return lines;
}

/**
 * Verilog for `behavior` on the node `ctx` describes. Throws `Unsupported`,
 * with the reason, for anything that wouldn't match the simulator.
 */
export function synthesizeBehavior(
  ctx: PrimitiveContext,
  behavior: Behavior | undefined,
): Synthesized {
  if (!behavior) return unsupported('no Verilog mapping, and no behavior to translate');
  const prefix = sanitizeId(ctx.nodeId);
  const shape = stateShape(ctx, behavior.stateKeys ?? [], prefix);
  const { t, constant } = settle(ctx, behavior, shape);

  const live = [...shape.scalars].filter(([key]) => t.next.has(key) && !constant.has(key));
  for (const [key, s] of live) {
    if (!fitsUnsigned(t.next.get(key) as Value, s.width)) {
      unsupported(
        `onTick: state '${key}' can be set outside its ${s.width} bits, which the simulator stores and Verilog can't; mask it`,
      );
    }
  }
  const liveScalars = live.map(([, s]) => s);
  const memories = [...shape.memories.values()];
  const outputs = outputLines(ctx, t, behavior.outputNames);
  const clocked = clockedBlock(ctx, shape, t, liveScalars);
  return {
    declarations: [
      ...liveScalars.map((s) => `reg ${s.width > 1 ? `[${s.width - 1}:0] ` : ''}${s.reg};`),
      ...memories.map((m) => `reg [${m.width - 1}:0] ${m.reg} [0:${m.depth - 1}];`),
      ...t.nets.declarations,
    ],
    lines: [
      ...liveScalars.map((s) => `initial ${s.reg} = ${literalOf(s.init, s.width)};`),
      ...memories.flatMap((m) => memoryLines(m, ctx.target)),
      ...t.nets.lines,
      ...outputs,
      ...clocked,
    ],
    clocked: clocked.length > 0,
  };
}

/**
 * Whether one `eval` can be translated, given only its port names: each port
 * is taken as 32 bits and the node as having no arguments. Exporting a whole
 * circuit (`checkSynthesizable`) checks each node as it really is.
 */
export function checkEvalSynthesizable(
  evalFn: BehaviorFn,
  inputNames: string[],
  outputNames: string[],
): SynthValidation {
  const ctx: PrimitiveContext = {
    behaviors: new Map(),
    nodeId: 'check',
    primitiveType: 'check',
    args: {},
    wires: {
      inputs: new Map(inputNames.map((n) => [n, n])),
      outputs: new Map(outputNames.map((n) => [n, n])),
    },
    clockName: 'clk',
    resetName: 'rst_n',
    target: 'simulation',
  };
  try {
    synthesizeBehavior(ctx, { inputNames, outputNames, evalFn });
    return { valid: true, errors: [] };
  } catch (e) {
    if (e instanceof Unsupported) return { valid: false, errors: [e.message] };
    throw e;
  }
}

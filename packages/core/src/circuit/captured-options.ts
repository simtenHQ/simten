/**
 * Finds a factory's variables read from inside its `eval` or `onTick` (#118).
 *
 * Every instance of a factory shares one behavior: a compile keeps one per
 * component name, so `AddK({ k: 1 })` and `AddK({ k: 100 })` both ran with
 * whichever closure was seen first. Reading an option from the eval's argument
 * works, since the simulator puts each node's own options there. `circuit()`
 * rejects instances that disagree on a captured variable; one instance, or
 * several that agree, keep working.
 *
 * This reads the source of the factory and of the behavior with acorn and
 * reports the behavior's free variables that the factory binds: its parameters
 * and the variables declared in its body. It errs towards silence: a name bound
 * anywhere inside the behavior counts as bound everywhere in it, and source it
 * can't parse is not checked.
 */

import { type Node as AcornNode, type Function as FunctionNode, parse } from 'acorn';

/** How the factory binds a name: as one of its options, or a variable in its body. */
export type FactoryBinding = 'option' | 'local';

export interface CapturedVariable {
  name: string;
  binding: FactoryBinding;
  /**
   * The option the variable holds, when it holds exactly one: `width` for
   * `({ width: w })`. Left out when it could depend on any option (the whole
   * options object, a rest element, a variable the factory computes).
   */
  option?: string;
}

/** A captured variable and the behavior that reads it. */
export interface FactoryCapture extends CapturedVariable {
  behavior: 'eval' | 'onTick';
}

type SyntaxNode = AcornNode & Record<string, unknown>;

function isNode(value: unknown): value is SyntaxNode {
  return (
    typeof value === 'object' && value !== null && typeof (value as AcornNode).type === 'string'
  );
}

function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    if (Array.isArray(value)) {
      for (const v of value) if (isNode(v)) out.push(v);
    } else if (isNode(value)) {
      out.push(value);
    }
  }
  return out;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Parse a function's source text. Method shorthand (`eval({ a }) { ... }`) is
 * not an expression on its own, so it is read as an object member.
 */
export function parseFunction(source: string): FunctionNode | undefined {
  const attempts = [`(${source})`, `({${source}})`];
  for (const text of attempts) {
    try {
      const program = parse(text, { ecmaVersion: 'latest' }) as unknown as SyntaxNode;
      const found = firstFunction(program);
      if (found) return found;
    } catch {
      // try the next reading
    }
  }
  return undefined;
}

function firstFunction(node: SyntaxNode): FunctionNode | undefined {
  if (FUNCTION_TYPES.has(node.type)) return node as unknown as FunctionNode;
  for (const child of children(node)) {
    const found = firstFunction(child);
    if (found) return found;
  }
  return undefined;
}

/** Names a binding pattern declares. Default values and computed keys are skipped. */
function patternNames(pattern: SyntaxNode, out: string[]): void {
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern.name as string);
      return;
    case 'ObjectPattern':
      for (const prop of pattern.properties as SyntaxNode[]) {
        patternNames(prop.type === 'RestElement' ? prop : (prop.value as SyntaxNode), out);
      }
      return;
    case 'ArrayPattern':
      for (const el of pattern.elements as (SyntaxNode | null)[]) if (el) patternNames(el, out);
      return;
    case 'RestElement':
      patternNames(pattern.argument as SyntaxNode, out);
      return;
    case 'AssignmentPattern':
      patternNames(pattern.left as SyntaxNode, out);
      return;
    default:
      return;
  }
}

/**
 * The names the options parameter binds, each with the option it holds when it
 * holds exactly one (a top-level property of an object pattern).
 */
function optionNames(param: SyntaxNode): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  const pattern = param.type === 'AssignmentPattern' ? (param.left as SyntaxNode) : param;
  if (pattern.type !== 'ObjectPattern') {
    const names: string[] = [];
    patternNames(pattern, names);
    for (const n of names) out.set(n, undefined);
    return out;
  }
  for (const prop of pattern.properties as SyntaxNode[]) {
    const names: string[] = [];
    patternNames(prop.type === 'RestElement' ? prop : (prop.value as SyntaxNode), names);
    const key = prop.key as SyntaxNode | undefined;
    const value = prop.value as SyntaxNode | undefined;
    const target = value?.type === 'AssignmentPattern' ? (value.left as SyntaxNode) : value;
    const single =
      prop.type === 'Property' &&
      !prop.computed &&
      key?.type === 'Identifier' &&
      target?.type === 'Identifier';
    for (const n of names) out.set(n, single ? (key.name as string) : undefined);
  }
  return out;
}

/**
 * What the factory binds in its own scope: its parameters, and the variables,
 * functions and classes declared in its body outside any nested function.
 */
export function factoryBindings(factory: FunctionNode): Map<string, CapturedVariable> {
  const bindings = new Map<string, CapturedVariable>();
  const [first, ...rest] = factory.params as unknown as SyntaxNode[];
  if (first) {
    for (const [name, option] of optionNames(first)) {
      bindings.set(
        name,
        option === undefined ? { name, binding: 'option' } : { name, binding: 'option', option },
      );
    }
  }
  for (const param of rest) {
    const names: string[] = [];
    patternNames(param, names);
    for (const name of names) bindings.set(name, { name, binding: 'option' });
  }
  const declare = (name: string) => {
    if (!bindings.has(name)) bindings.set(name, { name, binding: 'local' });
  };
  const visit = (node: SyntaxNode) => {
    if (node.type === 'VariableDeclarator') {
      const names: string[] = [];
      patternNames(node.id as SyntaxNode, names);
      for (const n of names) declare(n);
    } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      const id = node.id as SyntaxNode | null;
      if (id) declare(id.name as string);
      if (node.type === 'FunctionDeclaration') return;
    }
    if (FUNCTION_TYPES.has(node.type)) return;
    for (const child of children(node)) visit(child);
  };
  visit(factory.body as unknown as SyntaxNode);
  return bindings;
}

/** A node's fields that bind names and the fields it reads, where they aren't all of them read. */
type Fields = { bind?: string[]; read: string[] };

const functionFields = (): Fields => ({ bind: ['id', 'params'], read: ['body'] });
const classFields = (): Fields => ({ bind: ['id'], read: ['superClass', 'body'] });
/** A key is a name, not a read, unless it is computed (`{ [k]: v }`). */
const keyedFields = (n: SyntaxNode): Fields => ({
  read: n.computed ? ['key', 'value'] : ['value'],
});

const FIELDS: Record<string, (n: SyntaxNode) => Fields> = {
  FunctionDeclaration: functionFields,
  FunctionExpression: functionFields,
  ArrowFunctionExpression: functionFields,
  ClassDeclaration: classFields,
  ClassExpression: classFields,
  VariableDeclarator: () => ({ bind: ['id'], read: ['init'] }),
  CatchClause: () => ({ bind: ['param'], read: ['body'] }),
  MemberExpression: (n) => ({ read: n.computed ? ['object', 'property'] : ['object'] }),
  Property: keyedFields,
  MethodDefinition: keyedFields,
  PropertyDefinition: keyedFields,
  LabeledStatement: () => ({ read: ['body'] }),
  BreakStatement: () => ({ read: [] }),
  ContinueStatement: () => ({ read: [] }),
  MetaProperty: () => ({ read: [] }),
};

/** The child nodes under one field: a single node, a list of them, or none. */
function nodesAt(node: SyntaxNode, key: string): SyntaxNode[] {
  const value = node[key];
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

/**
 * The names a function reads that it does not bind itself. Any name the
 * function binds anywhere (a parameter, a variable, a nested function's
 * parameter) is treated as bound throughout it.
 */
export function freeVariables(fn: FunctionNode): Set<string> {
  const bound = new Set<string>();
  const referenced = new Set<string>();

  const bind = (pattern: SyntaxNode) => {
    const names: string[] = [];
    patternNames(pattern, names);
    for (const n of names) bound.add(n);
    visitPattern(pattern);
  };

  // A pattern's default values and computed keys are expressions.
  const visitPattern = (pattern: SyntaxNode) => {
    switch (pattern.type) {
      case 'ObjectPattern':
        for (const prop of pattern.properties as SyntaxNode[]) {
          if (prop.type === 'RestElement') {
            visitPattern(prop.argument as SyntaxNode);
            continue;
          }
          if (prop.computed) visit(prop.key as SyntaxNode);
          visitPattern(prop.value as SyntaxNode);
        }
        return;
      case 'ArrayPattern':
        for (const el of pattern.elements as (SyntaxNode | null)[]) if (el) visitPattern(el);
        return;
      case 'RestElement':
        visitPattern(pattern.argument as SyntaxNode);
        return;
      case 'AssignmentPattern':
        visitPattern(pattern.left as SyntaxNode);
        visit(pattern.right as SyntaxNode);
        return;
      case 'MemberExpression':
        visit(pattern);
        return;
      default:
        return;
    }
  };

  const visit = (node: SyntaxNode): void => {
    if (node.type === 'Identifier') {
      referenced.add(node.name as string);
      return;
    }
    const fields = FIELDS[node.type]?.(node);
    if (!fields) {
      for (const child of children(node)) visit(child);
      return;
    }
    for (const key of fields.bind ?? []) for (const n of nodesAt(node, key)) bind(n);
    for (const key of fields.read) for (const n of nodesAt(node, key)) visit(n);
  };

  visit(fn as unknown as SyntaxNode);
  for (const n of bound) referenced.delete(n);
  return referenced;
}

/**
 * The factory's variables that `behaviorSource` reads, or none when either
 * can't be parsed or the behavior wasn't written inside the factory (an eval
 * defined at module scope can't see the factory's variables).
 */
export function capturedFactoryVariables(
  factorySource: string,
  behaviorSource: string,
): CapturedVariable[] {
  if (!factorySource.includes(behaviorSource)) return [];
  const factory = parseFunction(factorySource);
  const behavior = parseFunction(behaviorSource);
  if (!factory || !behavior) return [];
  const bindings = factoryBindings(factory);
  if (bindings.size === 0) return [];
  const captured: CapturedVariable[] = [];
  for (const name of freeVariables(behavior)) {
    const binding = bindings.get(name);
    if (binding) captured.push(binding);
  }
  return captured;
}

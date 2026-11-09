/**
 * Combinational loop detection for the Verilog exporter (ADR 0002).
 *
 * The simulator settles loops built from gates (the game's SR and D latches),
 * but a loop of `assign`s is not something synthesis turns into storage: yosys
 * warns and the board oscillates or latches unpredictably. So the exporter
 * refuses a circuit whose exported combinational logic has a cycle.
 *
 * The check runs on the Verilog each node emitted rather than on the flat
 * netlist's nodes, because a node's outputs often depend on only some of its
 * inputs: the 6502's timing logic feeds its decode PLA and reads one of the
 * PLA's outputs back, but through different ports, so there is no loop. Nets
 * written by an `always @(posedge ...)` block (registers, memories, a
 * primitive's `onTick` state) have no combinational driver, so they break
 * cycles.
 */

/** How many of a loop's nodes the error names before summarising the rest. */
const NAMED = 8;

/** A circuit the exporter refuses because its combinational logic has a cycle. */
export class CombinationalLoopError extends Error {
  /** Node paths on the loop, in the order the loop visits them. */
  readonly nodes: readonly string[];

  constructor(nodes: readonly string[]) {
    const shown = nodes.slice(0, NAMED).join(' -> ');
    const close =
      nodes.length > NAMED ? ` -> ... (${nodes.length} nodes in all)` : ` -> ${nodes[0]}`;
    super(
      `Combinational loop: ${shown}${close}. ` +
        "Verilog export doesn't support a loop of gates; the simulator settles it, " +
        'but synthesis does not. Store the value in a Register or DFlipFlop instead.',
    );
    this.name = 'CombinationalLoopError';
    this.nodes = nodes;
  }
}

/** The Verilog one node emitted. */
export interface EmittedNode {
  nodeId: string;
  lines: readonly string[];
}

const TOKEN =
  /\/\/[^\n]*|\s+|\d*'[sS]?[bodhBODH][0-9a-fA-FxXzZ_?]+|\d+|\$?[A-Za-z_][A-Za-z0-9_$]*|"(?:[^"\\]|\\.)*"|===|!==|==|!=|<=|>=|<<<|>>>|<<|>>|&&|\|\||./g;

const KEYWORDS = new Set([
  'assign',
  'always',
  'initial',
  'begin',
  'end',
  'if',
  'else',
  'case',
  'casez',
  'casex',
  'endcase',
  'default',
  'for',
  'posedge',
  'negedge',
  'or',
  'reg',
  'wire',
  'integer',
  'signed',
]);

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  for (const m of source.matchAll(TOKEN)) {
    const t = m[0];
    if (!/^\s/.test(t) && !t.startsWith('//')) tokens.push(t);
  }
  return tokens;
}

const isNet = (t: string) => /^[A-Za-z_]/.test(t) && !KEYWORDS.has(t);

/** Index just past the bracket group opening at `i`. */
function skipGroup(tokens: string[], i: number): number {
  const stack: string[] = [];
  let k = i;
  do {
    const t = tokens[k++];
    if (OPEN[t]) stack.push(OPEN[t]);
    else if (t === stack[stack.length - 1]) stack.pop();
  } while (stack.length > 0 && k < tokens.length);
  return k;
}

/** Index just past the procedural statement starting at `i`. */
function skipStatement(tokens: string[], i: number): number {
  const t = tokens[i];
  if (t === 'begin' || t === 'case' || t === 'casez' || t === 'casex') {
    const close = t === 'begin' ? 'end' : 'endcase';
    let depth = 0;
    let k = i;
    do {
      const u = tokens[k++];
      if (u === t || (t !== 'begin' && (u === 'case' || u === 'casez' || u === 'casex'))) depth++;
      else if (u === close) depth--;
    } while (depth > 0 && k < tokens.length);
    return k;
  }
  if (t === 'if' || t === 'for') {
    let k = skipStatement(tokens, skipGroup(tokens, i + 1));
    if (t === 'if' && tokens[k] === 'else') k = skipStatement(tokens, k + 1);
    return k;
  }
  let k = i;
  while (k < tokens.length && tokens[k] !== ';') k = OPEN[tokens[k]] ? skipGroup(tokens, k) : k + 1;
  return k + 1;
}

/** Nets assigned with `=` in `tokens`: `x = `, `x[i] = `, `{a, b} = `. */
function written(tokens: string[]): Set<string> {
  const nets = new Set<string>();
  tokens.forEach((t, k) => {
    if (t !== '=') return;
    let j = k - 1;
    if (tokens[j] === ']') {
      while (j > 0 && tokens[j] !== '[') j--;
      j--;
    }
    if (tokens[j] === '}') {
      for (j--; j >= 0 && tokens[j] !== '{'; j--) if (isNet(tokens[j])) nets.add(tokens[j]);
    } else if (j >= 0 && isNet(tokens[j])) nets.add(tokens[j]);
  });
  return nets;
}

/** Which nets drive which, combinationally, and which node drives each net. */
class NetGraph {
  readonly drives = new Map<string, Set<string>>();
  readonly owner = new Map<string, string>();

  /** `writes` are driven by `nodeId` from every net in `reads`. */
  connect(nodeId: string, reads: string[], writes: Set<string>): void {
    for (const w of writes) {
      this.owner.set(w, nodeId);
      for (const r of reads) {
        if (!isNet(r)) continue;
        let out = this.drives.get(r);
        if (!out) {
          out = new Set();
          this.drives.set(r, out);
        }
        out.add(w);
      }
    }
  }

  /** Add one node's Verilog. Clocked and `initial` blocks add nothing. */
  add(nodeId: string, tokens: string[]): void {
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === 'assign') {
        const end = skipStatement(tokens, i + 1);
        const body = tokens.slice(i + 1, end - 1);
        const eq = body.indexOf('=');
        if (eq > 0)
          this.connect(nodeId, body.slice(eq + 1), new Set(body.slice(0, eq).filter(isNet)));
        i = end;
      } else if (t === 'always' && tokens[i + 1] === '@') {
        i = this.always(nodeId, tokens, i + 2);
      } else {
        i = skipStatement(tokens, t === 'initial' ? i + 1 : i);
      }
    }
  }

  /** An `always` block whose sensitivity list starts at `i`; returns the index after it. */
  private always(nodeId: string, tokens: string[], i: number): number {
    const sens = tokens[i] === '(' ? skipGroup(tokens, i) : i + 1;
    const end = skipStatement(tokens, sens);
    const clocked = tokens.slice(i, sens).some((u) => u === 'posedge' || u === 'negedge');
    if (!clocked) {
      // Every net the block reads from outside may reach every net it writes.
      // Reading a net the block itself wrote (a default, a loop counter) is
      // ordering within the block, not a loop.
      const body = tokens.slice(sens, end);
      const writes = written(body);
      this.connect(
        nodeId,
        body.filter((u) => !writes.has(u)),
        writes,
      );
    }
    return end;
  }
}

/**
 * One cycle in `drives`, as the nets along it. Iterative depth-first search:
 * a net met again while still on the path closes a loop. Iterative because a
 * flattened CPU is thousands of nets deep.
 */
function findCycle(drives: ReadonlyMap<string, ReadonlySet<string>>): string[] | undefined {
  const ON_PATH = 1;
  const DONE = 2;
  const mark = new Map<string, number>();
  const none: ReadonlySet<string> = new Set();
  for (const root of drives.keys()) {
    if (mark.has(root)) continue;
    const path = [root];
    const stack = [(drives.get(root) ?? none).values()];
    mark.set(root, ON_PATH);
    while (stack.length > 0) {
      const step = stack[stack.length - 1].next();
      if (step.done) {
        mark.set(path[path.length - 1], DONE);
        path.pop();
        stack.pop();
      } else if (mark.get(step.value) === ON_PATH) {
        return path.slice(path.indexOf(step.value));
      } else if (!mark.has(step.value)) {
        mark.set(step.value, ON_PATH);
        path.push(step.value);
        stack.push((drives.get(step.value) ?? none).values());
      }
    }
  }
  return undefined;
}

/**
 * One combinational loop in the exported Verilog, as the nodes along it, or
 * undefined when there is none.
 */
export function findCombinationalLoop(nodes: readonly EmittedNode[]): string[] | undefined {
  const graph = new NetGraph();
  for (const { nodeId, lines } of nodes) graph.add(nodeId, tokenize(lines.join('\n')));
  const nets = findCycle(graph.drives);
  if (!nets) return undefined;
  // The nodes driving the loop's nets, each once, in loop order.
  const loop: string[] = [];
  for (const net of nets) {
    const node = graph.owner.get(net);
    if (node !== undefined && !loop.includes(node)) loop.push(node);
  }
  return loop;
}

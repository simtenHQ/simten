/**
 * Reading a Verilog project well enough to import it, with no yosys round trip.
 *
 * The import sheet's job is to ask as little as possible. yosys already prunes
 * unreachable modules, so "which files" never needs asking; the RTL declares its
 * own parameter defaults, so those pre-fill; and a firmware parameter names the
 * file it wants, so it can usually be matched against what was fetched. What is
 * left to ask about is the top module, and only when more than one module is a
 * plausible root.
 *
 * Everything here is a regex over the source. That is deliberate: the alternative
 * is a second synth request to have yosys report the real parameter list, which
 * costs a round trip and half of a visitor's 5-per-minute rate-limit budget
 * before they have imported anything.
 */

/** Where a file goes: compiled, on the include path, or written as data. */
export type FileRole = 'source' | 'include' | 'data';

export interface ProjectFile {
  path: string;
  content: string;
  role: FileRole;
}

/** A `parameter` declaration read off the RTL. */
export interface ParamDecl {
  name: string;
  /** The RTL's default, as written. */
  defaultValue: string;
  /**
   * `string` and `number` can be sent as `chparam`. `expression` covers defaults
   * like `ALIGN = COMPRESSED` that only mean something once elaborated; they
   * are shown, but left to the RTL unless the user types over them.
   */
  kind: 'string' | 'number' | 'expression';
}

const SOURCE_EXT = ['.v', '.sv'];
const INCLUDE_EXT = ['.vh', '.svh'];

export function classifyFile(path: string): FileRole {
  const lower = path.toLowerCase();
  if (INCLUDE_EXT.some((e) => lower.endsWith(e))) return 'include';
  if (SOURCE_EXT.some((e) => lower.endsWith(e))) return 'source';
  return 'data';
}

/** Module names declared in a source, in declaration order. */
export function detectModules(src: string): string[] {
  return [...stripComments(src).matchAll(/\bmodule\s+([A-Za-z_]\w*)/g)].map((m) => m[1]);
}

/** One `module … endmodule` block. */
interface ModuleBlock {
  name: string;
  body: string;
}

/** Every module in the file set, comment-free, in declaration order. */
function moduleBlocks(sources: ProjectFile[]): ModuleBlock[] {
  const blocks: ModuleBlock[] = [];
  for (const f of sources) {
    const text = stripComments(f.content);
    for (const m of text.matchAll(/\bmodule\s+([A-Za-z_]\w*)/g)) {
      const start = m.index ?? 0;
      const end = text.indexOf('endmodule', start);
      blocks.push({ name: m[1], body: text.slice(start, end === -1 ? undefined : end) });
    }
  }
  return blocks;
}

/**
 * Who instantiates whom. An instantiation is the module name followed by a
 * parameter override (`serv_top #(…)`) or an instance name (`serv_top cpu (…)`);
 * the declaration is the same name preceded by `module`, which is what tells
 * them apart.
 */
function instantiationGraph(blocks: ModuleBlock[]): Map<string, Set<string>> {
  const declared = new Set(blocks.map((b) => b.name));
  const graph = new Map<string, Set<string>>();
  for (const block of blocks) {
    const children = graph.get(block.name) ?? new Set<string>();
    for (const name of declared) {
      if (name === block.name) continue;
      // The trailing \b matters: without it `servant` matches the start of
      // `servant_ram` and the SoC looks like it instantiates itself.
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b\\s*(?:#\\s*\\(|[A-Za-z_]\\w*\\s*\\()`);
      if (re.test(block.body)) children.add(name);
    }
    graph.set(block.name, children);
  }
  return graph;
}

/** How many distinct modules this one pulls in, directly or not. */
function reachableCount(graph: Map<string, Set<string>>, root: string): number {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined) break;
    for (const child of graph.get(next) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      stack.push(child);
    }
  }
  return seen.size;
}

/**
 * Modules that nothing else instantiates (the roots of the design) with the
 * one that pulls in the most of the file set first.
 *
 * "The last module in the file" is the obvious guess and a bad one across
 * several files: SERV's last module is `serv_state`, a leaf. Its actual roots
 * are `serv_rf_top` and `serv_synth_wrapper`, which is exactly the case where
 * the user has to be asked, but `serv_rf_top` reaches thirteen more modules
 * than the wrapper does, so it can at least be offered first.
 *
 * Falls back to every declared module if the scan finds no roots at all, which
 * is what a cyclic or unparsed file set looks like, and a long list beats none.
 */
export function detectTopCandidates(sources: ProjectFile[]): string[] {
  const blocks = moduleBlocks(sources);
  if (blocks.length === 0) return [];

  const graph = instantiationGraph(blocks);
  const instantiated = new Set<string>();
  for (const children of graph.values()) for (const child of children) instantiated.add(child);

  const declared = [...new Set(blocks.map((b) => b.name))];
  const roots = declared.filter((m) => !instantiated.has(m));
  const candidates = roots.length > 0 ? roots : declared;
  return candidates.sort(
    (a, b) => reachableCount(graph, b) - reachableCount(graph, a) || a.localeCompare(b),
  );
}

/**
 * `parameter` declarations of one module, whether they sit in a `#(…)` header or
 * in the body the way SERV writes them.
 */
export function parseParameters(sources: ProjectFile[], moduleName: string): ParamDecl[] {
  const body = moduleBody(sources, moduleName);
  if (body === undefined) return [];

  const out: ParamDecl[] = [];
  const seen = new Set<string>();
  // Optional type/signedness/range between `parameter` and the name:
  // `parameter [0:0] debug = 1'b0`, `parameter integer N = 4`.
  const re =
    /\bparameter\s+(?:(?:signed|unsigned|integer|real|realtime|time|reg|logic|bit|byte|shortint|int|longint)\s+)*(?:\[[^\]]*\]\s*)?([A-Za-z_]\w*)\s*=\s*([^,;)\n]+)/g;
  for (const m of body.matchAll(re)) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, ...classifyValue(m[2].trim()) });
  }
  return out;
}

function classifyValue(raw: string): { defaultValue: string; kind: ParamDecl['kind'] } {
  const value = raw
    .trim()
    .replace(/\s*\/\/.*$/, '')
    .trim();
  const quoted = /^"([^"]*)"$/.exec(value);
  if (quoted) return { defaultValue: quoted[1], kind: 'string' };
  if (/^-?[0-9_]+$/.test(value)) return { defaultValue: value.replace(/_/g, ''), kind: 'number' };
  if (/^[0-9]*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ_]+$/.test(value)) {
    return { defaultValue: value, kind: 'number' };
  }
  return { defaultValue: value, kind: 'expression' };
}

/**
 * A firmware parameter names the file it wants (`memfile = "zephyr_hello.hex"`),
 * so the matching data file can be picked without asking. Matched on basename,
 * because a README's path and the fetched tree's path rarely agree.
 */
export function matchFirmware(defaultValue: string, dataFiles: ProjectFile[]): string | undefined {
  const wanted = basename(defaultValue).toLowerCase();
  if (!wanted) return undefined;
  const hit = dataFiles.find((f) => basename(f.path).toLowerCase() === wanted);
  return hit?.path;
}

/** Does this parameter's default look like a memory image filename? */
export function looksLikeFirmware(p: ParamDecl): boolean {
  return p.kind === 'string' && /\.(hex|mem|bin|txt)$/i.test(p.defaultValue);
}

export interface RepoRef {
  owner: string;
  repo: string;
  /** Branch, tag or SHA. Undefined means "whatever the repo's default is". */
  ref?: string;
  /** Sub-path from a /tree/ URL, used to pre-select a folder. */
  path?: string;
}

/**
 * Parse the URL forms people actually paste: the repo page, a browsed folder,
 * or the bare `owner/repo`.
 */
export function parseRepoUrl(input: string): RepoRef | undefined {
  const trimmed = input
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  if (!trimmed) return undefined;
  // A scheme other than http(s) is not a repo page.
  const scheme = /^([A-Za-z][\w+.-]*):\/\//.exec(trimmed);
  if (scheme && !/^https?$/i.test(scheme[1])) return undefined;
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  // Anything with a dot before the first slash is a host; only github's counts.
  // This is what lets `github.com/olofk/serv` through: the form the address
  // bar shows, and the one this field's own placeholder suggests.
  const host = /^([^/]+)\//.exec(withoutScheme)?.[1]?.toLowerCase();
  if (host?.includes('.') && host !== 'github.com' && host !== 'www.github.com') return undefined;
  const withoutHost = withoutScheme.replace(/^(www\.)?github\.com\//i, '');
  const parts = withoutHost.split('/').filter(Boolean);
  if (parts.length < 2) return undefined;
  const [owner, repo, kind, ref, ...rest] = parts;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return undefined;
  if (kind === 'tree' || kind === 'blob') {
    return { owner, repo, ref, path: rest.length > 0 ? rest.join('/') : undefined };
  }
  return { owner, repo };
}

/**
 * Folders that directly contain Verilog, deepest path first with a count, so the
 * picker can lead with `rtl/` rather than the repo root. A repo URL alone is not
 * enough to import (SERV has 77 `.v` files across benches, board wrappers and
 * test data) so the folder is the real unit of choice.
 */
export function sourceFolders(paths: string[]): { folder: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of paths) {
    if (classifyFile(p) !== 'source') continue;
    const folder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder));
}

function basename(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Comments hold module names too, and a commented-out instantiation is not one. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Source text between `module <name>` and its `endmodule`. */
function moduleBody(sources: ProjectFile[], moduleName: string): string | undefined {
  const re = new RegExp(`\\bmodule\\s+${escapeRegExp(moduleName)}\\b`);
  for (const f of sources) {
    const text = stripComments(f.content);
    const start = text.search(re);
    if (start === -1) continue;
    const end = text.indexOf('endmodule', start);
    return text.slice(start, end === -1 ? undefined : end);
  }
  return undefined;
}

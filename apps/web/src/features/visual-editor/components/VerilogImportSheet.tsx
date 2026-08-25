/**
 * VerilogImportSheet: paste a module, drop a folder, or point at a GitHub repo,
 * and get editable simten source.
 *
 * Posts to /api/verilog-import (the synth container's `import` yosys target +
 * @simten/core's importer) and hands the generated source back via onImport.
 *
 * The design goal is to ask as little as possible. yosys prunes whatever the top
 * module does not reach, so every file in a folder can go in and the unreachable
 * ones drop out on their own; parameters pre-fill from the RTL's own defaults;
 * and a firmware parameter names the file it wants, so it is matched against the
 * repo tree rather than asked about. What is left is the top module, and only
 * when more than one module looks like a root.
 *
 * GitHub intake is entirely client-side: the trees API and
 * raw.githubusercontent.com are both CORS-open, so this is one tree call plus N
 * file fetches with no server in the middle. Unauthenticated tree calls are
 * limited to 60/hour per visitor IP, which is that visitor's own budget.
 */

'use client';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@simten/ui/primitives/sheet';
import { FileInput, Loader2, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  classifyFile,
  detectTopCandidates,
  looksLikeFirmware,
  matchFirmware,
  type ParamDecl,
  type ProjectFile,
  parseParameters,
  parseRepoUrl,
  sourceFolders,
} from '../verilog-project';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'warned'; warnings: string[] }
  | { kind: 'error'; message: string; unsupported?: boolean };

interface RepoTree {
  owner: string;
  repo: string;
  ref: string;
  paths: string[];
}

const PLACEHOLDER = `module adder8(input [7:0] a, input [7:0] b, output [7:0] y);
  assign y = a + b;
endmodule`;

const rawUrl = (t: RepoTree, path: string) =>
  `https://raw.githubusercontent.com/${t.owner}/${t.repo}/${t.ref}/${path}`;

const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`;
}

export function VerilogImportSheet({ onImport }: { onImport: (source: string) => void }) {
  const [open, setOpen] = useState(false);
  const [verilog, setVerilog] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [repoInput, setRepoInput] = useState('');
  const [tree, setTree] = useState<RepoTree | null>(null);
  /** Null until the user picks one; otherwise the detected root is followed. */
  const [chosenTop, setChosenTop] = useState<string | null>(null);
  /**
   * Parameter overrides, tagged with the module they were typed for. Tagging
   * rather than clearing on change means a stale `memfile` from the previously
   * selected module can never leak into this one's request.
   */
  const [overrides, setOverrides] = useState<{ top: string; values: Record<string, string> }>({
    top: '',
    values: {},
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sources = useMemo(() => files.filter((f) => f.role === 'source'), [files]);
  const includes = useMemo(() => files.filter((f) => f.role === 'include'), [files]);
  const dataFiles = useMemo(() => files.filter((f) => f.role === 'data'), [files]);

  /** Every source in play: the dropped/fetched ones plus anything pasted. */
  const allSources = useMemo(
    () =>
      verilog.trim()
        ? [...sources, { path: 'pasted.v', content: verilog, role: 'source' as const }]
        : sources,
    [sources, verilog],
  );

  const topCandidates = useMemo(() => detectTopCandidates(allSources), [allSources]);
  // Follow the detected root: for a single pasted module that is the module
  // itself, for a folder it is whichever root reaches the most of the file set,
  // until the user picks something else.
  const top = chosenTop ?? topCandidates[0] ?? '';
  const params = useMemo(() => (top ? parseParameters(allSources, top) : []), [allSources, top]);
  const totalBytes = useMemo(
    () => files.reduce((n, f) => n + f.content.length, 0) + verilog.length,
    [files, verilog],
  );

  const addFiles = useCallback((incoming: ProjectFile[]) => {
    setFiles((prev) => {
      const byPath = new Map(prev.map((f) => [f.path, f]));
      for (const f of incoming) byPath.set(f.path, f);
      return [...byPath.values()];
    });
  }, []);

  const readLocalFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const read = await Promise.all(
        [...list].map(async (file) => {
          // webkitRelativePath is set for a folder pick and keeps the layout,
          // which is what makes a relative `include` and a `fw/x.hex` memfile
          // resolve the way the project expects.
          const path =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          return { path, content: await file.text(), role: classifyFile(path) };
        }),
      );
      addFiles(read);
      setStatus({ kind: 'idle' });
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      void readLocalFiles(e.dataTransfer.files);
    },
    [readLocalFiles],
  );

  const loadRepo = useCallback(async () => {
    const ref = parseRepoUrl(repoInput);
    if (!ref) {
      setStatus({
        kind: 'error',
        message: 'Expected a GitHub repo URL, like github.com/olofk/serv',
      });
      return;
    }
    setStatus({ kind: 'loading', message: `Reading ${ref.owner}/${ref.repo}…` });
    try {
      const branch = ref.ref ?? 'HEAD';
      const resp = await fetch(
        `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${branch}?recursive=1`,
      );
      if (!resp.ok) {
        setStatus({
          kind: 'error',
          message:
            resp.status === 403
              ? "GitHub's rate limit (60 requests an hour, per IP) is used up; try again later, or drop the files instead."
              : `Couldn't read that repo (HTTP ${resp.status})`,
        });
        return;
      }
      const data = (await resp.json()) as {
        tree?: { path: string; type: string }[];
        truncated?: boolean;
      };
      const paths = (data.tree ?? []).filter((e) => e.type === 'blob').map((e) => e.path);
      setTree({ owner: ref.owner, repo: ref.repo, ref: branch, paths });
      setStatus(
        data.truncated
          ? {
              kind: 'warned',
              warnings: ['That repo is too big for one listing, so some folders may be missing.'],
            }
          : { kind: 'idle' },
      );
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
    }
  }, [repoInput]);

  const loadFolder = useCallback(
    async (folder: string) => {
      if (!tree) return;
      const prefix = folder ? `${folder}/` : '';
      const wanted = tree.paths.filter((p) => {
        if (!p.startsWith(prefix) || p.slice(prefix.length).includes('/')) return false;
        const role = classifyFile(p);
        return role === 'source' || role === 'include';
      });
      setStatus({ kind: 'loading', message: `Fetching ${wanted.length} files…` });
      try {
        const fetched = await Promise.all(
          wanted.map(async (path) => {
            const resp = await fetch(rawUrl(tree, path));
            if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
            return { path, content: await resp.text(), role: classifyFile(path) };
          }),
        );
        addFiles(fetched);
        setStatus({ kind: 'idle' });
      } catch (e) {
        setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
      }
    },
    [tree, addFiles],
  );

  /** Record a parameter override against the module it was typed for. */
  const setParamValue = useCallback(
    (name: string, value: string) =>
      setOverrides((prev) => ({
        top,
        values: { ...(prev.top === top ? prev.values : {}), [name]: value },
      })),
    [top],
  );

  /**
   * Pull in the firmware a parameter names. The RTL's default is a bare filename
   * (`memfile = "zephyr_hello.hex"`) and the repo keeps it somewhere else
   * (`sw/zephyr_hello.hex`), so it is matched on basename and its real path is
   * sent back as the parameter value.
   */
  const fetchFirmware = useCallback(
    async (p: ParamDecl) => {
      if (!tree) return;
      const wanted = basename(p.defaultValue).toLowerCase();
      const path = tree.paths.find((f) => basename(f).toLowerCase() === wanted);
      if (!path) {
        setStatus({
          kind: 'error',
          message: `No file named ${wanted} in this repo. Attach it, or point ${p.name} at one of the files below.`,
        });
        return;
      }
      setStatus({ kind: 'loading', message: `Fetching ${path}…` });
      try {
        const resp = await fetch(rawUrl(tree, path));
        if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
        addFiles([{ path, content: await resp.text(), role: 'data' }]);
        setParamValue(p.name, path);
        setStatus({ kind: 'idle' });
      } catch (e) {
        setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
      }
    },
    [tree, addFiles, setParamValue],
  );

  /** The value a parameter will be sent with, or its RTL default. */
  const paramValue = useCallback(
    (p: ParamDecl) =>
      (overrides.top === top ? overrides.values[p.name] : undefined) ??
      (looksLikeFirmware(p)
        ? (matchFirmware(p.defaultValue, dataFiles) ?? p.defaultValue)
        : p.defaultValue),
    [overrides, top, dataFiles],
  );

  /**
   * Only parameters that actually differ from the RTL are sent. Leaving the rest
   * out keeps the container on its no-`chparam` path, which is the one that has
   * been exercised the longest.
   */
  const changedParams = useMemo(
    () =>
      params
        .filter((p) => p.kind !== 'expression' && paramValue(p) !== p.defaultValue)
        .map((p) => ({ name: p.name, value: paramValue(p), kind: p.kind })),
    [params, paramValue],
  );

  const handleImport = useCallback(async () => {
    if (!verilog.trim() && sources.length === 0) return;
    if (!top.trim()) {
      setStatus({ kind: 'error', message: 'Pick the top module' });
      return;
    }
    setStatus({ kind: 'loading', message: 'Synthesizing…' });
    try {
      const resp = await fetch('/api/verilog-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verilog,
          sources: sources.map((f) => ({ path: f.path, content: f.content })),
          includes: includes.map((f) => ({ path: f.path, content: f.content })),
          files: Object.fromEntries(dataFiles.map((f) => [f.path, f.content])),
          params: changedParams,
          top,
        }),
      });
      const data = (await resp.json()) as {
        success: boolean;
        source?: string;
        error?: string;
        unsupported?: boolean;
        warnings?: string[];
      };
      if (!resp.ok || !data.success || !data.source) {
        setStatus({
          kind: 'error',
          message: data.error ?? `Import failed (HTTP ${resp.status})`,
          unsupported: data.unsupported,
        });
        return;
      }
      onImport(data.source);
      setVerilog('');
      setFiles([]);
      setTree(null);
      setChosenTop(null);
      // Import succeeded. If there were non-fatal notes, keep the sheet open so
      // the user can read them; otherwise close.
      if (data.warnings && data.warnings.length > 0) {
        setStatus({ kind: 'warned', warnings: data.warnings });
      } else {
        setStatus({ kind: 'idle' });
        setOpen(false);
      }
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
    }
  }, [verilog, sources, includes, dataFiles, changedParams, top, onImport]);

  const folders = useMemo(() => (tree ? sourceFolders(tree.paths).slice(0, 8) : []), [tree]);
  const loading = status.kind === 'loading';
  const canImport = (verilog.trim().length > 0 || sources.length > 0) && top.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Import Verilog as editable simten source"
        >
          <FileInput className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Import Verilog</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-2xl">
        <SheetHeader className="p-0">
          <SheetTitle>Import Verilog</SheetTitle>
        </SheetHeader>

        <p className="text-xs text-muted-foreground">
          Paste a module, drop a folder, or point at a repo. It's synthesized to a generic netlist
          and lifted into editable simten source. Whatever the top module doesn't reach is dropped,
          so extra files are fine.
        </p>

        {/* ── GitHub intake ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void loadRepo();
            }}
            placeholder="github.com/olofk/serv"
            spellCheck={false}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" size="sm" onClick={() => void loadRepo()} disabled={loading}>
            Browse
          </Button>
        </div>

        {folders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {folders.map(({ folder, count }) => (
              <button
                key={folder}
                type="button"
                onClick={() => void loadFolder(folder)}
                className="rounded-md border border-border px-2 py-1 font-mono text-xs text-foreground hover:bg-accent"
              >
                {folder || '/'} <span className="text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Local intake ──────────────────────────────────────────────── */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target is
            not a control; the same files are reachable through the two buttons
            inside it, so nothing here is keyboard-only-inaccessible. */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
        >
          <span>Drop .v files here, or</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="underline hover:text-foreground"
          >
            choose files
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="underline hover:text-foreground"
          >
            a folder
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void readLocalFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error non-standard, but the only way to pick a directory
          webkitdirectory=""
          className="hidden"
          onChange={(e) => void readLocalFiles(e.target.files)}
        />

        {/* ── The project ───────────────────────────────────────────────── */}
        {files.length > 0 ? (
          <div className="rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border px-2 py-1 text-xs text-muted-foreground">
              <span>
                {files.length} files · {formatBytes(totalBytes)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setChosenTop(null);
                }}
                className="hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {files.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-2 px-2 py-0.5 font-mono text-xs text-foreground"
                >
                  <span className="w-14 shrink-0 text-muted-foreground">{f.role}</span>
                  <span className="flex-1 truncate">{f.path}</span>
                  <button
                    type="button"
                    title={`Remove ${f.path}`}
                    onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <textarea
            value={verilog}
            onChange={(e) => {
              setVerilog(e.target.value);
            }}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="min-h-[180px] w-full flex-1 resize-none rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        {/* ── Top module ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label htmlFor="verilog-import-top" className="whitespace-nowrap">
            Top module
          </label>
          {topCandidates.length > 1 ? (
            <select
              id="verilog-import-top"
              value={top}
              onChange={(e) => setChosenTop(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {topCandidates.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="verilog-import-top"
              value={top}
              onChange={(e) => setChosenTop(e.target.value)}
              placeholder="top"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>

        {/* ── Parameters ────────────────────────────────────────────────── */}
        {params.length > 0 && (
          <details
            className="rounded-md border border-border"
            open={params.some(looksLikeFirmware)}
          >
            <summary className="cursor-pointer px-2 py-1 text-xs text-muted-foreground">
              Parameters of {top} ({params.length})
            </summary>
            <div className="space-y-1 px-2 pb-2">
              {params.map((p) => {
                const firmware = looksLikeFirmware(p);
                const bound = firmware ? matchFirmware(p.defaultValue, dataFiles) : undefined;
                return (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate font-mono text-muted-foreground">
                      {p.name}
                    </span>
                    {firmware && dataFiles.length > 0 ? (
                      <select
                        value={paramValue(p)}
                        onChange={(e) => setParamValue(p.name, e.target.value)}
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
                      >
                        {bound === undefined && (
                          <option value={p.defaultValue}>{p.defaultValue}</option>
                        )}
                        {dataFiles.map((f) => (
                          <option key={f.path} value={f.path}>
                            {f.path}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={paramValue(p)}
                        disabled={p.kind === 'expression'}
                        onChange={(e) => setParamValue(p.name, e.target.value)}
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground disabled:opacity-50"
                      />
                    )}
                    {firmware && bound === undefined && tree && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 text-xs"
                        onClick={() => void fetchFirmware(p)}
                      >
                        Find in repo
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {status.kind === 'error' && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
            {status.message}
            {status.unsupported && (
              <p className="mt-1 text-muted-foreground">
                This design uses a cell the importer doesn't handle yet (e.g. a register with reset
                or clock-enable). Try a simpler module for now.
              </p>
            )}
          </div>
        )}

        {status.kind === 'warned' && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-medium">Imported with warnings:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {status.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-muted-foreground">
              The source is in the editor; these are usually undeclared or misspelled signals in the
              Verilog.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {loading && (
            <span className="mr-auto text-xs text-muted-foreground">{status.message}</span>
          )}
          <SheetClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            onClick={handleImport}
            size="sm"
            disabled={loading || !canImport}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Working…' : 'Import'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

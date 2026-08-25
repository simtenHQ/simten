/**
 * cc65 WASM Compiler: compiles C source to 6502 binary in the browser.
 *
 * Pipeline: cc65 (C → asm) → ca65 (asm → .o) → ld65 (.o → .bin)
 *
 * Each tool runs in a fresh WASM module instance (globals aren't reset).
 * Support files (crt0-simple.o, sim6502.cfg) are fetched once and cached.
 */

export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export interface CompileResult {
  success: boolean;
  binary: Uint8Array | null;
  errors: string[];
  stages: {
    cc65: StageStatus;
    ca65: StageStatus;
    ld65: StageStatus;
  };
}

interface EmscriptenModule {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, data: string | Uint8Array): void;
    readFile(path: string, opts?: { encoding?: string }): Uint8Array;
    mkdir(path: string): void;
  };
}

type ModuleFactory = (opts: {
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  locateFile?: (path: string) => string;
}) => Promise<EmscriptenModule>;

const WASM_BASE = '/blog-assets/wasm';

// Cached support files
let crt0Promise: Promise<Uint8Array> | null = null;
let cfgPromise: Promise<string> | null = null;
let longbranchPromise: Promise<string> | null = null;

function fetchCrt0(): Promise<Uint8Array> {
  if (!crt0Promise) {
    crt0Promise = fetch(`${WASM_BASE}/crt0-simple.o`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch crt0-simple.o: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => new Uint8Array(buf));
  }
  return crt0Promise;
}

function fetchCfg(): Promise<string> {
  if (!cfgPromise) {
    cfgPromise = fetch(`${WASM_BASE}/sim6502.cfg`).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch sim6502.cfg: ${r.status}`);
      return r.text();
    });
  }
  return cfgPromise;
}

function fetchLongbranch(): Promise<string> {
  if (!longbranchPromise) {
    longbranchPromise = fetch(`${WASM_BASE}/longbranch.mac`).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch longbranch.mac: ${r.status}`);
      return r.text();
    });
  }
  return longbranchPromise;
}

async function loadFactory(tool: string): Promise<ModuleFactory> {
  const globalName = `create_${tool}`;

  if (typeof (globalThis as Record<string, unknown>)[globalName] === 'function') {
    return (globalThis as Record<string, unknown>)[globalName] as ModuleFactory;
  }

  return new Promise<ModuleFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${WASM_BASE}/${tool}.js`;
    script.onload = () => {
      const factory = (globalThis as Record<string, unknown>)[globalName];
      if (typeof factory === 'function') {
        resolve(factory as ModuleFactory);
      } else {
        reject(new Error(`Factory ${globalName} not found after loading script`));
      }
    };
    script.onerror = () => reject(new Error(`Failed to load ${tool}.js`));
    document.head.appendChild(script);
  });
}

/** Pre-load all WASM factory scripts (call when user enters edit mode). */
export async function preloadWasm(): Promise<void> {
  await Promise.all([
    loadFactory('cc65'),
    loadFactory('ca65'),
    loadFactory('ld65'),
    fetchCrt0(),
    fetchCfg(),
    fetchLongbranch(),
  ]);
}

function callMain(mod: EmscriptenModule, args: string[], stderr: string[]): number {
  try {
    return mod.callMain(args);
  } catch (e: unknown) {
    // Emscripten throws on exit(); extract status code if available
    if (e && typeof e === 'object' && 'status' in e) {
      return (e as { status: number }).status;
    }
    stderr.push(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

export async function compileC(
  sourceCode: string,
  onStageChange?: (stages: CompileResult['stages']) => void,
): Promise<CompileResult> {
  const stages: CompileResult['stages'] = {
    cc65: 'pending',
    ca65: 'pending',
    ld65: 'pending',
  };

  const updateStage = (tool: 'cc65' | 'ca65' | 'ld65', status: StageStatus) => {
    stages[tool] = status;
    onStageChange?.({ ...stages });
  };

  // Prefetch support files in parallel
  const [crt0Bytes, cfgText, longbranchText] = await Promise.all([
    fetchCrt0(),
    fetchCfg(),
    fetchLongbranch(),
  ]);

  // --- Step 1: cc65 (C → assembly) ---
  updateStage('cc65', 'running');

  const cc65Factory = await loadFactory('cc65');
  const cc65Stderr: string[] = [];
  const cc65Mod = await cc65Factory({
    print: () => {},
    printErr: (t: string) => cc65Stderr.push(t),
    locateFile: (path: string) => `${WASM_BASE}/${path}`,
  });

  cc65Mod.FS.writeFile('/input.c', sourceCode);
  const cc65Code = callMain(
    cc65Mod,
    ['-t', 'none', '-O', '/input.c', '-o', '/output.s'],
    cc65Stderr,
  );

  if (cc65Code !== 0) {
    updateStage('cc65', 'error');
    return {
      success: false,
      binary: null,
      errors: cc65Stderr.length > 0 ? cc65Stderr : ['cc65 compilation failed'],
      stages,
    };
  }

  const asmBytes = cc65Mod.FS.readFile('/output.s');
  updateStage('cc65', 'done');

  // --- Step 2: ca65 (assembly → object) ---
  updateStage('ca65', 'running');

  const ca65Factory = await loadFactory('ca65');
  const ca65Stderr: string[] = [];
  const ca65Mod = await ca65Factory({
    print: () => {},
    printErr: (t: string) => ca65Stderr.push(t),
    locateFile: (path: string) => `${WASM_BASE}/${path}`,
  });

  ca65Mod.FS.writeFile('/output.s', asmBytes);
  // Provide longbranch.mac (needed when cc65 uses -O optimization)
  ca65Mod.FS.mkdir('/asminc');
  ca65Mod.FS.writeFile('/asminc/longbranch.mac', longbranchText);
  const ca65Code = callMain(
    ca65Mod,
    ['-t', 'none', '-I', '/asminc', '/output.s', '-o', '/output.o'],
    ca65Stderr,
  );

  if (ca65Code !== 0) {
    updateStage('ca65', 'error');
    return {
      success: false,
      binary: null,
      errors: ca65Stderr.length > 0 ? ca65Stderr : ['ca65 assembly failed'],
      stages,
    };
  }

  const objBytes = ca65Mod.FS.readFile('/output.o');
  updateStage('ca65', 'done');

  // --- Step 3: ld65 (object + crt0 → binary) ---
  updateStage('ld65', 'running');

  const ld65Factory = await loadFactory('ld65');
  const ld65Stderr: string[] = [];
  const ld65Mod = await ld65Factory({
    print: () => {},
    printErr: (t: string) => ld65Stderr.push(t),
    locateFile: (path: string) => `${WASM_BASE}/${path}`,
  });

  ld65Mod.FS.writeFile('/output.o', objBytes);
  ld65Mod.FS.writeFile('/crt0-simple.o', crt0Bytes);
  ld65Mod.FS.writeFile('/sim6502.cfg', cfgText);

  const ld65Code = callMain(
    ld65Mod,
    ['-C', '/sim6502.cfg', '-o', '/output.bin', '/crt0-simple.o', '/output.o'],
    ld65Stderr,
  );

  if (ld65Code !== 0) {
    updateStage('ld65', 'error');
    return {
      success: false,
      binary: null,
      errors: ld65Stderr.length > 0 ? ld65Stderr : ['ld65 linking failed'],
      stages,
    };
  }

  const binary = ld65Mod.FS.readFile('/output.bin');
  updateStage('ld65', 'done');

  return { success: true, binary, errors: [], stages };
}

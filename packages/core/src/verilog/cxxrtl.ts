/**
 * Fast simulation through Yosys CXXRTL (#593): a C++ harness for a circuit's
 * exported Verilog, and a loader for the WebAssembly it compiles to.
 *
 * The build, which needs Yosys and Emscripten, is:
 *
 *   yosys -p 'read_verilog design.v; hierarchy -top <Top>; proc; write_cxxrtl design.cc'
 *   em++ -O3 -std=c++17 -I<cxxrtl runtime> harness.cc -o sim.wasm \
 *     --no-entry -sSTANDALONE_WASM -sALLOW_MEMORY_GROWTH -sEXPORTED_FUNCTIONS=...
 *
 * Only `proc` before `write_cxxrtl`: Yosys `opt` makes the result slower, and
 * on the NES board it changed what the design does.
 *
 * The harness is C with a handful of exports (`HARNESS_EXPORTS`). One tick is
 * one rising clock edge, stepped once: the falling edge does nothing in an
 * exported circuit, so the harness holds the clock high and resets CXXRTL's
 * record of the previous level instead of evaluating twice. The outputs are
 * brought up to date once per `sim_tick`, not per tick. Ports and
 * memories are addressed by their index in the manifest. Values are up to 32
 * bits.
 *
 * A video sink, if given, makes `sim_tick` store `data` at `y * width + x` in
 * a byte buffer on every tick where `we` is high, so a frame costs no calls
 * across the JS boundary. An audio sink averages an output port over every
 * `ticksPerSample` ticks (fractional, so any sample rate works) into a buffer
 * of 16-bit samples, which `audio()` takes.
 */

/** A top-level port of the exported module. */
export interface CxxrtlPort {
  name: string;
  width: number;
  direction: 'input' | 'output';
}

/** A memory (`reg [w-1:0] mem_<node> [0:d-1]`), by its node path in Verilog form. */
export interface CxxrtlMemory {
  name: string;
  width: number;
  depth: number;
}

/** What the harness exposes, in index order. */
export interface CxxrtlManifest {
  top: string;
  ports: CxxrtlPort[];
  memories: CxxrtlMemory[];
  video?: CxxrtlVideo;
  audio?: CxxrtlAudio;
}

/** Output ports that make a picture: pixel (`x`, `y`) is `data` when `we` is high. */
export interface CxxrtlVideo {
  we: string;
  x: string;
  y: string;
  data: string;
  width: number;
  height: number;
}

/** An output port to sample as sound: one sample, its average, every `ticksPerSample` ticks. */
export interface CxxrtlAudio {
  data: string;
  ticksPerSample: number;
}

/** Samples the audio sink holds between `audio()` calls; later ones are dropped. */
const AUDIO_BUFFER = 16384;

/** The C functions the harness defines; pass them to `-sEXPORTED_FUNCTIONS`. */
export const HARNESS_EXPORTS = [
  'sim_init',
  'sim_tick',
  'sim_set',
  'sim_get',
  'sim_mem_write',
  'sim_mem_read',
  'sim_video',
  'sim_audio',
  'sim_audio_take',
] as const;

const CLOCK = 'clk';
const RESET = 'rst_n';

/** CXXRTL's C++ name for a Verilog identifier: `p_` and every `_` doubled. */
const mangle = (id: string) => `p_${id.replace(/_/g, '__')}`;

/** Throws unless the sinks' ports are outputs of the module. */
function checkSinks(ports: CxxrtlPort[], video?: CxxrtlVideo, audio?: CxxrtlAudio) {
  const output = (name: string) => ports.some((q) => q.name === name && q.direction === 'output');
  for (const p of video ? [video.we, video.x, video.y, video.data] : []) {
    if (!output(p)) throw new Error(`cxxrtl: video port ${p} is not an output`);
  }
  if (audio && !output(audio.data)) {
    throw new Error(`cxxrtl: audio port ${audio.data} is not an output`);
  }
  if (audio && !(audio.ticksPerSample >= 1)) {
    throw new Error('cxxrtl: audio ticksPerSample must be at least 1');
  }
}

/** The ports and memories of an exported module, read from its declarations. */
export function cxxrtlManifest(
  verilog: string,
  video?: CxxrtlVideo,
  audio?: CxxrtlAudio,
): CxxrtlManifest {
  const header = /^module\s+(\w+)\s*\(([\s\S]*?)\);/m.exec(verilog);
  if (!header) throw new Error('cxxrtl: no module header in the Verilog');
  const ports: CxxrtlPort[] = [];
  for (const m of header[2].matchAll(
    /(input|output)\s+(?:wire\s+|reg\s+)?(?:\[(\d+):0\]\s*)?(\w+)/g,
  )) {
    const name = m[3];
    if (name === CLOCK || name === RESET) continue;
    const width = m[2] === undefined ? 1 : Number(m[2]) + 1;
    if (width > 32)
      throw new Error(`cxxrtl: port ${name} is ${width} bits; the harness handles 32`);
    ports.push({ name, width, direction: m[1] as CxxrtlPort['direction'] });
  }
  const memories: CxxrtlMemory[] = [];
  for (const m of verilog.matchAll(/^\s*reg\s+(?:\[(\d+):0\]\s*)?mem_(\w+)\s*\[0:(\d+)\];/gm)) {
    const width = m[1] === undefined ? 1 : Number(m[1]) + 1;
    if (width > 32)
      throw new Error(`cxxrtl: memory ${m[2]} is ${width} bits wide; the harness handles 32`);
    memories.push({ name: m[2], width, depth: Number(m[3]) + 1 });
  }
  checkSinks(ports, video, audio);
  return {
    top: header[1],
    ports,
    memories,
    ...(video ? { video } : {}),
    ...(audio ? { audio } : {}),
  };
}

const AUDIO_DECLS = `static uint16_t audio_buf[${AUDIO_BUFFER}];
static uint32_t audio_count, audio_n;
static uint64_t audio_sum;
static double audio_phase;`;

/** The audio sink's per-tick C++: accumulate, and emit a sample every ticksPerSample. */
function audioSample(audio: CxxrtlAudio): string {
  return `    audio_sum += top->${mangle(audio.data)}.get<uint32_t>();
    audio_n++;
    audio_phase += 1.0;
    if (audio_phase >= ${audio.ticksPerSample}) {
      audio_phase -= ${audio.ticksPerSample};
      if (audio_count < ${AUDIO_BUFFER}u) audio_buf[audio_count++] = (uint16_t)(audio_sum / audio_n);
      audio_sum = 0;
      audio_n = 0;
    }
`;
}

/**
 * The C++ harness for `manifest`, to compile together with the CXXRTL output
 * included from `design` (default `design.cc`).
 */
export function cxxrtlHarness(manifest: CxxrtlManifest, design = 'design.cc'): string {
  const { top, ports, memories, video, audio } = manifest;
  const cls = `cxxrtl_design::${mangle(top)}`;
  const inputs = ports.map((p, i) => [p, i] as const).filter(([p]) => p.direction === 'input');
  const setCases = inputs
    .map(([p, i]) => `    case ${i}: top->${mangle(p.name)}.set<uint32_t>(v); break;`)
    .join('\n');
  const getCases = ports
    .map((p, i) => `    case ${i}: return top->${mangle(p.name)}.get<uint32_t>();`)
    .join('\n');
  const mem = (i: number) => `top->memory_${mangle(`mem_${memories[i].name}`)}`;
  const writeCases = memories
    .map(
      (m, i) =>
        `    case ${i}: if (addr < ${m.depth}u) ${mem(i)}[addr] = value<${m.width}>{v}; break;`,
    )
    .join('\n');
  const readCases = memories
    .map(
      (m, i) => `    case ${i}: return addr < ${m.depth}u ? ${mem(i)}[addr].get<uint32_t>() : 0;`,
    )
    .join('\n');
  const capture = video
    ? `    if (top->${mangle(video.we)}.get<uint32_t>()) {
      uint32_t x = top->${mangle(video.x)}.get<uint32_t>();
      uint32_t y = top->${mangle(video.y)}.get<uint32_t>();
      if (x < ${video.width}u && y < ${video.height}u)
        frame[y * ${video.width}u + x] = (uint8_t)top->${mangle(video.data)}.get<uint32_t>();
    }
`
    : '';
  const sample = audio ? audioSample(audio) : '';
  return `// Generated by @simten/core cxxrtlHarness. Do not edit.
#include <cstdint>
#include "${design}"

using namespace cxxrtl_yosys;

static ${cls} *top;
${video ? `static uint8_t frame[${video.width * video.height}];` : ''}
${audio ? AUDIO_DECLS : ''}

// The clock is held high; each tick tells CXXRTL it was low, then steps.
// 'was' sets CXXRTL's record of the clock's last level: 0 makes the next
// step a rising edge, 1 makes it a plain settle.
template <typename T>
static auto was(T *t, uint32_t level, int) -> decltype(t->prev_p_clk, void()) {
  t->prev_p_clk = value<1>{level};
}
template <typename T>
static void was(T *, uint32_t, long) {}
template <typename T>
static auto hold(T *t, int) -> decltype(t->p_clk, void()) { t->p_clk.set(true); }
template <typename T>
static void hold(T *, long) {}
template <typename T>
static auto unreset(T *t, int) -> decltype(t->p_rst__n, void()) { t->p_rst__n.set(true); }
template <typename T>
static void unreset(T *, long) {}

extern "C" {

void sim_init() {
  delete top;
  top = new ${cls};
  unreset(top, 0);
  hold(top, 0);
  was(top, 1u, 0);
  top->step();
}

// A step evaluates, then commits the clock edge, so afterwards the outputs
// still show the state before the edge: one tick behind. That is the state the
// video sink wants, the pixel of the dot just clocked. One more step at the
// end brings the outputs up to date for sim_get.
void sim_tick(uint32_t n) {
  for (uint32_t i = 0; i < n; i++) {
    was(top, 0u, 0);
    top->step();
${capture}${sample}  }
  top->step();
}

void sim_set(uint32_t port, uint32_t v) {
  switch (port) {
${setCases}
  }
  top->step();
}

uint32_t sim_get(uint32_t port) {
  switch (port) {
${getCases}
  }
  return 0;
}

void sim_mem_write(uint32_t m, uint32_t addr, uint32_t v) {
  switch (m) {
${writeCases}
  }
}

uint32_t sim_mem_read(uint32_t m, uint32_t addr) {
  switch (m) {
${readCases}
  }
  return 0;
}

uint8_t *sim_video() { return ${video ? 'frame' : 'nullptr'}; }

uint16_t *sim_audio() { return ${audio ? 'audio_buf' : 'nullptr'}; }

// The samples since the last call; the next ones start again at the front.
uint32_t sim_audio_take() {
${audio ? '  uint32_t n = audio_count;\n  audio_count = 0;\n  return n;' : '  return 0;'}
}

}
`;
}

/** A running compiled circuit: the `simulate()` calls that matter for speed. */
export interface CxxrtlSim {
  set(values: Record<string, number>): void;
  get(port: string): number;
  tick(n?: number): void;
  writeMemory(name: string, bytes: ArrayLike<number>, at?: number): void;
  readMemory(name: string, at: number, length: number): number[];
  /** The video sink's frame buffer, live: one byte per pixel, row by row. */
  video(): Uint8Array | undefined;
  /** The audio sink's samples since the last call, copied out. */
  audio(): Uint16Array | undefined;
}

interface HarnessExports {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  sim_init(): void;
  sim_tick(n: number): void;
  sim_set(port: number, v: number): void;
  sim_get(port: number): number;
  sim_mem_write(m: number, addr: number, v: number): void;
  sim_mem_read(m: number, addr: number): number;
  sim_video(): number;
  sim_audio(): number;
  sim_audio_take(): number;
}

/**
 * Instantiates a harness built with `-sSTANDALONE_WASM`. Its WASI imports are
 * stubbed: the harness never does I/O, and an abort throws.
 */
export async function loadCxxrtl(
  wasm: BufferSource | WebAssembly.Module,
  manifest: CxxrtlManifest,
): Promise<CxxrtlSim> {
  const module = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
  const imports: Record<string, Record<string, () => number>> = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    imports[imp.module] ??= {};
    imports[imp.module][imp.name] = () => {
      if (imp.name === 'proc_exit' || imp.name.includes('abort')) {
        throw new Error(`cxxrtl: the compiled circuit aborted (${imp.name})`);
      }
      return 0;
    };
  }
  const instance = await WebAssembly.instantiate(module, imports);
  const x = instance.exports as unknown as HarnessExports;
  x._initialize?.();
  x.sim_init();

  const portIndex = new Map(manifest.ports.map((p, i) => [p.name, i]));
  const memIndex = new Map(manifest.memories.map((m, i) => [m.name, i]));
  const port = (name: string) => {
    const i = portIndex.get(name);
    if (i === undefined) throw new Error(`cxxrtl: no port ${name}`);
    return i;
  };
  const mem = (name: string) => {
    const i = memIndex.get(name);
    if (i === undefined) throw new Error(`cxxrtl: no memory ${name}`);
    return i;
  };
  const { video, audio } = manifest;
  return {
    set(values) {
      for (const [name, v] of Object.entries(values)) {
        if (manifest.ports[port(name)].direction !== 'input')
          throw new Error(`cxxrtl: ${name} is an output`);
        x.sim_set(port(name), v >>> 0);
      }
    },
    get: (name) => x.sim_get(port(name)) >>> 0,
    tick: (n = 1) => x.sim_tick(n),
    writeMemory(name, bytes, at = 0) {
      const m = mem(name);
      for (let i = 0; i < bytes.length; i++) x.sim_mem_write(m, at + i, bytes[i]);
    },
    readMemory(name, at, length) {
      const m = mem(name);
      return Array.from({ length }, (_, i) => x.sim_mem_read(m, at + i));
    },
    video: () =>
      video
        ? new Uint8Array(x.memory.buffer, x.sim_video(), video.width * video.height)
        : undefined,
    audio: () => {
      if (!audio) return undefined;
      const n = x.sim_audio_take();
      return new Uint16Array(x.memory.buffer, x.sim_audio(), n).slice();
    },
  };
}

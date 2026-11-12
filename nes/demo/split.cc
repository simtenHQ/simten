// The NES's two sides as two CXXRTL models (halves.ts), stepped at their own
// rates: the CPU side once per CPU cycle, the PPU side on every dot. It has
// the same exports as @simten/core's cxxrtlHarness, so the page loads it with
// loadCxxrtl like any other build, and build.ts writes a manifest to match.
//
// Built by build.ts with the two models' C++ in cpu.cc (namespace cpu_ns)
// and ppu.cc (namespace ppu_ns).
//
// A CPU cycle, on the tick M2 is high:
//   1. NMI: the PPU's vblank flag AND PPUCTRL bit 7, read from its registers.
//   2. Evaluate the CPU side's clock edge. That also gives this cycle's bus.
//   3. Clock the PPU side with that bus. Its evaluation gives the byte it
//      drives for a register read.
//   4. If the cycle addressed the PPU, evaluate the CPU's edge again with that
//      byte (a few hundred cycles a frame); otherwise it didn't matter. Commit.
// The other two ticks clock the PPU side alone.
//
// Video and audio are taken as the single-model harness takes them, so a run
// matches `Nes` exactly (build.ts --check).

#include <cstdint>
#include "cpu.cc"
#include "ppu.cc"

static cpu_ns::p_NesCpuHalf *cpu;
static ppu_ns::p_NesPpuHalf *ppu;
static int phase;  // 0 on the tick a CPU cycle completes
static bool started;

static uint8_t frame[61440];
static uint16_t audio_buf[16384];
static uint32_t audio_count, audio_n;
static uint64_t audio_sum;
static double audio_phase;

template <typename T> static void edge(T *t) {
  t->prev_p_clk = cxxrtl::value<1>{0u};
  t->step();
}
template <typename T> static void settle(T *t) {
  t->prev_p_clk = cxxrtl::value<1>{1u};
  t->step();
}

// One audio sample per AUDIO_TICKS ticks (fractional), the mean of `audio`.
static void sample(uint32_t a) {
  audio_sum += a;
  audio_n++;
  audio_phase += 1.0;
  if (audio_phase >= AUDIO_TICKS) {
    audio_phase -= AUDIO_TICKS;
    if (audio_count < 16384u) audio_buf[audio_count++] = (uint16_t)(audio_sum / audio_n);
    audio_sum = 0;
    audio_n = 0;
  }
}

// After a clock edge the outputs still show the dot just clocked.
static void video() {
  if (ppu->p_video__we.get<uint32_t>()) {
    uint32_t x = ppu->p_video__x.get<uint32_t>(), y = ppu->p_video__y.get<uint32_t>();
    if (x < 256u && y < 240u) frame[y * 256u + x] = (uint8_t)ppu->p_color.get<uint32_t>();
  }
}

static void tick() {
  if (phase == 0) {
    uint32_t nmi = ppu->p_reg__ppu__regs__vbl.curr.get<uint32_t>() &
                   (ppu->p_reg__ppu__regs__ctrl.curr.get<uint32_t>() >> 7);
    cpu->p_nmi.set<uint32_t>(nmi);
    cpu->prev_p_clk = cxxrtl::value<1>{0u};
    cpu->eval();
    // `audio` changes only on CPU cycles: this value is the last two ticks
    // of the previous cycle and the first of this one.
    uint32_t a = cpu->p_audio.get<uint32_t>();
    if (started) {
      sample(a);
      sample(a);
    }
    sample(a);
    started = true;
    uint32_t cs = cpu->p_ppu__cs.get<uint32_t>();
    ppu->p_cs.set<uint32_t>(cs);
    ppu->p_addr.set<uint32_t>(cpu->p_ppu__addr.get<uint32_t>());
    ppu->p_rw.set<uint32_t>(cpu->p_rw.get<uint32_t>());
    ppu->p_data__in.set<uint32_t>(cpu->p_wdata.get<uint32_t>());
    edge(ppu);
    if (cs) {
      cpu->p_ppu__data.set<uint32_t>(ppu->p_data__out.get<uint32_t>());
      cpu->eval();
    }
    cpu->commit();
    ppu->p_cs.set<uint32_t>(0);
  } else {
    edge(ppu);
  }
  video();
  phase = phase == 2 ? 0 : phase + 1;
}

extern "C" {

void sim_init() {
  delete cpu;
  delete ppu;
  cpu = new cpu_ns::p_NesCpuHalf;
  ppu = new ppu_ns::p_NesPpuHalf;
  cpu->p_rst__n.set(true);
  cpu->p_clk.set(true);
  ppu->p_rst__n.set(true);
  ppu->p_clk.set(true);
  settle(cpu);
  settle(ppu);
  phase = 0;
  started = false;
}

// The PPU's outputs are brought up to date at the end, for sim_get.
void sim_tick(uint32_t n) {
  for (uint32_t i = 0; i < n; i++) tick();
  ppu->prev_p_clk = cxxrtl::value<1>{1u};
  ppu->eval();
}

// Ports, as in the manifest build.ts writes.
enum { PAD1, PAD2, VIDEO_X, VIDEO_Y, VIDEO_WE, COLOR, AUDIO };

void sim_set(uint32_t port, uint32_t v) {
  if (port == PAD1) cpu->p_pad1.set<uint32_t>(v);
  if (port == PAD2) cpu->p_pad2.set<uint32_t>(v);
  settle(cpu);
}

uint32_t sim_get(uint32_t port) {
  switch (port) {
    case PAD1: return cpu->p_pad1.get<uint32_t>();
    case PAD2: return cpu->p_pad2.get<uint32_t>();
    case VIDEO_X: return ppu->p_video__x.get<uint32_t>();
    case VIDEO_Y: return ppu->p_video__y.get<uint32_t>();
    case VIDEO_WE: return ppu->p_video__we.get<uint32_t>();
    case COLOR: return ppu->p_color.get<uint32_t>();
    case AUDIO: return cpu->p_audio.get<uint32_t>();
  }
  return 0;
}

// Memories, as in the manifest: cart_prg, cart_chr, console_ram.
void sim_mem_write(uint32_t m, uint32_t addr, uint32_t v) {
  if (m == 0 && addr < 65536u) cpu->memory_p_mem__cart__prg[addr] = cxxrtl::value<8>{v};
  if (m == 1 && addr < 65536u) ppu->memory_p_mem__cart__chr[addr] = cxxrtl::value<8>{v};
  if (m == 2 && addr < 2048u) cpu->memory_p_mem__ram[addr] = cxxrtl::value<8>{v};
}

uint32_t sim_mem_read(uint32_t m, uint32_t addr) {
  if (m == 0 && addr < 65536u) return cpu->memory_p_mem__cart__prg[addr].get<uint32_t>();
  if (m == 1 && addr < 65536u) return ppu->memory_p_mem__cart__chr[addr].get<uint32_t>();
  if (m == 2 && addr < 2048u) return cpu->memory_p_mem__ram[addr].get<uint32_t>();
  return 0;
}

uint8_t *sim_video() { return frame; }

uint16_t *sim_audio() { return audio_buf; }

// The samples since the last call; the next ones start again at the front.
uint32_t sim_audio_take() {
  uint32_t n = audio_count;
  audio_count = 0;
  return n;
}
}

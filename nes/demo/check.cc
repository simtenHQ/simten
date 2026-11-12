// For build.ts --check: runs a ROM for 600 frames, pressing Start and then
// Right and A in bursts, and prints hashes of every frame's video and all the
// audio. Linked once against the split harness and once against the
// single-model one; the two must print the same.
//
//   check <rom.nes> <prg memory index> <chr memory index> <pad1 port index>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>

extern "C" {
void sim_init();
void sim_tick(uint32_t);
void sim_set(uint32_t, uint32_t);
void sim_mem_write(uint32_t, uint32_t, uint32_t);
uint8_t *sim_video();
uint16_t *sim_audio();
uint32_t sim_audio_take();
}

int main(int argc, char **argv) {
  if (argc != 5) return 2;
  FILE *f = fopen(argv[1], "rb");
  if (!f) return 2;
  std::vector<uint8_t> rom(16 + 0x8000 + 0x2000);
  size_t got = fread(rom.data(), 1, rom.size(), f);
  fclose(f);
  uint32_t prg = rom[4] * 0x4000, chr = rom[5] * 0x2000;
  if (got < 16 + prg + chr) return 2;
  uint32_t mprg = atoi(argv[2]), mchr = atoi(argv[3]), pad1 = atoi(argv[4]);
  sim_init();
  for (uint32_t i = 0; i < prg; i++) sim_mem_write(mprg, i, rom[16 + i]);
  for (uint32_t i = 0; i < chr; i++) sim_mem_write(mchr, i, rom[16 + prg + i]);
  uint64_t vh = 1469598103934665603ull, ah = vh;
  for (int fr = 0; fr < 600; fr++) {
    uint32_t pad = fr >= 100 && fr < 104 ? 0x08 : fr > 200 ? ((fr / 20) % 2 ? 0x81 : 0x80) : 0;
    sim_set(pad1, pad);
    sim_tick(89342);
    uint8_t *v = sim_video();
    for (int i = 0; i < 61440; i++) vh = (vh ^ v[i]) * 1099511628211ull;
    uint32_t n = sim_audio_take();
    uint16_t *a = sim_audio();
    for (uint32_t i = 0; i < n; i++) ah = (ah ^ a[i]) * 1099511628211ull;
  }
  printf("video %016llx audio %016llx\n", (unsigned long long)vh, (unsigned long long)ah);
}

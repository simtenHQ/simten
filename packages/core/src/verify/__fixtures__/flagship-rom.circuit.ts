// "Hardware artifact": a ROM preloaded with the first 4 bytes of sha256("").
// Hardcoded here as if produced offline; the testbench checks it against the
// real npm sha256 reference — an independent Tier-A oracle (if a byte were
// wrong, verify would catch it).
import { bus, circuit } from '@simten/core/circuit';
import { ROM, romFromBytes } from '@simten/core/std';

export const HashRom = circuit('HashRom', {
  inputs: { addr: bus(16) },
  outputs: { data: bus(8) },
  nodes: { rom: ROM({ memory: romFromBytes([0xe3, 0xb0, 0xc4, 0x42]) }) },
  connect: ({ inputs, outputs, nodes: { rom } }) => [
    inputs.addr.to(rom.addr),
    rom.data_out.to(outputs.data),
  ],
});

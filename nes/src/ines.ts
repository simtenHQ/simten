/**
 * iNES file loader. Splits a `.nes` file into its PRG and CHR ROMs and reads
 * the header flags a board needs. NES 2.0 headers are read through their
 * iNES 1 fields (plus the extra mapper bits); the NES 2.0 size extensions are
 * rejected because the iNES 1 sizes would be wrong.
 *
 * Header (16 bytes):
 *   0-3  "NES" 0x1A
 *   4    PRG ROM size in 16 KB units
 *   5    CHR ROM size in 8 KB units (0: the board has CHR RAM)
 *   6    mirroring (bit 0: 1 vertical), battery (bit 1), trainer (bit 2),
 *        four-screen (bit 3), mapper low nibble (bits 4-7)
 *   7    NES 2.0 marker (bits 2-3 == 2), mapper high nibble (bits 4-7)
 *   8    NES 2.0: mapper bits 8-11
 *   9    NES 2.0: PRG/CHR size high bits
 */

export interface INesRom {
  prg: Uint8Array;
  chr: Uint8Array;
  mapper: number;
  mirroring: 'horizontal' | 'vertical';
  battery: boolean;
  trainer?: Uint8Array;
}

const HEADER = 16;
const TRAINER = 512;
const PRG_UNIT = 16 * 1024;
const CHR_UNIT = 8 * 1024;

export function parseINes(bytes: Uint8Array): INesRom {
  if (bytes.length < HEADER) {
    throw new Error(`iNES: file is ${bytes.length} bytes, shorter than the 16-byte header`);
  }
  if (bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new Error('iNES: missing the "NES\\x1A" magic at the start of the file');
  }

  const flags6 = bytes[6];
  const flags7 = bytes[7];
  const nes2 = (flags7 & 0x0c) === 0x08;

  if (nes2 && bytes[9] !== 0) {
    throw new Error('iNES: NES 2.0 PRG/CHR size extensions (byte 9) are not supported');
  }
  if (flags6 & 0x08) {
    throw new Error('iNES: four-screen VRAM is not supported');
  }

  // Old dumpers wrote text into bytes 7-15 ("DiskDude!"). If an iNES 1 header
  // has junk past byte 11, byte 7 is junk too, so its mapper nibble is ignored.
  const junk = !nes2 && (bytes[12] | bytes[13] | bytes[14] | bytes[15]) !== 0;
  let mapper = flags6 >> 4;
  if (!junk) mapper |= flags7 & 0xf0;
  if (nes2) mapper |= (bytes[8] & 0x0f) << 8;

  const prgSize = bytes[4] * PRG_UNIT;
  const chrSize = bytes[5] * CHR_UNIT;
  if (prgSize === 0) throw new Error('iNES: PRG ROM size is 0');

  const hasTrainer = (flags6 & 0x04) !== 0;
  const prgStart = HEADER + (hasTrainer ? TRAINER : 0);
  const chrStart = prgStart + prgSize;
  const end = chrStart + chrSize;
  if (bytes.length < end) {
    throw new Error(
      `iNES: file is ${bytes.length} bytes, but the header says ${end} ` +
        `(${bytes[4]} x 16 KB PRG, ${bytes[5]} x 8 KB CHR${hasTrainer ? ', trainer' : ''})`,
    );
  }

  return {
    prg: bytes.slice(prgStart, chrStart),
    chr: bytes.slice(chrStart, end),
    mapper,
    mirroring: flags6 & 0x01 ? 'vertical' : 'horizontal',
    battery: (flags6 & 0x02) !== 0,
    ...(hasTrainer ? { trainer: bytes.slice(HEADER, HEADER + TRAINER) } : {}),
  };
}

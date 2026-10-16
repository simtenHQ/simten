/**
 * Standard Library — MOS 6502 Components
 *
 * The combinational blocks of `MOS6502_Core` (see mos6502-cpu.ts). Block and
 * bus names follow the 6502 block diagram: the opcode table and the per-cycle
 * decode PLA, the ALU, and the four internal buses DB, SB, ADL and ADH.
 *
 * Every eval re-declares the small enums it uses. Evals are rebuilt from their
 * source text, so they cannot share module-level constants. The encodings below
 * must stay in step across the opcode table, the PLA and the bus selects; the
 * Tom Harte conformance tests catch any drift.
 *
 *   Addressing sequences: IMP 0, IMM 1, ZP 2, ZPX 3, ZPY 4, ABS 5, ABX 6,
 *     ABY 7, IZX 8, IZY 9, REL 10, JMP_ABS 11, JMP_IND 12, JSR 13, RTS 14,
 *     RTI 15, BRK 16, PUSH 17, PULL 18
 *   Access: READ 0, WRITE 1, RMW 2
 *   ALU op: ADD 0, SUB 1, AND 2, OR 3, EOR 4, SL 5, SR 6
 *   SB source: 0, A 1, X 2, Y 3, S 4, DL 5, PCL 6, PCH 7, ABL 8, ABH 9
 *   DB source: 0, DATA 1, DL 2
 *   ADL source: PCL 0, DL 1, DATA 2, ALU 3, S 4, VECTOR 5, ABL 6
 *   ADH source: PCH 0, DATA 1, ALU 2, $00 3, $01 4, $FF 5, ABH 6
 *   DOR source: A 0, X 1, Y 2, P 3, PCH 4, PCL 5, ALU 6, DATA 7
 *   Carry in: 0 0, 1 1, C 2
 *   Destination: none 0, A 1, X 2, Y 3, S 4, MEM 5, P 6
 *   Flags: none 0, NZ 1, NZC 2, NZCV 3, BIT 4
 *   Flag op: none 0, CLC 1, SEC 2, CLI 3, SEI 4, CLV 5, CLD 6, SED 7
 *
 * Bundles (bit offsets, low bit first):
 *   seq (opcode table): mode 0-4, access 5-6, branch condition 7-9
 *   exec (opcode table): ALU op 0-2, SB 3-6, DB 7, carry in 8-9, decimal 10,
 *     destination 11-13, flags 14-16, flag op 17-19, store source 20-22
 *   state (timing): T 0-2, acr 3, adir 4, interrupt pending 5, kind 6-7
 *   timing_ctrl: fetch 0, end 1, acr load 2, acr from branch 3, take interrupt 4
 *   pc_ctrl: increment 0, load 1
 *   bus_ctrl: ADL 0-2, ADH 3-5, SB 6-9, DB 10-11
 *   reg_ctrl: load A 0, X 1, Y 2, S 3
 *   p_ctrl: NZ 0, C 1, V 2, BIT 3, load from data 4, flag op 5-7
 *   latch_ctrl: DL load 0, write 1, DOR source 2-4, pushed B 5
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

/**
 * 6502 opcode table: maps an opcode to its addressing sequence and operation
 *
 * The first switch is the datasheet's opcode list, one line per documented
 * opcode. The second turns each mnemonic into the ALU operation, operand
 * sources, destination and flag updates that the PLA applies when the
 * instruction executes. Undocumented opcodes decode as 2-cycle NOPs.
 */
export const MOS6502_OpcodeTable = circuit('MOS6502_OpcodeTable', {
  inputs: { ir: bus(8) },
  outputs: { seq: bus(10), exec: bus(23) },
  meta: {
    category: 'mos6502',
    icon: 'OPC',
    description: '6502 opcode table: maps an opcode to its addressing sequence and operation',
  },
  eval: ({ ir }) => {
    const IMP = 0;
    const IMM = 1;
    const ZP = 2;
    const ZPX = 3;
    const ZPY = 4;
    const ABS = 5;
    const ABX = 6;
    const ABY = 7;
    const IZX = 8;
    const IZY = 9;
    const REL = 10;
    const JMP_ABS = 11;
    const JMP_IND = 12;
    const JSR_ABS = 13;
    const RTS_IMP = 14;
    const RTI_IMP = 15;
    const BRK_IMP = 16;
    const PUSH = 17;
    const PULL = 18;

    const ADC = 0;
    const AND = 1;
    const ASL = 2;
    const BRANCH = 3;
    const BIT = 4;
    const BRK = 5;
    const CLC = 6;
    const CLD = 7;
    const CLI = 8;
    const CLV = 9;
    const CMP = 10;
    const CPX = 11;
    const CPY = 12;
    const DEC = 13;
    const DEX = 14;
    const DEY = 15;
    const EOR = 16;
    const INC = 17;
    const INX = 18;
    const INY = 19;
    const JMP = 20;
    const JSR = 21;
    const LDA = 22;
    const LDX = 23;
    const LDY = 24;
    const LSR = 25;
    const NOP = 26;
    const ORA = 27;
    const PHA = 28;
    const PHP = 29;
    const PLA = 30;
    const PLP = 31;
    const ROL = 32;
    const ROR = 33;
    const RTI = 34;
    const RTS = 35;
    const SBC = 36;
    const SEC = 37;
    const SED = 38;
    const SEI = 39;
    const STA = 40;
    const STX = 41;
    const STY = 42;
    const TAX = 43;
    const TAY = 44;
    const TSX = 45;
    const TXA = 46;
    const TXS = 47;
    const TYA = 48;

    const op8 = (ir as number) & 0xff;
    let mode = IMP;
    let ins = NOP;
    // biome-ignore format: one line per opcode reads like the datasheet
    switch (op8) {
      case 0x69: mode = IMM; ins = ADC; break;
      case 0x65: mode = ZP; ins = ADC; break;
      case 0x75: mode = ZPX; ins = ADC; break;
      case 0x6d: mode = ABS; ins = ADC; break;
      case 0x7d: mode = ABX; ins = ADC; break;
      case 0x79: mode = ABY; ins = ADC; break;
      case 0x61: mode = IZX; ins = ADC; break;
      case 0x71: mode = IZY; ins = ADC; break;
      case 0x29: mode = IMM; ins = AND; break;
      case 0x25: mode = ZP; ins = AND; break;
      case 0x35: mode = ZPX; ins = AND; break;
      case 0x2d: mode = ABS; ins = AND; break;
      case 0x3d: mode = ABX; ins = AND; break;
      case 0x39: mode = ABY; ins = AND; break;
      case 0x21: mode = IZX; ins = AND; break;
      case 0x31: mode = IZY; ins = AND; break;
      case 0x0a: mode = IMP; ins = ASL; break;
      case 0x06: mode = ZP; ins = ASL; break;
      case 0x16: mode = ZPX; ins = ASL; break;
      case 0x0e: mode = ABS; ins = ASL; break;
      case 0x1e: mode = ABX; ins = ASL; break;
      case 0x90: mode = REL; ins = BRANCH; break; // BCC
      case 0xb0: mode = REL; ins = BRANCH; break; // BCS
      case 0xf0: mode = REL; ins = BRANCH; break; // BEQ
      case 0x30: mode = REL; ins = BRANCH; break; // BMI
      case 0xd0: mode = REL; ins = BRANCH; break; // BNE
      case 0x10: mode = REL; ins = BRANCH; break; // BPL
      case 0x50: mode = REL; ins = BRANCH; break; // BVC
      case 0x70: mode = REL; ins = BRANCH; break; // BVS
      case 0x24: mode = ZP; ins = BIT; break;
      case 0x2c: mode = ABS; ins = BIT; break;
      case 0x00: mode = BRK_IMP; ins = BRK; break;
      case 0x18: mode = IMP; ins = CLC; break;
      case 0xd8: mode = IMP; ins = CLD; break;
      case 0x58: mode = IMP; ins = CLI; break;
      case 0xb8: mode = IMP; ins = CLV; break;
      case 0xc9: mode = IMM; ins = CMP; break;
      case 0xc5: mode = ZP; ins = CMP; break;
      case 0xd5: mode = ZPX; ins = CMP; break;
      case 0xcd: mode = ABS; ins = CMP; break;
      case 0xdd: mode = ABX; ins = CMP; break;
      case 0xd9: mode = ABY; ins = CMP; break;
      case 0xc1: mode = IZX; ins = CMP; break;
      case 0xd1: mode = IZY; ins = CMP; break;
      case 0xe0: mode = IMM; ins = CPX; break;
      case 0xe4: mode = ZP; ins = CPX; break;
      case 0xec: mode = ABS; ins = CPX; break;
      case 0xc0: mode = IMM; ins = CPY; break;
      case 0xc4: mode = ZP; ins = CPY; break;
      case 0xcc: mode = ABS; ins = CPY; break;
      case 0xc6: mode = ZP; ins = DEC; break;
      case 0xd6: mode = ZPX; ins = DEC; break;
      case 0xce: mode = ABS; ins = DEC; break;
      case 0xde: mode = ABX; ins = DEC; break;
      case 0xca: mode = IMP; ins = DEX; break;
      case 0x88: mode = IMP; ins = DEY; break;
      case 0x49: mode = IMM; ins = EOR; break;
      case 0x45: mode = ZP; ins = EOR; break;
      case 0x55: mode = ZPX; ins = EOR; break;
      case 0x4d: mode = ABS; ins = EOR; break;
      case 0x5d: mode = ABX; ins = EOR; break;
      case 0x59: mode = ABY; ins = EOR; break;
      case 0x41: mode = IZX; ins = EOR; break;
      case 0x51: mode = IZY; ins = EOR; break;
      case 0xe6: mode = ZP; ins = INC; break;
      case 0xf6: mode = ZPX; ins = INC; break;
      case 0xee: mode = ABS; ins = INC; break;
      case 0xfe: mode = ABX; ins = INC; break;
      case 0xe8: mode = IMP; ins = INX; break;
      case 0xc8: mode = IMP; ins = INY; break;
      case 0x4c: mode = JMP_ABS; ins = JMP; break;
      case 0x6c: mode = JMP_IND; ins = JMP; break;
      case 0x20: mode = JSR_ABS; ins = JSR; break;
      case 0xa9: mode = IMM; ins = LDA; break;
      case 0xa5: mode = ZP; ins = LDA; break;
      case 0xb5: mode = ZPX; ins = LDA; break;
      case 0xad: mode = ABS; ins = LDA; break;
      case 0xbd: mode = ABX; ins = LDA; break;
      case 0xb9: mode = ABY; ins = LDA; break;
      case 0xa1: mode = IZX; ins = LDA; break;
      case 0xb1: mode = IZY; ins = LDA; break;
      case 0xa2: mode = IMM; ins = LDX; break;
      case 0xa6: mode = ZP; ins = LDX; break;
      case 0xb6: mode = ZPY; ins = LDX; break;
      case 0xae: mode = ABS; ins = LDX; break;
      case 0xbe: mode = ABY; ins = LDX; break;
      case 0xa0: mode = IMM; ins = LDY; break;
      case 0xa4: mode = ZP; ins = LDY; break;
      case 0xb4: mode = ZPX; ins = LDY; break;
      case 0xac: mode = ABS; ins = LDY; break;
      case 0xbc: mode = ABX; ins = LDY; break;
      case 0x4a: mode = IMP; ins = LSR; break;
      case 0x46: mode = ZP; ins = LSR; break;
      case 0x56: mode = ZPX; ins = LSR; break;
      case 0x4e: mode = ABS; ins = LSR; break;
      case 0x5e: mode = ABX; ins = LSR; break;
      case 0xea: mode = IMP; ins = NOP; break;
      case 0x09: mode = IMM; ins = ORA; break;
      case 0x05: mode = ZP; ins = ORA; break;
      case 0x15: mode = ZPX; ins = ORA; break;
      case 0x0d: mode = ABS; ins = ORA; break;
      case 0x1d: mode = ABX; ins = ORA; break;
      case 0x19: mode = ABY; ins = ORA; break;
      case 0x01: mode = IZX; ins = ORA; break;
      case 0x11: mode = IZY; ins = ORA; break;
      case 0x48: mode = PUSH; ins = PHA; break;
      case 0x08: mode = PUSH; ins = PHP; break;
      case 0x68: mode = PULL; ins = PLA; break;
      case 0x28: mode = PULL; ins = PLP; break;
      case 0x2a: mode = IMP; ins = ROL; break;
      case 0x26: mode = ZP; ins = ROL; break;
      case 0x36: mode = ZPX; ins = ROL; break;
      case 0x2e: mode = ABS; ins = ROL; break;
      case 0x3e: mode = ABX; ins = ROL; break;
      case 0x6a: mode = IMP; ins = ROR; break;
      case 0x66: mode = ZP; ins = ROR; break;
      case 0x76: mode = ZPX; ins = ROR; break;
      case 0x6e: mode = ABS; ins = ROR; break;
      case 0x7e: mode = ABX; ins = ROR; break;
      case 0x40: mode = RTI_IMP; ins = RTI; break;
      case 0x60: mode = RTS_IMP; ins = RTS; break;
      case 0xe9: mode = IMM; ins = SBC; break;
      case 0xe5: mode = ZP; ins = SBC; break;
      case 0xf5: mode = ZPX; ins = SBC; break;
      case 0xed: mode = ABS; ins = SBC; break;
      case 0xfd: mode = ABX; ins = SBC; break;
      case 0xf9: mode = ABY; ins = SBC; break;
      case 0xe1: mode = IZX; ins = SBC; break;
      case 0xf1: mode = IZY; ins = SBC; break;
      case 0x38: mode = IMP; ins = SEC; break;
      case 0xf8: mode = IMP; ins = SED; break;
      case 0x78: mode = IMP; ins = SEI; break;
      case 0x85: mode = ZP; ins = STA; break;
      case 0x95: mode = ZPX; ins = STA; break;
      case 0x8d: mode = ABS; ins = STA; break;
      case 0x9d: mode = ABX; ins = STA; break;
      case 0x99: mode = ABY; ins = STA; break;
      case 0x81: mode = IZX; ins = STA; break;
      case 0x91: mode = IZY; ins = STA; break;
      case 0x86: mode = ZP; ins = STX; break;
      case 0x96: mode = ZPY; ins = STX; break;
      case 0x8e: mode = ABS; ins = STX; break;
      case 0x84: mode = ZP; ins = STY; break;
      case 0x94: mode = ZPX; ins = STY; break;
      case 0x8c: mode = ABS; ins = STY; break;
      case 0xaa: mode = IMP; ins = TAX; break;
      case 0xa8: mode = IMP; ins = TAY; break;
      case 0xba: mode = IMP; ins = TSX; break;
      case 0x8a: mode = IMP; ins = TXA; break;
      case 0x9a: mode = IMP; ins = TXS; break;
      case 0x98: mode = IMP; ins = TYA; break;
      default: mode = IMP; ins = NOP;
    }

    const OP_ADD = 0;
    const OP_SUB = 1;
    const OP_AND = 2;
    const OP_OR = 3;
    const OP_EOR = 4;
    const OP_SL = 5;
    const OP_SR = 6;
    const SB_ZERO = 0;
    const SB_A = 1;
    const SB_X = 2;
    const SB_Y = 3;
    const SB_S = 4;
    const SB_DL = 5;
    const CI_0 = 0;
    const CI_1 = 1;
    const CI_C = 2;
    const TO_NONE = 0;
    const TO_A = 1;
    const TO_X = 2;
    const TO_Y = 3;
    const TO_S = 4;
    const TO_MEM = 5;
    const TO_P = 6;
    const F_NONE = 0;
    const F_NZ = 1;
    const F_NZC = 2;
    const F_NZCV = 3;
    const F_BIT = 4;
    const ST_A = 0;
    const ST_X = 1;
    const ST_Y = 2;
    const ST_P = 3;
    const READ = 0;
    const WRITE = 1;
    const RMW = 2;

    let op = OP_OR;
    let sb = SB_ZERO;
    let db = 0;
    let cin = CI_0;
    let dec = 0;
    let dst = TO_NONE;
    let flags = F_NONE;
    let fop = 0;
    let store = ST_A;
    let access = READ;
    // biome-ignore format: one line per mnemonic
    switch (ins) {
      case ADC: op = OP_ADD; sb = SB_A; db = 1; cin = CI_C; dec = 1; dst = TO_A; flags = F_NZCV; break;
      case SBC: op = OP_SUB; sb = SB_A; db = 1; cin = CI_C; dec = 1; dst = TO_A; flags = F_NZCV; break;
      case AND: op = OP_AND; sb = SB_A; db = 1; dst = TO_A; flags = F_NZ; break;
      case ORA: op = OP_OR; sb = SB_A; db = 1; dst = TO_A; flags = F_NZ; break;
      case EOR: op = OP_EOR; sb = SB_A; db = 1; dst = TO_A; flags = F_NZ; break;
      case BIT: op = OP_AND; sb = SB_A; db = 1; flags = F_BIT; break;
      case CMP: op = OP_SUB; sb = SB_A; db = 1; cin = CI_1; flags = F_NZC; break;
      case CPX: op = OP_SUB; sb = SB_X; db = 1; cin = CI_1; flags = F_NZC; break;
      case CPY: op = OP_SUB; sb = SB_Y; db = 1; cin = CI_1; flags = F_NZC; break;
      case LDA: op = OP_OR; db = 1; dst = TO_A; flags = F_NZ; break;
      case LDX: op = OP_OR; db = 1; dst = TO_X; flags = F_NZ; break;
      case LDY: op = OP_OR; db = 1; dst = TO_Y; flags = F_NZ; break;
      case PLA: op = OP_OR; db = 1; dst = TO_A; flags = F_NZ; break;
      case PLP: dst = TO_P; break;
      case STA: store = ST_A; access = WRITE; break;
      case STX: store = ST_X; access = WRITE; break;
      case STY: store = ST_Y; access = WRITE; break;
      case PHA: store = ST_A; break;
      case PHP: store = ST_P; break;
      case ASL: op = OP_SL; sb = SB_A; cin = CI_0; dst = TO_A; flags = F_NZC; break;
      case ROL: op = OP_SL; sb = SB_A; cin = CI_C; dst = TO_A; flags = F_NZC; break;
      case LSR: op = OP_SR; sb = SB_A; cin = CI_0; dst = TO_A; flags = F_NZC; break;
      case ROR: op = OP_SR; sb = SB_A; cin = CI_C; dst = TO_A; flags = F_NZC; break;
      case INC: op = OP_ADD; sb = SB_DL; cin = CI_1; dst = TO_MEM; flags = F_NZ; break;
      case DEC: op = OP_SUB; sb = SB_DL; cin = CI_0; dst = TO_MEM; flags = F_NZ; break;
      case INX: op = OP_ADD; sb = SB_X; cin = CI_1; dst = TO_X; flags = F_NZ; break;
      case INY: op = OP_ADD; sb = SB_Y; cin = CI_1; dst = TO_Y; flags = F_NZ; break;
      case DEX: op = OP_SUB; sb = SB_X; cin = CI_0; dst = TO_X; flags = F_NZ; break;
      case DEY: op = OP_SUB; sb = SB_Y; cin = CI_0; dst = TO_Y; flags = F_NZ; break;
      case TAX: sb = SB_A; dst = TO_X; flags = F_NZ; break;
      case TAY: sb = SB_A; dst = TO_Y; flags = F_NZ; break;
      case TXA: sb = SB_X; dst = TO_A; flags = F_NZ; break;
      case TYA: sb = SB_Y; dst = TO_A; flags = F_NZ; break;
      case TSX: sb = SB_S; dst = TO_X; flags = F_NZ; break;
      case TXS: sb = SB_X; dst = TO_S; break;
      case CLC: fop = 1; break;
      case SEC: fop = 2; break;
      case CLI: fop = 3; break;
      case SEI: fop = 4; break;
      case CLV: fop = 5; break;
      case CLD: fop = 6; break;
      case SED: fop = 7; break;
      default: break;
    }

    // Shifts, INC and DEC on memory read the operand into DL, write the
    // unmodified value back, then write the result.
    const memShift = ins === ASL || ins === ROL || ins === LSR || ins === ROR;
    if (memShift && mode !== IMP) {
      sb = SB_DL;
      dst = TO_MEM;
    }
    if (dst === TO_MEM) access = RMW;

    return {
      seq: mode | (access << 5) | ((op8 >> 5) << 7),
      exec:
        op |
        (sb << 3) |
        (db << 7) |
        (cin << 8) |
        (dec << 10) |
        (dst << 11) |
        (flags << 14) |
        (fop << 17) |
        (store << 20),
    };
  },
});

/**
 * 6502 decode PLA: the control lines for one clock cycle of the current instruction
 *
 * Takes the decoded instruction, the timing state T, and the conditions
 * latched on earlier cycles (page crossing, pending interrupt) and decides
 * what every block does on this clock edge: where the next address comes
 * from, what the ALU computes, which registers load, and whether the next
 * cycle reads or writes. Only registered state feeds it, so the bus pins
 * never depend combinationally on `data_in`.
 */
export const MOS6502_DecodePLA = circuit('MOS6502_DecodePLA', {
  inputs: { seq: bus(10), exec: bus(23), state: bus(8), p: bus(8) },
  outputs: {
    timing_ctrl: bus(5),
    pc_ctrl: bus(2),
    bus_ctrl: bus(12),
    alu_op: bus(3),
    alu_cin: bit,
    decimal: bit,
    reg_ctrl: bus(4),
    p_ctrl: bus(8),
    latch_ctrl: bus(6),
  },
  meta: {
    category: 'mos6502',
    icon: 'PLA',
    description:
      '6502 decode PLA: the control lines for one clock cycle of the current instruction',
  },
  eval: ({ seq, exec: execBus, state, p }) => {
    // Unpack the opcode table's fields and the timing state.
    const sq = seq as number;
    const ex = execBus as number;
    const st = state as number;
    const mode = sq & 31;
    const access = (sq >> 5) & 3;
    const cond = (sq >> 7) & 7;
    const dOp = ex & 7;
    const dSb = (ex >> 3) & 15;
    const dDb = (ex >> 7) & 1;
    const dCin = (ex >> 8) & 3;
    const dDec = (ex >> 10) & 1;
    const dst = (ex >> 11) & 7;
    const flags = (ex >> 14) & 7;
    const dFop = (ex >> 17) & 7;
    const store = (ex >> 20) & 7;
    const t = st & 7;
    const acr = (st >> 3) & 1;
    const adir = (st >> 4) & 1;
    const pending = (st >> 5) & 1;
    const kind = (st >> 6) & 3;

    const IMP = 0;
    const IMM = 1;
    const ZP = 2;
    const ZPX = 3;
    const ZPY = 4;
    const ABS = 5;
    const ABX = 6;
    const ABY = 7;
    const IZX = 8;
    const IZY = 9;
    const REL = 10;
    const JMP_ABS = 11;
    const JMP_IND = 12;
    const JSR_ABS = 13;
    const RTS_IMP = 14;
    const RTI_IMP = 15;
    const BRK_IMP = 16;
    const PUSH = 17;
    const PULL = 18;
    const READ = 0;
    const WRITE = 1;
    const RMW = 2;
    const OP_ADD = 0;
    const OP_SUB = 1;
    const SB_ZERO = 0;
    const SB_X = 2;
    const SB_Y = 3;
    const SB_S = 4;
    const SB_PCL = 6;
    const SB_PCH = 7;
    const SB_ABL = 8;
    const SB_ABH = 9;
    const DB_ZERO = 0;
    const DB_DATA = 1;
    const DB_DL = 2;
    const AL_PC = 0;
    const AL_DL = 1;
    const AL_DATA = 2;
    const AL_ALU = 3;
    const AL_S = 4;
    const AL_VEC = 5;
    const AL_ABL = 6;
    const AH_PC = 0;
    const AH_DATA = 1;
    const AH_ALU = 2;
    const AH_ZERO = 3;
    const AH_STACK = 4;
    const AH_FF = 5;
    const AH_ABH = 6;
    const DO_A = 0;
    const DO_P = 3;
    const DO_PCH = 4;
    const DO_PCL = 5;
    const DO_ALU = 6;
    const DO_DATA = 7;
    const CI_1 = 1;
    const CI_C = 2;
    const TO_A = 1;
    const TO_X = 2;
    const TO_Y = 3;
    const TO_S = 4;
    const TO_P = 6;
    const F_NZ = 1;
    const F_NZC = 2;
    const F_NZCV = 3;
    const F_BIT = 4;
    const SET_I = 4;
    const RESET = 3;

    const m = mode as number;
    const tt = t as number;
    const pv = p as number;
    const cnd = cond as number;
    const hw = (kind as number) !== 0;
    const resetting = (kind as number) === RESET;

    // Branch condition: opcode bits 7-6 pick the flag, bit 5 the value.
    const which = cnd >> 1;
    const flag =
      which === 0
        ? (pv >> 7) & 1
        : which === 1
          ? (pv >> 6) & 1
          : which === 2
            ? pv & 1
            : (pv >> 1) & 1;
    const taken = flag === (cnd & 1);

    // T0 is the opcode fetch. A taken branch that stays on its page also
    // fetches on its fourth cycle, from the address it has just formed.
    const fetch = tt === 0 || (m === REL && tt === 3 && !acr);

    let end = 0;
    let pcInc = 0;
    let pcLoad = 0;
    let adl = AL_PC;
    let adh = AH_PC;
    let sbSel = SB_ZERO;
    let dbSel = DB_ZERO;
    let aluOp = OP_ADD;
    let aluCin = 0;
    let decimal = 0;
    let loadA = 0;
    let loadX = 0;
    let loadY = 0;
    let loadS = 0;
    let dlLoad = 0;
    let write = 0;
    let dor = DO_A;
    let pushB = 0;
    let pNz = 0;
    let pC = 0;
    let pV = 0;
    let pBit = 0;
    let pLoad = 0;
    let pFop = 0;
    let acrLoad = 0;
    let acrBranch = 0;
    let intTake = 0;

    // Run the instruction's own operation on this edge.
    let exec = 0;
    // Memory modes: the T of the effective-address cycle, and whether this
    // edge points the address bus at it.
    let ea = 0;
    let toEa = 0;
    // Stack pointer +1 (1) or -1 (2) through the ALU.
    let stack = 0;

    const index = m === ZPY || m === ABY || m === IZY ? SB_Y : SB_X;
    const crossOrNotRead = acr || (access as number) !== READ;

    if (fetch) {
      pcInc = pending ? 0 : 1;
    } else if (m === IMP) {
      if (tt === 1) {
        exec = 1;
        end = 1;
      }
    } else if (m === IMM) {
      if (tt === 1) {
        pcInc = 1;
        exec = 1;
        end = 1;
      }
    } else if (m === ZP) {
      ea = 2;
      if (tt === 1) {
        pcInc = 1;
        adl = AL_DATA;
        adh = AH_ZERO;
        toEa = 1;
      }
    } else if (m === ZPX || m === ZPY) {
      ea = 3;
      if (tt === 1) {
        pcInc = 1;
        adl = AL_DATA;
        adh = AH_ZERO;
        dlLoad = 1;
      } else if (tt === 2) {
        // Dummy read of the base address while the index is added.
        sbSel = index;
        dbSel = DB_DL;
        adl = AL_ALU;
        adh = AH_ZERO;
        toEa = 1;
      }
    } else if (m === ABS) {
      ea = 3;
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
      } else if (tt === 2) {
        pcInc = 1;
        adl = AL_DL;
        adh = AH_DATA;
        toEa = 1;
      }
    } else if (m === ABX || m === ABY) {
      // Reads finish a cycle early when the index add stays on the page.
      ea = crossOrNotRead ? 4 : 3;
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
      } else if (tt === 2) {
        pcInc = 1;
        sbSel = index;
        dbSel = DB_DL;
        adl = AL_ALU;
        adh = AH_DATA;
        acrLoad = 1;
      } else if (tt === 3 && ea === 4) {
        // Dummy read at the uncorrected address; fix the high byte.
        sbSel = SB_ABH;
        aluCin = acr ? 1 : 0;
        adl = AL_ABL;
        adh = AH_ALU;
        toEa = 1;
      }
    } else if (m === IZX) {
      ea = 5;
      if (tt === 1) {
        pcInc = 1;
        adl = AL_DATA;
        adh = AH_ZERO;
        dlLoad = 1;
      } else if (tt === 2) {
        sbSel = SB_X;
        dbSel = DB_DL;
        adl = AL_ALU;
        adh = AH_ZERO;
      } else if (tt === 3) {
        // Pointer low byte; the high byte wraps within page zero.
        dlLoad = 1;
        sbSel = SB_ABL;
        aluCin = 1;
        adl = AL_ALU;
        adh = AH_ZERO;
      } else if (tt === 4) {
        adl = AL_DL;
        adh = AH_DATA;
        toEa = 1;
      }
    } else if (m === IZY) {
      ea = crossOrNotRead ? 5 : 4;
      if (tt === 1) {
        pcInc = 1;
        adl = AL_DATA;
        adh = AH_ZERO;
      } else if (tt === 2) {
        dlLoad = 1;
        sbSel = SB_ABL;
        aluCin = 1;
        adl = AL_ALU;
        adh = AH_ZERO;
      } else if (tt === 3) {
        sbSel = SB_Y;
        dbSel = DB_DL;
        adl = AL_ALU;
        adh = AH_DATA;
        acrLoad = 1;
      } else if (tt === 4 && ea === 5) {
        sbSel = SB_ABH;
        aluCin = acr ? 1 : 0;
        adl = AL_ABL;
        adh = AH_ALU;
        toEa = 1;
      }
    } else if (m === REL) {
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
        end = taken ? 0 : 1;
      } else if (tt === 2) {
        // Add the offset to PCL; remember whether it left the page.
        sbSel = SB_PCL;
        dbSel = DB_DL;
        adl = AL_ALU;
        adh = AH_PC;
        pcLoad = 1;
        acrLoad = 1;
        acrBranch = 1;
      } else if (tt === 3) {
        // Page crossed: dummy read on the wrong page, then fix PCH.
        sbSel = SB_PCH;
        aluOp = adir ? OP_SUB : OP_ADD;
        aluCin = adir ? 0 : 1;
        adl = AL_PC;
        adh = AH_ALU;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === JMP_ABS) {
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
      } else if (tt === 2) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === JMP_IND) {
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
      } else if (tt === 2) {
        adl = AL_DL;
        adh = AH_DATA;
      } else if (tt === 3) {
        // The pointer's high byte comes from the same page (the JMP ($xxFF) bug).
        dlLoad = 1;
        sbSel = SB_ABL;
        aluCin = 1;
        adl = AL_ALU;
        adh = AH_ABH;
      } else if (tt === 4) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === JSR_ABS) {
      if (tt === 1) {
        pcInc = 1;
        dlLoad = 1;
        adl = AL_S;
        adh = AH_STACK;
      } else if (tt === 2) {
        adl = AL_ABL;
        adh = AH_ABH;
        write = 1;
        dor = DO_PCH;
      } else if (tt === 3) {
        stack = 2;
        adl = AL_ALU;
        adh = AH_STACK;
        write = 1;
        dor = DO_PCL;
      } else if (tt === 4) {
        stack = 2;
      } else if (tt === 5) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === RTS_IMP) {
      if (tt === 1) {
        adl = AL_S;
        adh = AH_STACK;
      } else if (tt === 2) {
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 3) {
        dlLoad = 1;
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 4) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
      } else if (tt === 5) {
        pcInc = 1;
        end = 1;
      }
    } else if (m === RTI_IMP) {
      if (tt === 1) {
        adl = AL_S;
        adh = AH_STACK;
      } else if (tt === 2) {
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 3) {
        pLoad = 1;
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 4) {
        dlLoad = 1;
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 5) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === BRK_IMP) {
      // BRK, IRQ, NMI and reset share one sequence. Interrupts don't skip
      // the padding byte, and reset turns the three pushes into reads.
      if (tt === 1) {
        pcInc = hw ? 0 : 1;
        adl = AL_S;
        adh = AH_STACK;
        write = resetting ? 0 : 1;
        dor = DO_PCH;
      } else if (tt === 2) {
        stack = 2;
        adl = AL_ALU;
        adh = AH_STACK;
        write = resetting ? 0 : 1;
        dor = DO_PCL;
      } else if (tt === 3) {
        stack = 2;
        adl = AL_ALU;
        adh = AH_STACK;
        write = resetting ? 0 : 1;
        dor = DO_P;
        pushB = hw ? 0 : 1;
      } else if (tt === 4) {
        stack = 2;
        adl = AL_VEC;
        adh = AH_FF;
        intTake = 1;
        pFop = SET_I;
      } else if (tt === 5) {
        dlLoad = 1;
        sbSel = SB_ABL;
        aluCin = 1;
        adl = AL_ALU;
        adh = AH_ABH;
      } else if (tt === 6) {
        adl = AL_DL;
        adh = AH_DATA;
        pcLoad = 1;
        end = 1;
      }
    } else if (m === PUSH) {
      if (tt === 1) {
        adl = AL_S;
        adh = AH_STACK;
        write = 1;
        dor = store as number;
        pushB = 1;
      } else if (tt === 2) {
        stack = 2;
        end = 1;
      }
    } else if (m === PULL) {
      if (tt === 1) {
        adl = AL_S;
        adh = AH_STACK;
      } else if (tt === 2) {
        stack = 1;
        adl = AL_ALU;
        adh = AH_STACK;
      } else if (tt === 3) {
        exec = 1;
        end = 1;
      }
    }

    // The shared tail of every memory addressing mode.
    const memMode = m >= ZP && m <= IZY;
    if (!fetch && memMode) {
      const acc = access as number;
      if (toEa && acc === WRITE) {
        write = 1;
        dor = store as number;
      }
      if (tt === ea) {
        if (acc === READ) {
          exec = 1;
          end = 1;
        } else if (acc === WRITE) {
          end = 1;
        } else {
          // Read-modify-write: keep the operand and write it straight back.
          dlLoad = 1;
          write = 1;
          dor = DO_DATA;
          adl = AL_ABL;
          adh = AH_ABH;
        }
      } else if (acc === RMW && tt === ea + 1) {
        exec = 1;
        write = 1;
        dor = DO_ALU;
        adl = AL_ABL;
        adh = AH_ABH;
      } else if (acc === RMW && tt === ea + 2) {
        end = 1;
      }
    }

    if (stack !== 0) {
      sbSel = SB_S;
      aluOp = stack === 1 ? OP_ADD : OP_SUB;
      aluCin = stack === 1 ? 1 : 0;
      loadS = 1;
    }

    if (exec) {
      const d = dst as number;
      const f = flags as number;
      const ci = dCin as number;
      aluOp = dOp as number;
      sbSel = dSb as number;
      dbSel = dDb ? DB_DATA : DB_ZERO;
      aluCin = ci === CI_1 ? 1 : ci === CI_C ? pv & 1 : 0;
      decimal = dDec ? (pv >> 3) & 1 : 0;
      loadA = d === TO_A ? 1 : 0;
      loadX = d === TO_X ? 1 : 0;
      loadY = d === TO_Y ? 1 : 0;
      loadS = d === TO_S ? 1 : 0;
      pLoad = d === TO_P ? 1 : 0;
      pNz = f === F_NZ || f === F_NZC || f === F_NZCV ? 1 : 0;
      pC = f === F_NZC || f === F_NZCV ? 1 : 0;
      pV = f === F_NZCV ? 1 : 0;
      pBit = f === F_BIT ? 1 : 0;
      pFop = dFop as number;
    }

    // One control bundle per block; each block picks out its own lines.
    return {
      timing_ctrl:
        (fetch ? 1 : 0) | (end << 1) | (acrLoad << 2) | (acrBranch << 3) | (intTake << 4),
      pc_ctrl: pcInc | (pcLoad << 1),
      bus_ctrl: adl | (adh << 3) | (sbSel << 6) | (dbSel << 10),
      alu_op: aluOp,
      alu_cin: aluCin,
      decimal,
      reg_ctrl: loadA | (loadX << 1) | (loadY << 2) | (loadS << 3),
      p_ctrl: pNz | (pC << 1) | (pV << 2) | (pBit << 3) | (pLoad << 4) | (pFop << 5),
      latch_ctrl: dlLoad | (write << 1) | (dor << 2) | (pushB << 5),
    };
  },
});

// `op`: 0 add, 1 subtract, 2 AND, 3 OR, 4 EOR, 5 shift left, 6 shift right.
// Shifts move `cin` into the vacated bit, which gives ROL/ROR (cin = C) and
// ASL/LSR (cin = 0). With `decimal` set, add and subtract follow the NMOS
// 6502 exactly, including its flag results for invalid BCD: N and V come from
// the half-adjusted sum, Z from the binary sum, and subtract sets every flag
// as binary subtraction would.
/** 6502 ALU: add, subtract (with NMOS decimal mode), AND, OR, EOR and shifts */
export const MOS6502_ALU = circuit('MOS6502_ALU', {
  inputs: { a: bus(8), b: bus(8), op: bus(3), cin: bit, decimal: bit },
  outputs: { result: bus(8), c: bit, v: bit, n: bit, z: bit },
  meta: {
    category: 'mos6502',
    icon: 'ALU',
    description: '6502 ALU: add, subtract (with NMOS decimal mode), AND, OR, EOR and shifts',
  },
  eval: ({ a, b, op, cin, decimal }) => {
    const x = (a as number) & 0xff;
    const y = (b as number) & 0xff;
    const ci = cin ? 1 : 0;
    const o = (op as number) & 7;
    let result = 0;
    let c = 0;
    let v = 0;
    let n = 0;
    let z = 0;
    if (o === 0 || o === 1) {
      // Binary sum: subtraction is addition of the complement.
      const yb = o === 0 ? y : y ^ 0xff;
      const sum = x + yb + ci;
      const bin = sum & 0xff;
      result = bin;
      c = (sum >> 8) & 1;
      v = (~(x ^ yb) & (x ^ bin) & 0x80) !== 0 ? 1 : 0;
      n = (bin >> 7) & 1;
      z = bin === 0 ? 1 : 0;
      if (decimal && o === 0) {
        let lo = (x & 0x0f) + (y & 0x0f) + ci;
        if (lo >= 0x0a) lo = ((lo + 0x06) & 0x0f) + 0x10;
        let hi = (x & 0xf0) + (y & 0xf0) + lo;
        const sx = x & 0x80 ? (x & 0xf0) - 0x100 : x & 0xf0;
        const sy = y & 0x80 ? (y & 0xf0) - 0x100 : y & 0xf0;
        const signed = sx + sy + lo;
        n = (hi >> 7) & 1;
        v = signed < -128 || signed > 127 ? 1 : 0;
        if (hi >= 0xa0) hi = hi + 0x60;
        c = hi >= 0x100 ? 1 : 0;
        result = hi & 0xff;
      } else if (decimal && o === 1) {
        let lo = (x & 0x0f) - (y & 0x0f) + ci - 1;
        if (lo < 0) lo = ((lo - 0x06) & 0x0f) - 0x10;
        let hi = (x & 0xf0) - (y & 0xf0) + lo;
        if (hi < 0) hi = hi - 0x60;
        result = hi & 0xff;
      }
    } else {
      if (o === 2) result = x & y;
      else if (o === 3) result = x | y;
      else if (o === 4) result = x ^ y;
      else if (o === 5) {
        result = ((x << 1) | ci) & 0xff;
        c = (x >> 7) & 1;
      } else {
        result = (x >> 1) | (ci << 7);
        c = x & 1;
      }
      n = (result >> 7) & 1;
      z = result === 0 ? 1 : 0;
    }
    return { result, c, v, n, z };
  },
});

/** 6502 ADL bus: selects the low byte of the next address */
export const MOS6502_ADLBus = circuit('MOS6502_ADLBus', {
  inputs: {
    ctrl: bus(12),
    pcl: bus(8),
    dl: bus(8),
    data: bus(8),
    alu: bus(8),
    s: bus(8),
    vec: bus(8),
    abl: bus(8),
  },
  outputs: { out: bus(8) },
  meta: {
    category: 'mos6502',
    icon: 'ADL',
    description: '6502 ADL bus: selects the low byte of the next address',
  },
  eval: ({ ctrl, pcl, dl, data, alu, s, vec, abl }) => {
    const k = (ctrl as number) & 7;
    const out =
      k === 0
        ? pcl
        : k === 1
          ? dl
          : k === 2
            ? data
            : k === 3
              ? alu
              : k === 4
                ? s
                : k === 5
                  ? vec
                  : abl;
    return { out: (out as number) & 0xff };
  },
});

/** 6502 ADH bus: selects the high byte of the next address */
export const MOS6502_ADHBus = circuit('MOS6502_ADHBus', {
  inputs: { ctrl: bus(12), pch: bus(8), data: bus(8), alu: bus(8), abh: bus(8) },
  outputs: { out: bus(8) },
  meta: {
    category: 'mos6502',
    icon: 'ADH',
    description: '6502 ADH bus: selects the high byte of the next address',
  },
  eval: ({ ctrl, pch, data, alu, abh }) => {
    const k = ((ctrl as number) >> 3) & 7;
    const out =
      k === 0
        ? pch
        : k === 1
          ? data
          : k === 2
            ? alu
            : k === 3
              ? 0x00
              : k === 4
                ? 0x01
                : k === 5
                  ? 0xff
                  : abh;
    return { out: (out as number) & 0xff };
  },
});

/** 6502 SB bus: selects the ALU's A input */
export const MOS6502_SBBus = circuit('MOS6502_SBBus', {
  inputs: {
    ctrl: bus(12),
    a: bus(8),
    x: bus(8),
    y: bus(8),
    s: bus(8),
    dl: bus(8),
    pcl: bus(8),
    pch: bus(8),
    abl: bus(8),
    abh: bus(8),
  },
  outputs: { out: bus(8) },
  meta: { category: 'mos6502', icon: 'SB', description: "6502 SB bus: selects the ALU's A input" },
  eval: ({ ctrl, a, x, y, s, dl, pcl, pch, abl, abh }) => {
    const k = ((ctrl as number) >> 6) & 15;
    const out =
      k === 1
        ? a
        : k === 2
          ? x
          : k === 3
            ? y
            : k === 4
              ? s
              : k === 5
                ? dl
                : k === 6
                  ? pcl
                  : k === 7
                    ? pch
                    : k === 8
                      ? abl
                      : k === 9
                        ? abh
                        : 0;
    return { out: (out as number) & 0xff };
  },
});

/** 6502 DB bus: selects the ALU's B input */
export const MOS6502_DBBus = circuit('MOS6502_DBBus', {
  inputs: { ctrl: bus(12), data: bus(8), dl: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'mos6502', icon: 'DB', description: "6502 DB bus: selects the ALU's B input" },
  eval: ({ ctrl, data, dl }) => {
    const k = ((ctrl as number) >> 10) & 3;
    const out = k === 1 ? data : k === 2 ? dl : 0;
    return { out: (out as number) & 0xff };
  },
});

/** 6502 program counter incrementer: PC + 1 when inc is high */
export const MOS6502_PCIncrementer = circuit('MOS6502_PCIncrementer', {
  inputs: { pcl: bus(8), pch: bus(8), inc: bit },
  outputs: { pcls: bus(8), pchs: bus(8) },
  meta: {
    category: 'mos6502',
    icon: '+1',
    description: '6502 program counter incrementer: PC + 1 when inc is high',
  },
  eval: ({ pcl, pch, inc }) => {
    const pc = ((((pch as number) & 0xff) << 8) | ((pcl as number) & 0xff)) + (inc ? 1 : 0);
    return { pcls: pc & 0xff, pchs: (pc >> 8) & 0xff };
  },
});

/** 6502 data output select: the byte driven onto the data pins on a write */
export const MOS6502_DORSelect = circuit('MOS6502_DORSelect', {
  inputs: {
    ctrl: bus(6),
    a: bus(8),
    x: bus(8),
    y: bus(8),
    p: bus(8),
    pchs: bus(8),
    pcls: bus(8),
    alu: bus(8),
    data: bus(8),
  },
  outputs: { out: bus(8) },
  meta: {
    category: 'mos6502',
    icon: 'DOR',
    description: '6502 data output select: the byte driven onto the data pins on a write',
  },
  eval: ({ ctrl, a, x, y, p, pchs, pcls, alu, data }) => {
    // The data latch's control lines: bits 2-4 pick the byte, bit 5 is B.
    const k = ((ctrl as number) >> 2) & 7;
    const pushB = ((ctrl as number) >> 5) & 1;
    // P has no B bit; it exists only in the pushed copy (1 for BRK and PHP).
    const pushed = ((p as number) & 0xef) | 0x20 | (pushB ? 0x10 : 0);
    const out =
      k === 0
        ? a
        : k === 1
          ? x
          : k === 2
            ? y
            : k === 3
              ? pushed
              : k === 4
                ? pchs
                : k === 5
                  ? pcls
                  : k === 6
                    ? alu
                    : data;
    return { out: (out as number) & 0xff };
  },
});

/** 6502 status logic: computes the next processor status register */
export const MOS6502_StatusLogic = circuit('MOS6502_StatusLogic', {
  inputs: {
    p: bus(8),
    n: bit,
    z: bit,
    c: bit,
    v: bit,
    data: bus(8),
    ctrl: bus(8),
  },
  outputs: { next: bus(8) },
  meta: {
    category: 'mos6502',
    icon: 'P',
    description: '6502 status logic: computes the next processor status register',
  },
  eval: ({ p, n, z, c, v, data, ctrl }) => {
    const k = ctrl as number;
    const p_nz = k & 1;
    const p_c = (k >> 1) & 1;
    const p_v = (k >> 2) & 1;
    const p_bit = (k >> 3) & 1;
    const p_load = (k >> 4) & 1;
    const p_fop = (k >> 5) & 7;
    // Flags: N V 1 - D I Z C. The 6502 has no storage for bits 5 and 4; bit 5
    // always reads as 1 and B only exists in a pushed copy of P.
    const d = (data as number) & 0xff;
    let next = (p as number) & 0xcf;
    if (p_load) next = d & 0xcf;
    if (p_nz) next = (next & 0x7d) | (n ? 0x80 : 0) | (z ? 0x02 : 0);
    if (p_bit) next = (next & 0x3d) | (d & 0xc0) | (z ? 0x02 : 0);
    if (p_c) next = (next & 0xfe) | (c ? 0x01 : 0);
    if (p_v) next = (next & 0xbf) | (v ? 0x40 : 0);
    const f = p_fop;
    if (f === 1) next = next & 0xfe;
    else if (f === 2) next = next | 0x01;
    else if (f === 3) next = next & 0xfb;
    else if (f === 4) next = next | 0x04;
    else if (f === 5) next = next & 0xbf;
    else if (f === 6) next = next & 0xf7;
    else if (f === 7) next = next | 0x08;
    return { next: next | 0x20 };
  },
});

/**
 * 6502 timing logic: next T state, page-cross latch and interrupt sequencing
 *
 * T counts the cycles of an instruction; the opcode fetch is T0. `acr`
 * remembers whether the last address add carried (for branches: whether the
 * target is on another page, with `adir` set when it is the page below).
 * Interrupts are polled on an instruction's final cycle: the next fetch then
 * loads BRK into IR instead of the opcode, and `kind` tells the BRK sequence
 * whether it is a real BRK (0), an IRQ (1), an NMI (2) or reset (3).
 */
export const MOS6502_TimingLogic = circuit('MOS6502_TimingLogic', {
  inputs: {
    t: bus(3),
    acr: bit,
    adir: bit,
    pending: bit,
    kind: bus(2),
    nmi_prev: bit,
    nmi_latch: bit,
    ctrl: bus(5),
    alu_c: bit,
    db: bus(8),
    p: bus(8),
    irq: bit,
    nmi: bit,
    reset: bit,
  },
  outputs: {
    t_next: bus(3),
    acr_next: bit,
    adir_next: bit,
    pending_next: bit,
    kind_next: bus(2),
    nmi_latch_next: bit,
    ir_load: bit,
    ir_clear: bit,
    vec: bus(8),
    state: bus(8),
    sync: bit,
  },
  meta: {
    category: 'mos6502',
    icon: 'T',
    description: '6502 timing logic: next T state, page-cross latch and interrupt sequencing',
  },
  eval: ({
    t,
    acr,
    adir,
    pending,
    kind,
    nmi_prev,
    nmi_latch,
    ctrl,
    alu_c,
    db,
    p,
    irq,
    nmi,
    reset,
  }) => {
    // The PLA's timing lines.
    const k = ctrl as number;
    const fetch = k & 1;
    const end = (k >> 1) & 1;
    const acr_load = (k >> 2) & 1;
    const acr_branch = (k >> 3) & 1;
    const int_take = (k >> 4) & 1;
    const neg = ((db as number) >> 7) & 1;
    const c = alu_c ? 1 : 0;
    const nmiEdge = nmi && !nmi_prev ? 1 : 0;
    const irqOk = irq && !(((p as number) >> 2) & 1) ? 1 : 0;

    const tNext = reset || fetch ? 1 : end ? 0 : ((t as number) + 1) & 7;
    const acrNext = acr_load ? (acr_branch ? c ^ neg : c) : acr ? 1 : 0;
    const adirNext = acr_load ? (acr_branch ? neg : 0) : adir ? 1 : 0;

    let nmiLatch = nmi_latch ? 1 : 0;
    if (int_take) nmiLatch = 0;
    if (nmiEdge) nmiLatch = 1;
    if (reset) nmiLatch = 0;

    let pendingNext = pending ? 1 : 0;
    if (fetch) pendingNext = 0;
    if (end) pendingNext = nmi_latch || nmiEdge || irqOk ? 1 : 0;
    if (reset) pendingNext = 0;

    let kindNext = kind as number;
    if (fetch) kindNext = pending ? (nmi_latch ? 2 : 1) : 0;
    if (reset) kindNext = 3;

    // An NMI that arrives during the BRK sequence takes over its vector.
    const vec = nmi_latch ? 0xfa : (kind as number) === 3 ? 0xfc : 0xfe;

    return {
      t_next: tNext,
      acr_next: acrNext,
      adir_next: adirNext,
      pending_next: pendingNext,
      kind_next: kindNext,
      nmi_latch_next: nmiLatch,
      ir_load: reset || fetch ? 1 : 0,
      ir_clear: reset || (fetch && pending) ? 1 : 0,
      vec,
      // T and the latched conditions, packed for the PLA.
      state:
        ((t as number) & 7) |
        (acr ? 8 : 0) |
        (adir ? 16 : 0) |
        (pending ? 32 : 0) |
        (((kind as number) & 3) << 6),
      sync: fetch,
    };
  },
});

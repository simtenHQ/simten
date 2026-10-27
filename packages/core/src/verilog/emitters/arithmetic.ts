/** Adders, multipliers, dividers, shifters and comparators. */

import {
  type Emitter,
  getWidth,
  isConnected,
  ones,
  type PrimitiveWires,
  pins,
  sanitizeId,
} from './helpers.js';

/** Comparator output port -> Verilog operator. */
const UNSIGNED_COMPARISONS: ReadonlyArray<readonly [string, string]> = [
  ['eq', '=='],
  ['ne', '!='],
  ['lt', '<'],
  ['le', '<='],
  ['gt', '>'],
  ['ge', '>='],
];
/** SignedComparator also has `lte`/`gte`, aliases of `le`/`ge`. */
const SIGNED_COMPARISONS: ReadonlyArray<readonly [string, string]> = [
  ...UNSIGNED_COMPARISONS,
  ['lte', '<='],
  ['gte', '>='],
];

/** One `assign` per connected comparison output. */
function emitComparisons(
  wires: PrimitiveWires,
  a: string,
  b: string,
  comparisons: ReadonlyArray<readonly [string, string]>,
): string[] {
  const { o } = pins(wires);
  return comparisons
    .filter(([port]) => isConnected(wires, port, 'output'))
    .map(([port, op]) => `assign ${o(port)} = (${a} ${op} ${b});`);
}

// Signed: each operand is read as a `width`-bit two's-complement value, and
// the quotient and remainder truncate toward zero, as Verilog's do.
function signedDivision(divide: boolean): Emitter {
  return ({ wires, args, nodeId }) => {
    const { i, o } = pins(wires);
    const w = getWidth(args);
    const id = sanitizeId(nodeId);
    const [a, b, r] = [`sdiv_${id}_a`, `sdiv_${id}_b`, `sdiv_${id}_r`];
    return {
      declarations: [
        `wire signed [${w - 1}:0] ${a};`,
        `wire signed [${w - 1}:0] ${b};`,
        `wire signed [${w - 1}:0] ${r};`,
      ],
      lines: [
        `assign ${a} = ${i('a')};`,
        `assign ${b} = ${i('b')};`,
        `assign ${r} = ${a} ${divide ? '/' : '%'} ${b};`,
        `assign ${o('out')} = (${b} == 0) ? ${divide ? ones(w) : a} : ${r};`,
      ],
    };
  };
}

export const arithmeticEmitters: Readonly<Record<string, Emitter>> = {
  // ── Arithmetic ───────────────────────────────────────────────────
  Adder: ({ wires }) => {
    const { i, o } = pins(wires);
    if (isConnected(wires, 'carry_out', 'output')) {
      return {
        lines: [
          `assign {${o('carry_out')}, ${o('sum')}} = ${i('a')} + ${i('b')} + ${i('carry_in')};`,
        ],
        declarations: [],
      };
    }
    // carry_out not connected — just assign sum without concatenation
    return {
      lines: [`assign ${o('sum')} = ${i('a')} + ${i('b')} + ${i('carry_in')};`],
      declarations: [],
    };
  },
  SignedAdder: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const w = getWidth(args);
    const saLines: string[] = [];
    if (isConnected(wires, 'carry_out', 'output')) {
      saLines.push(
        `assign {${o('carry_out')}, ${o('sum')}} = $signed(${i('a')}) + $signed(${i('b')}) + ${i('carry_in')};`,
      );
    } else {
      saLines.push(
        `assign ${o('sum')} = $signed(${i('a')}) + $signed(${i('b')}) + ${i('carry_in')};`,
      );
    }
    if (isConnected(wires, 'overflow', 'output')) {
      saLines.push(
        `assign ${o('overflow')} = (${i('a')}[${w - 1}] == ${i('b')}[${w - 1}]) && (${o('sum')}[${w - 1}] != ${i('a')}[${w - 1}]);`,
      );
    }
    return { lines: saLines, declarations: [] };
  },
  Subtractor: ({ wires }) => {
    const { i, o } = pins(wires);
    if (isConnected(wires, 'borrow_out', 'output')) {
      return {
        lines: [
          `assign {${o('borrow_out')}, ${o('difference')}} = ${i('a')} - ${i('b')} - ${i('borrow_in')};`,
        ],
        declarations: [],
      };
    }
    return {
      lines: [`assign ${o('difference')} = ${i('a')} - ${i('b')} - ${i('borrow_in')};`],
      declarations: [],
    };
  },
  Multiplier: ({ wires }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('product')} = ${i('a')} * ${i('b')};`], declarations: [] };
  },
  SignedMultiplier: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('product')} = $signed(${i('a')}) * $signed(${i('b')});`],
      declarations: [],
    };
  },
  Incrementer: ({ wires }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('out')} = ${i('in')} + 1;`], declarations: [] };
  },
  WrappingMultiplier: ({ wires }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('out')} = ${i('a')} * ${i('b')};`], declarations: [] };
  },
  // Division by zero is x in Verilog; the simulator gives all ones for a
  // quotient and the dividend for a remainder.
  Divider: ({ wires, args }) => {
    const { i, o } = pins(wires);
    return {
      lines: [
        `assign ${o('out')} = (${i('b')} == 0) ? ${ones(getWidth(args))} : ${i('a')} / ${i('b')};`,
      ],
      declarations: [],
    };
  },
  Modulo: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('out')} = (${i('b')} == 0) ? ${i('a')} : ${i('a')} % ${i('b')};`],
      declarations: [],
    };
  },
  SignedDivider: signedDivision(true),
  SignedModulo: signedDivision(false),

  // ── Shift ────────────────────────────────────────────────────────
  LeftShifter: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('result')} = ${i('value')} << ${i('shift')};`],
      declarations: [],
    };
  },
  RightShifter: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('result')} = ${i('value')} >> ${i('shift')};`],
      declarations: [],
    };
  },
  SignedRightShifter: ({ wires, args, nodeId }) => {
    const { i, o } = pins(wires);
    const w = getWidth(args);
    // `value` as a `width`-bit signed net, so its sign bit is bit width-1.
    const v = `sra_${sanitizeId(nodeId)}`;
    return {
      declarations: [`wire signed [${w - 1}:0] ${v};`],
      lines: [`assign ${v} = ${i('value')};`, `assign ${o('result')} = ${v} >>> ${i('shift')};`],
    };
  },

  // ── Comparison ───────────────────────────────────────────────────
  Comparator: ({ wires }) => {
    const { i } = pins(wires);
    return {
      lines: emitComparisons(wires, i('a'), i('b'), UNSIGNED_COMPARISONS),
      declarations: [],
    };
  },
  SignedComparator: ({ wires }) => {
    const { i } = pins(wires);
    return {
      lines: emitComparisons(wires, `$signed(${i('a')})`, `$signed(${i('b')})`, SIGNED_COMPARISONS),
      declarations: [],
    };
  },
};

/**
 * Exact values for eval-synth: each JS expression in an `eval` or `onTick`
 * becomes a `Value`, a piece of Verilog that computes the same integer.
 *
 * The invariant every `Value` keeps: `code`, evaluated on its own (Verilog's
 * self-determined width and signedness, `width` and `signed` here), is exactly
 * the integer JS computes, never a truncation of it. `lo`..`hi` bounds that
 * integer. Because the code is exact on its own it can sit in any wider
 * expression, provided the expression doesn't mix a negative signed operand
 * with an unsigned one (Verilog would then zero-extend the signed one), which
 * `unify` prevents.
 *
 * JS semantics that differ from Verilog's are modeled rather than assumed:
 * bitwise operators and `<<`/`>>` work on ToInt32 of their operands, `>>>` on
 * ToUint32, shift counts are taken mod 32, `&&`/`||` return an operand rather
 * than a boolean, and `+`/`-`/`*` don't wrap. Anything outside what can be
 * modeled exactly throws `Unsupported` with the reason.
 */

/** Thrown for anything eval-synth can't translate exactly. The message says why. */
export class Unsupported extends Error {}

export function unsupported(reason: string): never {
  throw new Unsupported(reason);
}

/**
 * What JS type a value has: `===` between a boolean and a number is always
 * false, so it matters there and nowhere else (in arithmetic and when stored to
 * a port, `true` is 1).
 */
export type Kind = 'num' | 'bool' | 'mixed';

export interface Value {
  /** Verilog whose self-determined value is the JS value. */
  code: string;
  /** Verilog's self-determined width of `code`. */
  width: number;
  signed: boolean;
  lo: bigint;
  hi: bigint;
  kind: Kind;
}

const INT32_MIN = -(2n ** 31n);
const INT32_MAX = 2n ** 31n - 1n;
const UINT32_MAX = 2n ** 32n - 1n;
/** JS numbers are exact integers up to 2^53. */
const SAFE = 2n ** 53n;

function bitlen(n: bigint): number {
  return n <= 0n ? 0 : n.toString(2).length;
}

/** Bits a value in `lo..hi` needs, as signed or unsigned. */
function bitsFor(lo: bigint, hi: bigint, signed: boolean): number {
  if (!signed) return Math.max(1, bitlen(hi));
  return Math.max(bitlen(lo < 0n ? -lo - 1n : 0n), bitlen(hi)) + 1;
}

const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));
const max = (...xs: bigint[]) => xs.reduce((a, b) => (b > a ? b : a));

function mergeKind(a: Kind, b: Kind): Kind {
  return a === b ? a : 'mixed';
}

function checkSafe(lo: bigint, hi: bigint, what: string): void {
  if (lo < -SAFE || hi > SAFE) {
    unsupported(`${what} can exceed 2^53, where JS numbers stop being exact integers`);
  }
}

/** Whether `code` is a name or a plain number, cheap to repeat. */
export function isSimple(code: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_$]*$|^\d+$/.test(code);
}

/** Wires declared while translating one primitive, named after its node. */
export class Nets {
  readonly declarations: string[] = [];
  readonly lines: string[] = [];
  private readonly used = new Set<string>();
  private count = 0;

  constructor(readonly prefix: string) {}

  /** A fresh name, `<prefix>_<hint>` when that is free. */
  name(hint?: string): string {
    const base = hint ? `${this.prefix}_${hint}` : `${this.prefix}_t${++this.count}`;
    let name = base;
    for (let k = 2; this.used.has(name); k++) name = `${base}_${k}`;
    this.used.add(name);
    return name;
  }

  /** Declare a wire of `width` bits assigned `code`, and return its name. */
  wire(width: number, signed: boolean, code: string, hint?: string): string {
    const name = this.name(hint);
    const range = width > 1 ? `[${width - 1}:0] ` : '';
    this.declarations.push(`wire ${signed ? 'signed ' : ''}${range}${name};`);
    this.lines.push(`assign ${name} = ${code};`);
    return name;
  }

  /** `v` held in a wire of its own width, unless its code is already simple. */
  bind(v: Value, hint?: string): Value {
    if (isSimple(v.code)) return v;
    return { ...v, code: this.wire(v.width, v.signed, v.code, hint) };
  }
}

// ── Leaves ──────────────────────────────────────────────────────────────

/** An unsigned net or port of `width` bits. */
export function port(code: string, width: number): Value {
  return { code, width, signed: false, lo: 0n, hi: 2n ** BigInt(width) - 1n, kind: 'num' };
}

/** A JS integer literal. */
export function literal(n: bigint, kind: Kind = 'num'): Value {
  if (kind === 'bool') return { code: `1'b${n}`, width: 1, signed: false, lo: n, hi: n, kind };
  if (n >= 0n && n <= INT32_MAX) {
    // A plain decimal is a 32-bit signed literal in Verilog.
    return { code: `${n}`, width: 32, signed: true, lo: n, hi: n, kind };
  }
  if (n > 0n) {
    const width = bitlen(n);
    return { code: `${width}'d${n}`, width, signed: false, lo: n, hi: n, kind };
  }
  // One bit wider than the value needs, so the positive literal fits before negation.
  const width = bitsFor(n, n, true) + 1;
  return { code: `-${width}'sd${-n}`, width, signed: true, lo: n, hi: n, kind };
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * An unsigned value as a signed one a bit wider. A name is zero-extended by
 * concatenation; an expression can't be (an unsized literal inside a
 * concatenation is an error), so it is widened by adding a zero instead.
 */
function asSigned(v: Value): string {
  if (isSimple(v.code)) return `$signed({1'b0, ${v.code}})`;
  return `$signed(${v.code} + ${v.width + 1}'d0)`;
}

/**
 * Operand codes that can share one Verilog expression without changing value:
 * when any operand (or the result) can be negative, unsigned operands are made
 * signed (`$signed({1'b0, x})`) so nothing is zero-extended that should be
 * sign-extended.
 */
function unify(
  vs: Value[],
  forceSigned: boolean,
): { codes: string[]; width: number; signed: boolean } {
  if (!forceSigned && vs.every((v) => v.lo >= 0n)) {
    return {
      codes: vs.map((v) => v.code),
      width: Math.max(...vs.map((v) => v.width)),
      signed: vs.every((v) => v.signed),
    };
  }
  return {
    codes: vs.map((v) => (v.signed ? v.code : asSigned(v))),
    width: Math.max(...vs.map((v) => (v.signed ? v.width : v.width + 1))),
    signed: true,
  };
}

/**
 * A value for `code` whose exact result lies in `lo..hi`. When Verilog would
 * size it narrower than that, a zero of the needed width is added, which
 * widens every operand before the operation instead of after.
 */
function sized(
  code: string,
  width: number,
  signed: boolean,
  lo: bigint,
  hi: bigint,
  kind: Kind = 'num',
): Value {
  const needed = bitsFor(lo, hi, signed);
  if (needed <= width) return { code, width, signed, lo, hi, kind };
  return {
    code: `(${code} + ${needed}'${signed ? 's' : ''}d0)`,
    width: needed,
    signed,
    lo,
    hi,
    kind,
  };
}

/** JS ToInt32: the value mod 2^32, read as signed. */
function toInt32(v: Value, nets: Nets): Value {
  if (v.lo >= INT32_MIN && v.hi <= INT32_MAX) return v;
  const code = nets.wire(32, true, v.code);
  return { code, width: 32, signed: true, lo: INT32_MIN, hi: INT32_MAX, kind: 'num' };
}

/** JS ToUint32: the value mod 2^32, read as unsigned. */
function toUint32(v: Value, nets: Nets): Value {
  if (v.lo >= 0n && v.hi <= UINT32_MAX) return v;
  return port(nets.wire(32, false, v.code), 32);
}

/** A shift count as JS takes it: the low five bits. */
function shiftCount(v: Value): Value {
  if (v.lo >= 0n && v.hi <= 31n) return v;
  return {
    code: `(${v.code} & 31)`,
    width: Math.max(v.width, 32),
    signed: v.signed,
    lo: 0n,
    hi: 31n,
    kind: 'num',
  };
}

// ── Operators ───────────────────────────────────────────────────────────

function arithmetic(op: '+' | '-' | '*', a: Value, b: Value): Value {
  let lo: bigint;
  let hi: bigint;
  if (op === '+') [lo, hi] = [a.lo + b.lo, a.hi + b.hi];
  else if (op === '-') [lo, hi] = [a.lo - b.hi, a.hi - b.lo];
  else {
    const p = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
    [lo, hi] = [min(...p), max(...p)];
  }
  checkSafe(lo, hi, `'${op}'`);
  const u = unify([a, b], lo < 0n);
  return sized(`(${u.codes[0]} ${op} ${u.codes[1]})`, u.width, u.signed, lo, hi);
}

function bitwise(op: '&' | '|' | '^', a0: Value, b0: Value, nets: Nets): Value {
  const [a, b] = [toInt32(a0, nets), toInt32(b0, nets)];
  const u = unify([a, b], false);
  let lo: bigint;
  let hi: bigint;
  if (a.lo >= 0n && b.lo >= 0n) {
    lo = 0n;
    hi = op === '&' ? min(a.hi, b.hi) : 2n ** BigInt(Math.max(bitlen(a.hi), bitlen(b.hi))) - 1n;
  } else if (op === '&' && (a.lo >= 0n || b.lo >= 0n)) {
    lo = 0n;
    hi = a.lo >= 0n ? a.hi : b.hi;
  } else {
    lo = -(2n ** BigInt(u.width - 1));
    hi = 2n ** BigInt(u.width - 1) - 1n;
  }
  return {
    code: `(${u.codes[0]} ${op} ${u.codes[1]})`,
    width: u.width,
    signed: u.signed,
    lo,
    hi,
    kind: 'num',
  };
}

function shiftLeft(a0: Value, b: Value, nets: Nets): Value {
  const a = toInt32(a0, nets);
  const s = shiftCount(b);
  const ends = [a.lo << s.lo, a.lo << s.hi, a.hi << s.lo, a.hi << s.hi];
  const [lo, hi] = [min(...ends), max(...ends)];
  if (lo >= INT32_MIN && hi <= INT32_MAX) {
    const u = unify([a], lo < 0n);
    return sized(`(${u.codes[0]} << ${s.code})`, u.width, u.signed, lo, hi);
  }
  // Wraps at 32 bits, as JS does.
  const code = nets.wire(32, true, `${a.code} << ${s.code}`);
  return { code, width: 32, signed: true, lo: INT32_MIN, hi: INT32_MAX, kind: 'num' };
}

/** JS `>>`: arithmetic, on ToInt32 of the value. */
function shiftRight(a0: Value, b: Value, nets: Nets): Value {
  const a = toInt32(a0, nets);
  const s = shiftCount(b);
  const ends = [a.lo >> s.lo, a.lo >> s.hi, a.hi >> s.lo, a.hi >> s.hi];
  const op = a.lo < 0n ? '>>>' : '>>';
  return {
    ...a,
    code: `(${a.code} ${op} ${s.code})`,
    lo: min(...ends),
    hi: max(...ends),
    kind: 'num',
  };
}

/** JS `>>>`: logical, on ToUint32 of the value. */
function shiftRightUnsigned(a0: Value, b: Value, nets: Nets): Value {
  const a = toUint32(a0, nets);
  const s = shiftCount(b);
  if (s.lo === 0n && s.hi === 0n) return { ...a, kind: 'num' };
  return {
    ...a,
    code: `(${a.code} >> ${s.code})`,
    lo: a.lo >> s.hi,
    hi: a.hi >> s.lo,
    kind: 'num',
  };
}

const COMPARE: Record<string, string> = {
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
  '==': '==',
  '!=': '!=',
  '===': '==',
  '!==': '!=',
};

function compare(op: string, a: Value, b: Value): Value {
  if ((op === '===' || op === '!==') && (a.kind !== b.kind || a.kind === 'mixed')) {
    unsupported(
      `'${op}' compares a value that can be a boolean with one that can be a number, which JS never finds equal; use '${op.slice(0, 2)}' or turn the boolean into 1/0`,
    );
  }
  const u = unify([a, b], false);
  return {
    code: `(${u.codes[0]} ${COMPARE[op]} ${u.codes[1]})`,
    width: 1,
    signed: false,
    lo: 0n,
    hi: 1n,
    kind: 'bool',
  };
}

// ── Constants ───────────────────────────────────────────────────────────
// An operation on constants (`width >= 32` with `width` an argument) is
// worked out here, as JS would, so it doesn't become logic or widen a range.

const isConst = (v: Value) => v.lo === v.hi;

/** A JS result as a constant, when it is a safe integer or a boolean. */
function folded(r: number | boolean): Value | undefined {
  if (typeof r === 'boolean') return literal(r ? 1n : 0n, 'bool');
  if (!Number.isSafeInteger(r)) return undefined;
  return literal(BigInt(r));
}

const JS_BINARY: Record<string, (x: number, y: number) => number | boolean> = {
  '+': (x, y) => x + y,
  '-': (x, y) => x - y,
  '*': (x, y) => x * y,
  '&': (x, y) => x & y,
  '|': (x, y) => x | y,
  '^': (x, y) => x ^ y,
  '<<': (x, y) => x << y,
  '>>': (x, y) => x >> y,
  '>>>': (x, y) => x >>> y,
  '<': (x, y) => x < y,
  '>': (x, y) => x > y,
  '<=': (x, y) => x <= y,
  '>=': (x, y) => x >= y,
  '==': (x, y) => x === y,
  '!=': (x, y) => x !== y,
  '===': (x, y) => x === y,
  '!==': (x, y) => x !== y,
};

function foldBinary(op: string, a: Value, b: Value): Value | undefined {
  const f = JS_BINARY[op];
  if (!f || !isConst(a) || !isConst(b)) return undefined;
  // `true === 1` is false: a boolean is never strictly equal to a number.
  if ((op === '===' || op === '!==') && a.kind !== b.kind) return folded(op === '!==');
  return folded(f(Number(a.lo), Number(b.lo)));
}

export function binary(op: string, a: Value, b: Value, nets: Nets): Value {
  const constant = foldBinary(op, a, b);
  if (constant) return constant;
  if (op === '+' || op === '-' || op === '*') return arithmetic(op, a, b);
  if (op === '&' || op === '|' || op === '^') return bitwise(op, a, b, nets);
  if (op === '<<') return shiftLeft(a, b, nets);
  if (op === '>>') return shiftRight(a, b, nets);
  if (op === '>>>') return shiftRightUnsigned(a, b, nets);
  if (op in COMPARE) return compare(op, a, b);
  return unsupported(`operator '${op}' has no exact Verilog equivalent here`);
}

export function unary(op: string, a: Value, nets: Nets): Value {
  if (op === '+') return { ...a, kind: 'num' };
  if (isConst(a)) {
    const x = Number(a.lo);
    const r = op === '!' ? !x : op === '-' ? -x : op === '~' ? ~x : undefined;
    const constant = r === undefined ? undefined : folded(r);
    if (constant) return constant;
  }
  if (op === '!') return not(a);
  if (op === '-') {
    const [lo, hi] = [-a.hi, -a.lo];
    const u = unify([a], true);
    return sized(`(-${u.codes[0]})`, u.width, true, lo, hi);
  }
  if (op === '~') {
    const v = toInt32(a, nets);
    const u = unify([v], true);
    return {
      code: `(~${u.codes[0]})`,
      width: u.width,
      signed: true,
      lo: -v.hi - 1n,
      hi: -v.lo - 1n,
      kind: 'num',
    };
  }
  return unsupported(`operator '${op}' has no Verilog equivalent`);
}

function isBit(v: Value): boolean {
  return v.width === 1 && !v.signed;
}

/** JS `!x`: 1 when x is 0. */
export function not(a: Value): Value {
  const code = isBit(a) ? `!${a.code}` : `(${a.code} == 0)`;
  return { code, width: 1, signed: false, lo: 0n, hi: 1n, kind: 'bool' };
}

const canBeZero = (v: Value) => v.lo <= 0n && v.hi >= 0n;

/** `c ? t : f`, where `c` is tested for being nonzero. */
export function choose(c: Value, t: Value, f: Value): Value {
  if (t.code === f.code) return t;
  if (!canBeZero(c)) return t;
  if (c.lo === 0n && c.hi === 0n) return f;
  const [lo, hi] = [min(t.lo, f.lo), max(t.hi, f.hi)];
  const u = unify([t, f], lo < 0n);
  return {
    code: `(${c.code} ? ${u.codes[0]} : ${u.codes[1]})`,
    width: u.width,
    signed: u.signed,
    lo,
    hi,
    kind: mergeKind(t.kind, f.kind),
  };
}

const zero = (kind: Kind): Value => literal(0n, kind === 'bool' ? 'bool' : 'num');

/** JS `a && b`: `a` when it is falsy (0), else `b`. */
export function and(a: Value, b: Value): Value {
  if (isBit(a) && isBit(b)) {
    return {
      code: `(${a.code} && ${b.code})`,
      width: 1,
      signed: false,
      lo: 0n,
      hi: 1n,
      kind: mergeKind(a.kind, b.kind),
    };
  }
  return choose(a, b, zero(a.kind));
}

/** JS `a || b`: `a` when it is truthy, else `b`. */
export function or(a: Value, b: Value): Value {
  if (isBit(a) && isBit(b)) {
    return {
      code: `(${a.code} || ${b.code})`,
      width: 1,
      signed: false,
      lo: 0n,
      hi: 1n,
      kind: mergeKind(a.kind, b.kind),
    };
  }
  return choose(a, a, b);
}

/** Whether every value `v` can take fits an unsigned `width`-bit register. */
export function fitsUnsigned(v: Value, width: number): boolean {
  return v.lo >= 0n && v.hi <= 2n ** BigInt(width) - 1n;
}

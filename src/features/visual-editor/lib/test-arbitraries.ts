/**
 * Fast-check Arbitraries for Property-Based Testing
 *
 * Custom generators for primitive component testing that produce valid
 * hardware values and input maps matching the evaluator interface.
 */

import fc from "fast-check";

// ============================================================================
// Basic Value Generators
// ============================================================================

/**
 * Generates unsigned 8-bit integers (0-255)
 */
export const uint8 = () => fc.integer({ min: 0, max: 255 });

/**
 * Generates signed 8-bit integers (-128 to 127)
 */
export const int8 = () => fc.integer({ min: -128, max: 127 });

/**
 * Generates boolean values (representing single bits)
 */
export const bit = () => fc.boolean();

/**
 * Generates unsigned integers for a given bit width
 */
export const unsignedInt = (width: number) =>
  fc.integer({ min: 0, max: (1 << width) - 1 });

/**
 * Generates signed integers for a given bit width (two's complement)
 */
export const signedInt = (width: number) =>
  fc.integer({ min: -(1 << (width - 1)), max: (1 << (width - 1)) - 1 });

/**
 * Generates valid shift amounts (0 to width-1)
 */
export const shiftAmount = (width: number) =>
  fc.integer({ min: 0, max: width - 1 });

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a signed integer to its unsigned representation (two's complement)
 */
export function toUnsigned(value: number, width: number): number {
  if (value >= 0) return value;
  return (1 << width) + value;
}

/**
 * Converts an unsigned integer to its signed representation (two's complement)
 */
export function toSigned(value: number, width: number): number {
  const maxPositive = (1 << (width - 1)) - 1;
  if (value <= maxPositive) return value;
  return value - (1 << width);
}

/**
 * Generates a pair of values where first < second
 */
export const orderedPair = (arb: fc.Arbitrary<number>) =>
  fc.tuple(arb, arb).filter(([a, b]) => a < b);

// ============================================================================
// Input Map Generators for Primitives
// ============================================================================

/**
 * Generates inputs for Adder primitive
 */
export const adderInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
      carry_in: bit(),
    })
    .map(
      ({ a, b, carry_in }) =>
        new Map<string, boolean | number>([
          ["a", a],
          ["b", b],
          ["carry_in", carry_in],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for Subtractor primitive
 */
export const subtractorInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
      borrow_in: bit(),
    })
    .map(
      ({ a, b, borrow_in }) =>
        new Map<string, boolean | number>([
          ["a", a],
          ["b", b],
          ["borrow_in", borrow_in],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for SignedAdder primitive
 */
export const signedAdderInputs = (width = 8) =>
  fc
    .record({
      a: signedInt(width),
      b: signedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", toUnsigned(a, width)],
          ["b", toUnsigned(b, width)],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for Comparator primitive
 */
export const comparatorInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", a],
          ["b", b],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for SignedComparator primitive
 */
export const signedComparatorInputs = (width = 8) =>
  fc
    .record({
      a: signedInt(width),
      b: signedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", toUnsigned(a, width)],
          ["b", toUnsigned(b, width)],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for Multiplier primitive
 */
export const multiplierInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", a],
          ["b", b],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for BusAnd primitive
 */
export const busAndInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", a],
          ["b", b],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for BusOr primitive
 */
export const busOrInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", a],
          ["b", b],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for BusXor primitive
 */
export const busXorInputs = (width = 8) =>
  fc
    .record({
      a: unsignedInt(width),
      b: unsignedInt(width),
    })
    .map(
      ({ a, b }) =>
        new Map<string, number>([
          ["a", a],
          ["b", b],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for BusNot primitive
 */
export const busNotInputs = (width = 8) =>
  fc
    .record({
      in: unsignedInt(width),
    })
    .map(
      ({ in: inVal }) =>
        new Map<string, number>([
          ["in", inVal],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for LeftShifter primitive
 */
export const leftShifterInputs = (width = 8) =>
  fc
    .record({
      value: unsignedInt(width),
      shift: shiftAmount(width),
    })
    .map(
      ({ value, shift }) =>
        new Map<string, number>([
          ["value", value],
          ["shift", shift],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for RightShifter primitive
 */
export const rightShifterInputs = (width = 8) =>
  fc
    .record({
      value: unsignedInt(width),
      shift: shiftAmount(width),
    })
    .map(
      ({ value, shift }) =>
        new Map<string, number>([
          ["value", value],
          ["shift", shift],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for ArithmeticRightShifter primitive
 */
export const arithmeticRightShifterInputs = (width = 8) =>
  fc
    .record({
      value: signedInt(width),
      shift: shiftAmount(width),
    })
    .map(
      ({ value, shift }) =>
        new Map<string, number>([
          ["value", toUnsigned(value, width)],
          ["shift", shift],
          ["__width", width],
        ]),
    );

/**
 * Generates inputs for Mux2to1 primitive
 */
export const mux2to1Inputs = (width = 8) =>
  fc
    .record({
      in0: unsignedInt(width),
      in1: unsignedInt(width),
      sel: bit(),
    })
    .map(
      ({ in0, in1, sel }) =>
        new Map<string, boolean | number>([
          ["in0", in0],
          ["in1", in1],
          ["sel", sel],
          ["__width", width],
        ]),
    );

/**
 * Generates three values for transitivity testing
 */
export const threeValues = (arb: fc.Arbitrary<number>) =>
  fc.tuple(arb, arb, arb);

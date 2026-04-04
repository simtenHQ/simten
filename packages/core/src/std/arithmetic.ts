/**
 * Standard Library — Arithmetic Operations
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const Incrementer = fromPrimitive(PRIMITIVE_DEFINITIONS.Incrementer);
export const Adder = fromPrimitive(PRIMITIVE_DEFINITIONS.Adder);
export const Subtractor = fromPrimitive(PRIMITIVE_DEFINITIONS.Subtractor);
export const Multiplier = fromPrimitive(PRIMITIVE_DEFINITIONS.Multiplier);
export const Comparator = fromPrimitive(PRIMITIVE_DEFINITIONS.Comparator);
export const LeftShifter = fromPrimitive(PRIMITIVE_DEFINITIONS.LeftShifter);
export const RightShifter = fromPrimitive(PRIMITIVE_DEFINITIONS.RightShifter);
export const SignedAdder = fromPrimitive(PRIMITIVE_DEFINITIONS.SignedAdder);
export const SignedComparator = fromPrimitive(PRIMITIVE_DEFINITIONS.SignedComparator);
export const SignedMultiplier = fromPrimitive(PRIMITIVE_DEFINITIONS.SignedMultiplier);

// Bus operations
export const BusAnd = fromPrimitive(PRIMITIVE_DEFINITIONS.BusAnd);
export const BusOr = fromPrimitive(PRIMITIVE_DEFINITIONS.BusOr);
export const BusNot = fromPrimitive(PRIMITIVE_DEFINITIONS.BusNot);
export const BusXor = fromPrimitive(PRIMITIVE_DEFINITIONS.BusXor);

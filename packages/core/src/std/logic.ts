/**
 * Standard Library — Logic Gates
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const And = fromPrimitive(PRIMITIVE_DEFINITIONS.And);
export const Or = fromPrimitive(PRIMITIVE_DEFINITIONS.Or);
export const Not = fromPrimitive(PRIMITIVE_DEFINITIONS.Not);
export const Nand = fromPrimitive(PRIMITIVE_DEFINITIONS.Nand);
export const Nor = fromPrimitive(PRIMITIVE_DEFINITIONS.Nor);
export const Xor = fromPrimitive(PRIMITIVE_DEFINITIONS.Xor);
export const Xnor = fromPrimitive(PRIMITIVE_DEFINITIONS.Xnor);
export const Buffer = fromPrimitive(PRIMITIVE_DEFINITIONS.Buffer);

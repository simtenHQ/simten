/**
 * Standard Library — Memory Components
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const ROM = fromPrimitive(PRIMITIVE_DEFINITIONS.ROM);
export const RAM = fromPrimitive(PRIMITIVE_DEFINITIONS.RAM);
export const DualPortRAM = fromPrimitive(PRIMITIVE_DEFINITIONS.DualPortRAM);

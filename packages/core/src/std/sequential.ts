/**
 * Standard Library — Sequential Components
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const DFlipFlop = fromPrimitive(PRIMITIVE_DEFINITIONS.DFlipFlop);
export const Register = fromPrimitive(PRIMITIVE_DEFINITIONS.Register);

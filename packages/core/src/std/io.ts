/**
 * Standard Library — I/O Components
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const Switch = fromPrimitive(PRIMITIVE_DEFINITIONS.Switch);
export const Button = fromPrimitive(PRIMITIVE_DEFINITIONS.Button);
export const Led = fromPrimitive(PRIMITIVE_DEFINITIONS.Led);
export const Input = fromPrimitive(PRIMITIVE_DEFINITIONS.Input);
export const Output = fromPrimitive(PRIMITIVE_DEFINITIONS.Output);
export const Constant = fromPrimitive(PRIMITIVE_DEFINITIONS.Constant);

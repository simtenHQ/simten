/**
 * Standard Library — Display Components
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

export const SevenSegment = fromPrimitive(PRIMITIVE_DEFINITIONS.SevenSegment);
export const HexDisplay = fromPrimitive(PRIMITIVE_DEFINITIONS.HexDisplay);
export const Screen = fromPrimitive(PRIMITIVE_DEFINITIONS.Screen);
export const RasterDisplay = fromPrimitive(PRIMITIVE_DEFINITIONS.RasterDisplay);
export const Console = fromPrimitive(PRIMITIVE_DEFINITIONS.Console);

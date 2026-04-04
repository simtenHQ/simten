/**
 * Standard Library — Routing / Plexers / Utilities
 */

import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

// Plexers
export const Mux = fromPrimitive(PRIMITIVE_DEFINITIONS.Mux);
export const Decoder = fromPrimitive(PRIMITIVE_DEFINITIONS.Decoder);

// Splitters / Combiners
export const Splitter = fromPrimitive(PRIMITIVE_DEFINITIONS.Splitter);
export const Splitter8to8 = fromPrimitive(PRIMITIVE_DEFINITIONS.Splitter8to8);
export const Combiner8to8 = fromPrimitive(PRIMITIVE_DEFINITIONS.Combiner8to8);
export const Concat = fromPrimitive(PRIMITIVE_DEFINITIONS.Concat);
export const BitSlice = fromPrimitive(PRIMITIVE_DEFINITIONS.BitSlice);
export const AddressCombiner = fromPrimitive(PRIMITIVE_DEFINITIONS.AddressCombiner);

// Debug
export const Probe = fromPrimitive(PRIMITIVE_DEFINITIONS.Probe);

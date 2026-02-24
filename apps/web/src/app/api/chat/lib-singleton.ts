/**
 * Library Singleton for server-side tool execution.
 *
 * Lazy-initialized ComponentLibrary from primitives.
 */

import {
  getPrimitives,
  createComponentLibrary,
} from '@turing-incomplete/core/simulator';
import type { ComponentLibrary } from '@turing-incomplete/core';

let _library: ComponentLibrary | undefined;

export function getLibrary(): ComponentLibrary {
  if (!_library) {
    _library = createComponentLibrary(getPrimitives());
  }
  return _library;
}

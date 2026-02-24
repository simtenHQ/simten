/**
 * Primitives Handler
 *
 * Pure function to get primitive component catalog.
 */

import {
  getComponentCatalog,
  getComponentsByKind,
  formatComponentDetails,
} from '@turing-incomplete/core/dsl';
import type { ComponentLibrary } from '@turing-incomplete/core';

export function getPrimitivesHandler(
  params: { kind?: 'combinational' | 'sequential' | 'sink' },
  library: ComponentLibrary
): string {
  const catalog = getComponentCatalog(library);

  const components = params.kind
    ? getComponentsByKind(catalog, params.kind)
    : catalog.components;

  return components
    .map((c) => formatComponentDetails(c))
    .join('\n\n---\n\n') || 'No components found.';
}

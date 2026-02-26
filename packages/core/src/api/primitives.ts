/**
 * Primitives Handler
 *
 * Pure function to get primitive component catalog.
 * Optionally parses user DSL source to include composite circuits.
 */

import {
  getComponentCatalog,
  getComponentsByKind,
  getComponentDetails,
  formatComponentDetails,
  parseDSL,
  compileToIR,
} from '../dsl/index.js';
import type { ComponentLibrary } from '../types/circuit.js';
import { createMutableLibrary } from './lib.js';

export function getPrimitivesHandler(
  params: {
    kind?: 'combinational' | 'sequential' | 'sink';
    source?: string;
    sourceName?: string;
  },
  library: ComponentLibrary
): string {
  const catalog = getComponentCatalog(library);

  const components = params.kind
    ? getComponentsByKind(catalog, params.kind)
    : catalog.components;

  let output = components
    .map((c) => formatComponentDetails(c))
    .join('\n\n---\n\n') || 'No components found.';

  // If source provided, parse and append user-defined circuits
  if (params.source) {
    const sourceName = params.sourceName ?? '<inline>';
    const { ast, errors: parseErrors } = parseDSL(params.source, sourceName);

    if (parseErrors.length > 0) {
      const messages = parseErrors.map(
        (e) => `${e.location.start.line}:${e.location.start.column} ${e.message}`
      );
      output += `\n\n--- Circuits defined in ${sourceName} ---\n\nParse errors:\n${messages.join('\n')}`;
      return output;
    }

    const { library: mutableLibrary, circuits } = createMutableLibrary();

    try {
      const compiledCircuits = compileToIR(ast, mutableLibrary);
      circuits.push(...compiledCircuits);

      if (compiledCircuits.length > 0) {
        // Build a ComponentLibrary that can resolve both user circuits and primitives
        const combinedLibrary: ComponentLibrary = {
          resolveComponent: (name) =>
            circuits.find((c) => c.name === name) ?? library.resolveComponent(name),
          getAllPrimitiveNames: () => library.getAllPrimitiveNames(),
        };

        const userDetails = compiledCircuits
          .map((c) => {
            const detail = getComponentDetails(combinedLibrary, c.name);
            return detail ? formatComponentDetails(detail) : null;
          })
          .filter(Boolean);

        if (userDetails.length > 0) {
          output += `\n\n--- Circuits defined in ${sourceName} ---\n\n`;
          output += userDetails.join('\n\n---\n\n');
        }
      }
    } catch (e) {
      output += `\n\n--- Circuits defined in ${sourceName} ---\n\nCompilation error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return output;
}

/**
 * Simple test to check DSL compilation errors
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, adaptStoreToCompilerLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';

const library = useCircuitLibraryStore.getState();
library.clearAll();
library.registerPrimitives(getPrimitives());

// Try to compile Program Counter
const filepath = resolve(__dirname, '..', '05-program-counter.dsl');
const source = readFileSync(filepath, 'utf-8');

console.log('Compiling Program Counter...');
const result = compileDSL(source, adaptStoreToCompilerLibrary(library));

if (result.errors.length > 0) {
  console.error('Compilation errors:');
  result.errors.forEach((err) => {
    console.error(`  - ${err.message}`);
    console.error(`    at line ${err.line}, col ${err.column}`);
  });
} else {
  console.log('Compiled successfully!');
  console.log(`Generated ${result.circuits.length} circuits:`);
  result.circuits.forEach((c) => {
    console.log(`  - ${c.name}`);
  });
}

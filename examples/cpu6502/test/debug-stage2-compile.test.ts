import { describe, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, adaptStoreToCompilerLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';

describe('Debug Stage2 Compilation', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  function loadAndCompileDSL(filename: string) {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    return compileDSL(source, adaptStoreToCompilerLibrary(library));
  }

  it('should show compilation errors for stage2 files', () => {
    const files = [
      '05-program-counter.dsl',
      '06-instruction-decoder.dsl',
      '07-control-fsm.dsl',
      '08-cpu-stage2.dsl'
    ];

    for (const filename of files) {
      const { circuits, errors } = loadAndCompileDSL(filename);

      console.log(`\n=== ${filename} ===`);
      console.log(`Circuits: ${circuits.length}`);
      console.log(`Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log('ERRORS:');
        errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message} (line ${err.line}, col ${err.column})`);
        });
      }
    }
  });
});

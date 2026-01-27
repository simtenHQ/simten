import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { compileToIR } from './compiler/ir-generator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useComponentLibraryStore } from '../visual-editor/stores/component-library-store';
import { getPrimitives } from '../visual-editor/lib/primitives';

describe('Systolic Array Debug', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  it('should compile SystolicArrayDebug.dsl', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../SystolicArrayDebug.dsl'),
      'utf-8'
    );

    const ast = parse(tokenize(source));

    const libraryAdapter = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: (circuit: any) => library.registerUser(circuit),
    };

    const circuits = compileToIR(ast, libraryAdapter);
    expect(circuits).toHaveLength(3);

    const debug = circuits.find(c => c.name === 'SystolicArrayDebug');
    expect(debug).toBeDefined();
    expect(debug!.outputs).toHaveLength(4);
  });
});

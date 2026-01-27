import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { compileToIR } from './compiler/ir-generator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useComponentLibraryStore } from '../visual-editor/stores/component-library-store';
import { getPrimitives } from '../visual-editor/lib/primitives';

describe('Fixed Systolic Array', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  it('should compile SystolicArrayComplete_Fixed.dsl', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../SystolicArrayComplete_Fixed.dsl'),
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

    const array = circuits.find(c => c.name === 'SystolicArray2x2_Hardware');
    expect(array).toBeDefined();

    // Check for new nodes
    expect(array!.nodes.find(n => n.label === 'done_latch')).toBeDefined();
    expect(array!.nodes.find(n => n.label === 'is_cycle6')).toBeDefined();
    expect(array!.nodes.find(n => n.label === 'counter_should_run')).toBeDefined();
  });
});

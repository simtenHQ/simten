import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { compileToIR } from './compiler/ir-generator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useComponentLibraryStore } from '../visual-editor/stores/component-library-store';
import { getPrimitives } from '../visual-editor/lib/primitives';

describe('Systolic Array v2 (Bug Fixes)', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  it('should compile SystolicArrayComplete_v2.dsl with counter controls', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../SystolicArrayComplete_v2.dsl'),
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

    // Check for fixed nodes
    expect(array!.nodes.find(n => n.label === 'counter_reset_mux')).toBeDefined();
    expect(array!.nodes.find(n => n.label === 'computing')).toBeDefined();
    expect(array!.nodes.find(n => n.label === 'done_latch_or')).toBeDefined();
    expect(array!.nodes.find(n => n.label === 'count_enable')).toBeDefined();
  });
});

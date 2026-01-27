import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { compileToIR } from './compiler/ir-generator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useComponentLibraryStore } from '../visual-editor/stores/component-library-store';
import { getPrimitives } from '../visual-editor/lib/primitives';

describe('Complete Systolic Array - Single File', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  it('should compile all three circuits from SystolicArrayComplete.dsl', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../SystolicArrayComplete.dsl'),
      'utf-8'
    );

    const ast = parse(tokenize(source));

    const libraryAdapter = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: (circuit: any) => library.registerUser(circuit),
    };

    const circuits = compileToIR(ast, libraryAdapter);

    // Should have all 3 circuits
    expect(circuits).toHaveLength(3);

    // Check ProcessingElement
    const pe = circuits.find(c => c.name === 'ProcessingElement');
    expect(pe).toBeDefined();
    expect(pe!.inputs).toHaveLength(4);
    expect(pe!.outputs).toHaveLength(2);

    // Check SystolicArray2x2_Hardware
    const array = circuits.find(c => c.name === 'SystolicArray2x2_Hardware');
    expect(array).toBeDefined();
    expect(array!.inputs.length).toBeGreaterThanOrEqual(10); // 8 matrix inputs + 2 control
    expect(array!.outputs).toHaveLength(5); // 4 results + done

    // Check it has 4 PE instances
    const peNodes = array!.nodes.filter(n => n.componentRef === 'ProcessingElement');
    expect(peNodes).toHaveLength(4);

    // Check SystolicArrayDemo_Hardware
    const demo = circuits.find(c => c.name === 'SystolicArrayDemo_Hardware');
    expect(demo).toBeDefined();

    // Check it has the array instance
    const arrayNode = demo!.nodes.find(n => n.componentRef === 'SystolicArray2x2_Hardware');
    expect(arrayNode).toBeDefined();
    expect(arrayNode!.label).toBe('matmul');

    // Check it has displays
    expect(demo!.nodes.find(n => n.label === 'display_c00')).toBeDefined();
    expect(demo!.nodes.find(n => n.label === 'done_display')).toBeDefined();
  });
});

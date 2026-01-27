import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import { compileToIR } from './compiler/ir-generator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useComponentLibraryStore } from '../visual-editor/stores/component-library-store';
import { getPrimitives } from '../visual-editor/lib/primitives';

describe('Systolic Array - Hardware-Accurate Version', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());

    // Register ProcessingElement first
    const peSource = readFileSync(
      resolve(__dirname, '../../../ProcessingElement.dsl'),
      'utf-8'
    );
    const peAst = parse(tokenize(peSource));
    const libraryAdapter = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: (circuit: any) => library.registerUser(circuit),
    };
    const peCircuits = compileToIR(peAst, libraryAdapter);
    libraryAdapter.addCircuit(peCircuits[0]);
  });

  it('should compile SystolicArray2x2_Hardware circuit', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../SystolicArray2x2_Hardware.dsl'),
      'utf-8'
    );

    const ast = parse(tokenize(source));

    const libraryAdapter = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: (circuit: any) => library.registerUser(circuit),
    };

    const circuits = compileToIR(ast, libraryAdapter);
    expect(circuits).toHaveLength(1);

    const array = circuits[0];
    expect(array.name).toBe('SystolicArray2x2_Hardware');

    // Check inputs (4 A matrix + 4 B matrix + loadWeights + start)
    expect(array.inputs.length).toBeGreaterThanOrEqual(10);
    expect(array.inputs.find(i => i.name === 'a00')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'a01')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'a10')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'a11')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'b00')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'b01')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'b10')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'b11')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'loadWeights')).toBeDefined();
    expect(array.inputs.find(i => i.name === 'start')).toBeDefined();

    // Check outputs (4 C matrix results + done signal)
    expect(array.outputs).toHaveLength(5);
    expect(array.outputs.find(o => o.name === 'c00')).toBeDefined();
    expect(array.outputs.find(o => o.name === 'c01')).toBeDefined();
    expect(array.outputs.find(o => o.name === 'c10')).toBeDefined();
    expect(array.outputs.find(o => o.name === 'c11')).toBeDefined();
    expect(array.outputs.find(o => o.name === 'done')).toBeDefined();

    // Check clocks
    expect(array.clocks).toHaveLength(1);
    expect(array.clocks.find(c => c.name === 'clk')).toBeDefined();

    // Check internal structure
    expect(array.implementation.kind).toBe('composite');

    // Should have 4 PEs
    const peNodes = array.nodes.filter(n => n.componentRef === 'ProcessingElement');
    expect(peNodes).toHaveLength(4);
    expect(peNodes.find(n => n.label === 'pe00')).toBeDefined();
    expect(peNodes.find(n => n.label === 'pe01')).toBeDefined();
    expect(peNodes.find(n => n.label === 'pe10')).toBeDefined();
    expect(peNodes.find(n => n.label === 'pe11')).toBeDefined();

    // Should have cycle counter components
    expect(array.nodes.find(n => n.label === 'counter')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'counter_inc')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'counter_bits')).toBeDefined();

    // Should have input registers
    expect(array.nodes.find(n => n.label === 'reg_a00')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'reg_a01')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'reg_a10')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'reg_a11')).toBeDefined();

    // Should have result capture registers
    expect(array.nodes.find(n => n.label === 'result_c00')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'result_c01')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'result_c10')).toBeDefined();
    expect(array.nodes.find(n => n.label === 'result_c11')).toBeDefined();

    // Should have done signal
    expect(array.nodes.find(n => n.label === 'done_reg')).toBeDefined();
  });

  it('should compile SystolicArrayDemo_Hardware circuit', () => {
    // First compile and register the hardware array
    const arraySource = readFileSync(
      resolve(__dirname, '../../../SystolicArray2x2_Hardware.dsl'),
      'utf-8'
    );
    const arrayAst = parse(tokenize(arraySource));
    const libraryAdapter = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: (circuit: any) => library.registerUser(circuit),
    };
    const arrayCircuits = compileToIR(arrayAst, libraryAdapter);
    libraryAdapter.addCircuit(arrayCircuits[0]);

    // Now compile the demo
    const demoSource = readFileSync(
      resolve(__dirname, '../../../SystolicArrayDemo_Hardware.dsl'),
      'utf-8'
    );
    const demoAst = parse(tokenize(demoSource));
    const demoCircuits = compileToIR(demoAst, libraryAdapter);
    expect(demoCircuits).toHaveLength(1);

    const demo = demoCircuits[0];
    expect(demo.name).toBe('SystolicArrayDemo_Hardware');

    // Should have the array instance
    expect(demo.nodes.find(n => n.componentRef === 'SystolicArray2x2_Hardware')).toBeDefined();

    // Should have input nodes for matrix values
    expect(demo.nodes.find(n => n.label === 'a00')).toBeDefined();
    expect(demo.nodes.find(n => n.label === 'a01')).toBeDefined();
    expect(demo.nodes.find(n => n.label === 'b00')).toBeDefined();

    // Should have control switches
    expect(demo.nodes.find(n => n.label === 'loadWeights')).toBeDefined();
    expect(demo.nodes.find(n => n.label === 'start')).toBeDefined();

    // Should have displays
    expect(demo.nodes.find(n => n.label === 'display_c00')).toBeDefined();
    expect(demo.nodes.find(n => n.label === 'done_display')).toBeDefined();
  });
});

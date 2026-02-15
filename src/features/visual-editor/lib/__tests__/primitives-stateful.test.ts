/**
 * Stateful Property-Based Tests for Sequential Primitives
 *
 * Uses fast-check's model-based testing to verify sequential components
 * maintain correct state across multiple operations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRIMITIVE_EVALUATORS } from '../primitives';

// ============================================================================
// DFlipFlop Stateful Tests
// ============================================================================

describe('DFlipFlop - Stateful Property Tests', () => {
  // Model: Simple boolean state that updates on clock edges
  class DFlipFlopModel {
    public state: boolean;

    constructor(initialState = false) {
      this.state = initialState;
    }

    tick(d: boolean, edge: 'rising' | 'falling' | 'none') {
      if (edge === 'rising') {
        this.state = d;
      }
    }

    read(): { q: boolean; q_bar: boolean } {
      return { q: this.state, q_bar: !this.state };
    }
  }

  it('should maintain state consistency across multiple clock cycles', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            d: fc.boolean(),
            edge: fc.constantFrom('rising' as const, 'falling' as const, 'none' as const),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (operations) => {
          const model = new DFlipFlopModel(false);
          let currentState: boolean = false;

          for (const op of operations) {
            // Update model
            model.tick(op.d, op.edge);

            // Update real implementation
            const inputs = new Map<string, boolean>([['d', op.d]]);
            const clockEdges = { clk: op.edge };
            currentState = PRIMITIVE_EVALUATORS.DFlipFlop.updateState(
              inputs,
              currentState,
              clockEdges
            ) as boolean;

            // Verify outputs match
            const realOutputs = PRIMITIVE_EVALUATORS.DFlipFlop.evaluate(inputs, currentState);
            const modelOutputs = model.read();

            if (realOutputs.get('q') !== modelOutputs.q) return false;
            if (realOutputs.get('q_bar') !== modelOutputs.q_bar) return false;
          }

          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should only update on rising edges', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (initial, newValue) => {
        let state = initial;

        // Falling edge should not update
        const inputs1 = new Map<string, boolean>([['d', newValue]]);
        state = PRIMITIVE_EVALUATORS.DFlipFlop.updateState(
          inputs1,
          state,
          { clk: 'falling' }
        ) as boolean;

        if (state !== initial) return false;

        // No edge should not update
        state = PRIMITIVE_EVALUATORS.DFlipFlop.updateState(
          inputs1,
          state,
          { clk: 'none' }
        ) as boolean;

        if (state !== initial) return false;

        // Rising edge should update
        state = PRIMITIVE_EVALUATORS.DFlipFlop.updateState(
          inputs1,
          state,
          { clk: 'rising' }
        ) as boolean;

        return state === newValue;
      }),
      { numRuns: 300 }
    );
  });
});

// ============================================================================
// Register Stateful Tests
// ============================================================================

describe('Register - Stateful Property Tests', () => {
  // Model: Number state that updates when write enable is high
  class RegisterModel {
    public state: number;

    constructor(initialState = 0) {
      this.state = initialState & 0xff;
    }

    tick(data: number, we: boolean, edge: 'rising' | 'falling' | 'none') {
      if (edge === 'rising' && we) {
        this.state = data & 0xff;
      }
    }

    read(): number {
      return this.state;
    }
  }

  it('should maintain state consistency across write/read operations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            data: fc.integer({ min: 0, max: 255 }),
            we: fc.boolean(),
            edge: fc.constantFrom('rising' as const, 'falling' as const, 'none' as const),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (operations) => {
          const model = new RegisterModel(0);
          let currentState: number = 0;

          for (const op of operations) {
            // Update model
            model.tick(op.data, op.we, op.edge);

            // Update real implementation
            const inputs = new Map<string, boolean | number>([
              ['data', op.data],
              ['we', op.we],
            ]);
            const clockEdges = { clk: op.edge };
            currentState = PRIMITIVE_EVALUATORS.Register.updateState(
              inputs,
              currentState,
              clockEdges
            ) as number;

            // Verify outputs match
            const realOutput = PRIMITIVE_EVALUATORS.Register.evaluate(inputs, currentState);
            const modelOutput = model.read();

            if (realOutput.get('q') !== modelOutput) return false;
          }

          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should only write when write enable is high on rising edge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (initial, newValue) => {
          let state = initial;

          // Write with WE=false should not update
          const inputs1 = new Map<string, boolean | number>([
            ['data', newValue],
            ['we', false],
          ]);
          state = PRIMITIVE_EVALUATORS.Register.updateState(
            inputs1,
            state,
            { clk: 'rising' }
          ) as number;

          if (state !== initial) return false;

          // Write with WE=true on falling edge should not update
          const inputs2 = new Map<string, boolean | number>([
            ['data', newValue],
            ['we', true],
          ]);
          state = PRIMITIVE_EVALUATORS.Register.updateState(
            inputs2,
            state,
            { clk: 'falling' }
          ) as number;

          if (state !== initial) return false;

          // Write with WE=true on rising edge should update
          state = PRIMITIVE_EVALUATORS.Register.updateState(
            inputs2,
            state,
            { clk: 'rising' }
          ) as number;

          return state === newValue;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('should preserve written value across multiple read operations', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 1, max: 10 }), (value, readCount) => {
        // Write value
        let state = 0;
        const writeInputs = new Map<string, boolean | number>([
          ['data', value],
          ['we', true],
        ]);
        state = PRIMITIVE_EVALUATORS.Register.updateState(
          writeInputs,
          state,
          { clk: 'rising' }
        ) as number;

        // Read multiple times - should always return same value
        for (let i = 0; i < readCount; i++) {
          const readInputs = new Map<string, boolean | number>([
            ['data', 0],
            ['we', false],
          ]);
          const output = PRIMITIVE_EVALUATORS.Register.evaluate(readInputs, state);

          if (output.get('q') !== value) return false;
        }

        return true;
      }),
      { numRuns: 300 }
    );
  });
});

// ============================================================================
// RAM Stateful Tests
// ============================================================================

describe('RAM - Stateful Property Tests', () => {
  // Model: Map-based memory
  class RAMModel {
    public memory: Map<number, number>;

    constructor() {
      this.memory = new Map();
    }

    write(addr: number, data: number, we: boolean, edge: 'rising' | 'falling' | 'none') {
      if (edge === 'rising' && we) {
        this.memory.set(addr & 0xff, data & 0xff);
      }
    }

    read(addr: number): number {
      return this.memory.get(addr & 0xff) ?? 0;
    }
  }

  it('should maintain memory consistency across write/read operations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            addr: fc.integer({ min: 0, max: 255 }),
            data: fc.integer({ min: 0, max: 255 }),
            we: fc.boolean(),
            edge: fc.constantFrom('rising' as const, 'falling' as const, 'none' as const),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (operations) => {
          const model = new RAMModel();
          let currentState: Map<number, number> = new Map();

          for (const op of operations) {
            // Update model
            model.write(op.addr, op.data, op.we, op.edge);

            // Update real implementation
            const inputs = new Map<string, boolean | number>([
              ['addr', op.addr],
              ['data_in', op.data],
              ['we', op.we],
            ]);
            const clockEdges = { clk: op.edge };
            currentState = PRIMITIVE_EVALUATORS.RAM.updateState(
              inputs,
              currentState,
              clockEdges
            ) as Map<number, number>;

            // Verify read outputs match
            const realOutput = PRIMITIVE_EVALUATORS.RAM.evaluate(inputs, currentState);
            const modelOutput = model.read(op.addr);

            if (realOutput.get('data_out') !== modelOutput) return false;
          }

          return true;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('should support independent storage at different addresses', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (addr1, addr2, value1, value2) => {
          // Skip if addresses are the same
          if (addr1 === addr2) return true;

          let state: Map<number, number> = new Map();

          // Write value1 to addr1
          const write1 = new Map<string, boolean | number>([
            ['addr', addr1],
            ['data_in', value1],
            ['we', true],
          ]);
          state = PRIMITIVE_EVALUATORS.RAM.updateState(
            write1,
            state,
            { clk: 'rising' }
          ) as Map<number, number>;

          // Write value2 to addr2
          const write2 = new Map<string, boolean | number>([
            ['addr', addr2],
            ['data_in', value2],
            ['we', true],
          ]);
          state = PRIMITIVE_EVALUATORS.RAM.updateState(
            write2,
            state,
            { clk: 'rising' }
          ) as Map<number, number>;

          // Read both addresses - should get independent values
          const read1 = new Map<string, boolean | number>([
            ['addr', addr1],
            ['data_in', 0],
            ['we', false],
          ]);
          const output1 = PRIMITIVE_EVALUATORS.RAM.evaluate(read1, state);

          const read2 = new Map<string, boolean | number>([
            ['addr', addr2],
            ['data_in', 0],
            ['we', false],
          ]);
          const output2 = PRIMITIVE_EVALUATORS.RAM.evaluate(read2, state);

          return output1.get('data_out') === value1 && output2.get('data_out') === value2;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should return 0 for unwritten addresses', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), (addr) => {
        const state: Map<number, number> = new Map();

        const readInputs = new Map<string, boolean | number>([
          ['addr', addr],
          ['data_in', 0],
          ['we', false],
        ]);
        const output = PRIMITIVE_EVALUATORS.RAM.evaluate(readInputs, state);

        return output.get('data_out') === 0;
      }),
      { numRuns: 300 }
    );
  });

  it('should overwrite previous value at same address', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (addr, value1, value2) => {
          let state: Map<number, number> = new Map();

          // Write value1
          const write1 = new Map<string, boolean | number>([
            ['addr', addr],
            ['data_in', value1],
            ['we', true],
          ]);
          state = PRIMITIVE_EVALUATORS.RAM.updateState(
            write1,
            state,
            { clk: 'rising' }
          ) as Map<number, number>;

          // Write value2 to same address
          const write2 = new Map<string, boolean | number>([
            ['addr', addr],
            ['data_in', value2],
            ['we', true],
          ]);
          state = PRIMITIVE_EVALUATORS.RAM.updateState(
            write2,
            state,
            { clk: 'rising' }
          ) as Map<number, number>;

          // Read - should get value2, not value1
          const readInputs = new Map<string, boolean | number>([
            ['addr', addr],
            ['data_in', 0],
            ['we', false],
          ]);
          const output = PRIMITIVE_EVALUATORS.RAM.evaluate(readInputs, state);

          return output.get('data_out') === value2;
        }
      ),
      { numRuns: 300 }
    );
  });
});

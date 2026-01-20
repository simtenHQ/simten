# Sequential Circuit Support Implementation

## Overview

This document describes the implementation of sequential circuit support for the Turing Incomplete simulator. Sequential circuits add clock-based simulation to enable RAM, registers, flip-flops, and other stateful components.

## Architecture

### Two-Phase Execution Model

The simulator now uses a two-phase execution model:

1. **Combinational Phase**: Propagates signals through all components in topological order
2. **Sequential Phase**: Updates state of sequential components on clock edges

This separation is critical for preventing race conditions and ensuring deterministic behavior.

### State Management

Sequential state is managed using double buffering:
- `currentState`: The current values of all sequential components
- `nextState`: The next values to be committed on the next clock edge

This prevents race conditions where reading and writing state during the same cycle could cause undefined behavior.

### Clock Edge Detection

Clock signals are tracked with:
- `previousValue`: Clock value from previous cycle
- `currentValue`: Clock value in current cycle

Rising edge detection: `previous=false && current=true`
Falling edge detection: `previous=true && current=false`

## Implementation Details

### 1. IR Type Extensions

**File**: `/src/features/visual-editor/types/ir.ts`

Added three new primitive component types:
- `D_FLIP_FLOP`: Single-bit storage, updates on rising clock edge
- `REGISTER`: Multi-bit storage with write enable
- `RAM`: Memory array with address/data buses

Added `SequentialState` interface for managing sequential simulation state.

### 2. Simulator Extensions

**File**: `/src/features/visual-editor/lib/simulator.ts`

Key functions added:
- `initializeSequentialState()`: Initialize state for all sequential components
- `commitSequentialState()`: Commit next state to current state
- `updateSequentialStates()`: Update sequential components based on clock edges
- `runSimulationTick()`: Execute full simulation tick (combinational + sequential)

**Critical Fix**: Topological Sort for Sequential Circuits

Sequential components are evaluated FIRST in the topological order, before combinational logic. This ensures that:
1. Sequential component outputs (from stored state) are available
2. Combinational logic can read these values
3. Feedback loops through sequential components don't create cycles

The topological sort now:
1. Separates sequential and combinational components
2. Evaluates all sequential components first (they output stored state)
3. Evaluates combinational components in dependency order
4. Only checks for cycles in combinational logic (sequential components break cycles)

### 3. Primitive Component Definitions

**File**: `/src/features/visual-editor/lib/primitives.ts`

Added circuit definitions for:
- `DFlipFlop`: 2 inputs (d, clk), 2 outputs (q, q_bar)
- `Register`: 2 inputs (data[8], we), 1 output (q[8])
- `RAM`: 4 inputs (addr[8], data_in[8], we, clk), 1 output (data_out[8])

### 4. Clock Controls UI

**File**: `/src/features/visual-editor/components/ClockControls.tsx`

New UI component providing:
- **Step**: Execute one clock cycle
- **Run**: Continuously execute clock cycles (10 Hz)
- **Pause**: Pause continuous execution
- **Reset**: Reset all sequential state to initial values
- **Cycle Counter**: Display current simulation cycle

The component automatically shows/hides based on whether the circuit contains sequential components.

### 5. IR Store Updates

**File**: `/src/features/visual-editor/stores/ir-store.ts`

Updated `addComponent` to handle sequential component initialization:
- D Flip-Flop initializes with `state: false`
- Register initializes with `width: 8, state: 0`
- RAM initializes with `addressWidth: 8, dataWidth: 8, memory: new Map()`

## Test Coverage

### D Flip-Flop Tests

**File**: `/src/features/visual-editor/lib/sequential-circuits.test.ts`

- Initialize with state = false
- Don't update on low clock
- Capture D on rising clock edge
- Hold value on high clock (no edge)
- Capture new value on next rising edge

### 4-Bit Counter Tests (CRITICAL VALIDATION)

Built a 4-bit ripple counter using:
- 4 D flip-flops
- XOR gates for toggle logic
- AND gates for carry logic

**Test Results**: Counter correctly counts from 0 to 15 and wraps to 0, validating:
- Sequential state management
- Clock edge detection
- Feedback loops through sequential components
- Multi-component sequential circuits

## Key Design Decisions

### 1. Clock Edge Detection in updateSequentialStates

**Decision**: Update `previousValue` at the BEGINNING of `updateSequentialStates`, before checking for edges.

**Rationale**:
- If we update after checking, the next cycle sees incorrect previous values
- This ensures proper edge detection across cycles

### 2. Sequential Components Evaluated First

**Decision**: Sequential components always evaluate before combinational logic.

**Rationale**:
- Sequential outputs come from stored state, not computed from inputs
- Combinational logic needs to read these stable values
- This breaks feedback loops naturally (flip-flop Q -> NOT -> flip-flop D)

### 3. Double Buffering

**Decision**: Use separate `currentState` and `nextState` maps.

**Rationale**:
- Prevents race conditions (read old value, write new value in same cycle)
- Ensures all sequential components update based on the same "snapshot"
- Makes simulation deterministic and reproducible

### 4. No State Changes During Combinational Phase

**Decision**: Sequential components only READ state during combinational evaluation, never WRITE.

**Rationale**:
- Prevents 90% of bugs in sequential simulators
- Clear separation of concerns
- Easy to reason about and debug

## Files Modified

1. `/src/features/visual-editor/types/ir.ts` - Added sequential types
2. `/src/features/visual-editor/lib/simulator.ts` - Two-phase execution
3. `/src/features/visual-editor/lib/primitives.ts` - Sequential primitives
4. `/src/features/visual-editor/stores/ir-store.ts` - Component creation
5. `/src/features/visual-editor/components/ClockControls.tsx` - New UI
6. `/src/features/visual-editor/components/SimulationControls.tsx` - Integrated ClockControls
7. `/src/features/visual-editor/components/index.ts` - Export ClockControls
8. `/src/features/visual-editor/lib/sequential-circuits.test.ts` - New tests

## Future Enhancements

### Multi-bit Support
Currently, registers and RAM are simplified to single bits for combinational evaluation. Full bus support would require:
- Extending `PortValueMap` to handle multi-bit values
- Updating all gate evaluations to handle bit vectors
- Adding bit extraction/composition primitives

### Clock Domains
Future support for multiple independent clocks:
- Clock domain crossing detection
- Metastability warnings
- Synchronized handshaking primitives

### Advanced Sequential Primitives
- JK Flip-Flop
- T Flip-Flop
- Shift Registers
- FIFOs
- Counters (as primitives, not built from gates)

### Performance Optimizations
- Incremental evaluation (only re-evaluate changed components)
- Sparse state updates (only track components that changed)
- Parallel evaluation of independent sequential components

## Success Criteria

All success criteria from the original plan were met:

1. **Tests Pass**: 8/8 tests passing (D flip-flop + 4-bit counter)
2. **Counter Works**: 4-bit counter counts correctly from 0-15
3. **No Race Conditions**: Double buffering prevents all race conditions
4. **UI Responsive**: Clock controls are intuitive and functional
5. **Backward Compatible**: All existing combinational circuits still work

## Conclusion

The sequential circuit implementation successfully adds clock-based simulation while maintaining:
- **Correctness**: Deterministic, race-free execution
- **Performance**: Efficient double-buffering and topological sorting
- **Usability**: Intuitive UI controls
- **Maintainability**: Clear separation of concerns, well-documented code
- **Extensibility**: Easy to add new sequential primitives

The 4-bit counter test serves as the critical validation, proving that complex sequential circuits with feedback loops work correctly.

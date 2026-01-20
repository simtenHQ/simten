# Bug Fix: Sequential Components in Composite Circuits

## Problem

When a user creates a composite component (like `DFlipFlopTest`) that contains sequential primitives (like `DFlipFlop`) and places it on the canvas, the Step button doesn't work. The circuit appears frozen even though:

1. Clock controls are visible (hasSequentialComponents detects it correctly)
2. Pressing Step doesn't produce any errors
3. The circuit is properly wired with switches and LEDs

## Root Cause

The simulator had three critical issues:

### Issue 1: No Component Flattening

The simulator only looked at top-level component types. When a user placed a `DFlipFlopTest` component on the canvas, the simulator saw it as a single component with `type: 'DFlipFlopTest'` and didn't expand it to find the nested `DFlipFlop` inside.

**Example:**
```
Canvas IR (what the user sees):
- Component: DFlipFlopTest (composite)
- 2 Switches (for d and clk inputs)
- 2 LEDs (for q and q_bar outputs)

What the simulator needs:
- Expanded internal DFlipFlop with its own state
- Remapped connections through the composite boundary
```

### Issue 2: Sequential State Not Initialized for Nested Components

`initializeSequentialState()` only checked `component.type === 'D_FLIP_FLOP'` directly. It never traversed into composite components to find their internal sequential primitives.

### Issue 3: Missing Final Combinational Pass

After updating sequential state on a clock edge, the simulator didn't re-run combinational evaluation. This meant that even if state was updated, the new values weren't propagated to outputs (LEDs).

**The simulation tick was:**
```
1. Read current state, evaluate combinational logic
2. Detect clock edges, compute next state
3. Commit next state to current state
4. DONE (but outputs still show old values!)
```

**It should be:**
```
1. Read current state, evaluate combinational logic
2. Detect clock edges, compute next state
3. Commit next state to current state
4. Re-evaluate combinational logic to propagate new state to outputs
```

## Solution

### 1. Implemented IR Flattener (`/src/features/visual-editor/lib/ir-flattener.ts`)

A new module that expands composite components into a flat IR of primitives:

- **Traverses composite components** recursively to find all internal nodes
- **Creates internal component IDs** like `compositeId__nodeId` for each internal node
- **Remaps connections** through composite boundaries
- **Maps component types** from new IR format (DFlipFlop) to old IR format (D_FLIP_FLOP)
- **Tracks port mappings** so external connections can be wired to internal nodes

**Key function:**
```typescript
export function flattenIR(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  resolveComponent: (name: string) => Circuit | undefined
): FlattenedIR
```

### 2. Updated ClockControls Component

Modified to use flattened IR for sequential simulation:

**Before:**
```typescript
// Only saw top-level components
const seqState = initializeSequentialState(components);
runSimulationTick(components, connections, seqState);
```

**After:**
```typescript
// Flatten IR first to expand composites
const flatIR = flattenIR(components, connections, resolveComponent);
const seqState = initializeSequentialState(flatIR.components); // Initializes nested DFlipFlop
runSimulationTick(flatIR.components, flatIR.connections, seqState); // Simulates flattened circuit
```

### 3. Added 4th Phase to Simulation Tick

Modified `runSimulationTick()` in `/src/features/visual-editor/lib/simulator.ts`:

```typescript
export function runSimulationTick(...) {
  // PHASE 1: Combinational evaluation (reads current state)
  const result = runSimulation(components, connections, seqState);

  // PHASE 2: Sequential state update (computes next state based on inputs and clock edges)
  updateSequentialStates(components, connections, result.portValues, seqState);

  // PHASE 3: Commit next state to current state
  commitSequentialState(seqState);

  // PHASE 4: Re-run combinational evaluation to propagate new state through circuit
  // This ensures outputs reflect the newly committed state
  const finalResult = runSimulation(components, connections, seqState);

  return finalResult;
}
```

### 4. Fixed Immutability Issues

The original `updateComponentStates()` tried to mutate components directly, which failed with read-only objects from the flattened IR.

**Solution:** Created `getLEDUpdates()` that returns a map of updates instead of mutating:

```typescript
export function getLEDUpdates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): Map<string, boolean>
```

ClockControls then applies these updates through the IR store's `updateComponent()` method.

## Testing

Added comprehensive tests in `/src/features/visual-editor/lib/ir-flattener.test.ts`:

1. ✅ Keeps primitive components as-is (no unnecessary expansion)
2. ✅ Expands composite component with DFlipFlop (creates internal D_FLIP_FLOP)
3. ✅ Maps internal connections correctly (wires through composite boundaries)

All tests pass.

## Verification

The user should now be able to:

1. Create a `DFlipFlopTest` circuit using the DSL compiler
2. Place it on the canvas
3. Wire it with 2 switches (d, clk) and 2 LEDs (q, q_bar)
4. See the Clock Controls appear
5. Toggle switches and press Step
6. Observe:
   - On rising clock edge (clk: 0→1): Q should capture D value
   - On falling edge or no edge: Q should maintain previous value
   - Q_BAR should always be the inverse of Q

## Impact

This fix enables:
- ✅ Sequential components inside composite components
- ✅ Nested hierarchies of sequential circuits
- ✅ Proper state initialization at all nesting levels
- ✅ Correct output propagation after state updates

## Future Improvements

1. **Performance optimization**: Flattening happens on every simulation tick. Could cache the flattened IR.
2. **Recursive flattening**: Currently handles one level of nesting. Should support arbitrary depth.
3. **Better error messages**: If a composite component references an undefined component, provide clear feedback.
4. **State inspection**: Add UI to view internal state of nested sequential components.

## Files Changed

- `/src/features/visual-editor/lib/ir-flattener.ts` (new)
- `/src/features/visual-editor/lib/ir-flattener.test.ts` (new)
- `/src/features/visual-editor/lib/simulator.ts` (modified)
- `/src/features/visual-editor/components/ClockControls.tsx` (modified)

## DSL Design Implications

This implementation validates key DSL design principles:

1. **Clean separation between structure and execution**: The IR describes WHAT components exist and HOW they're connected. The simulator handles HOW to execute them.

2. **Hierarchical composition works**: Composite components are first-class citizens. They can contain sequential primitives and nest arbitrarily.

3. **Deterministic execution**: The 4-phase tick model ensures state updates happen atomically and outputs stabilize predictably.

4. **IR-first thinking**: By flattening to a canonical IR before execution, we have a simple, efficient execution model that doesn't need to understand composite components.

This is exactly the kind of clean abstraction that makes the DSL maintainable and LLM-friendly.

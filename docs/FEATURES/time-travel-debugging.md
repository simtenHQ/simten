# Time-Travel Debugging

**Status:** Implemented ✅
**Version:** 1.0.0

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation](#implementation)
4. [Timeline Branching](#timeline-branching)
5. [Testing Guide](#testing-guide)
6. [Appendix: Bug Fix History](#appendix-bug-fix-history)

---

## Overview

Time-travel debugging allows users to step backward and forward through clock cycles, jump to specific points in simulation history, and explore alternative execution paths.

### Key Features

- **Bidirectional navigation**: Step forward/backward through simulation history
- **Timeline scrubber**: Jump to any cycle visually
- **Deterministic replay**: Same snapshot → same execution
- **Timeline branching**: Go back, change inputs, create alternate timeline
- **Environmental state capture**: Preserves switch positions, button states, input values
- **Performance optimizations**: Ring buffer (1000 snapshots), sparse checkpoints (every 100 cycles)

### Success Criteria (All Met ✅)

**Functional:**
- ✅ Step backward through simulation history
- ✅ Step forward (restoring from snapshots)
- ✅ Jump to arbitrary cycle via scrubber
- ✅ Environmental state (Switch, Button, Input) preserved correctly
- ✅ Deterministic replay: same snapshot → same result after tick

**Performance:**
- ✅ Navigation within history is instant (< 50ms)
- ✅ Memory stays under 5MB for 1000-cycle history (ring buffer)
- ✅ Checkpoint jumps work efficiently

**Architecture:**
- ✅ No hardcoded component types (metadata-driven)
- ✅ Future components add hooks easily
- ✅ No breaking changes to existing simulation code
- ✅ Environmental state type contract documented

---

## Architecture

### The Deterministic Replay Boundary

Time-travel debugging creates a clear boundary between the **simulated circuit world** (deterministic) and its **environment** (external, non-deterministic).

### Three-Tier State Model

```
COMBINATIONAL STATE (not stored)
    ├─ Gate outputs, wire values
    └─ Recomputed from sequential state
        ↓
SEQUENTIAL STATE (clocked, deterministic)
    ├─ Register values
    ├─ RAM contents
    ├─ Counter values
    └─ All clocked component states
        ↓
ENVIRONMENTAL STATE (UI-driven, external)
    ├─ Switch positions (user input)
    ├─ Button states (user input)
    └─ Input values (user input)
```

### What Gets Captured in a Snapshot

```typescript
interface SimulationSnapshot {
  // Sequential state (deterministic, evolves via circuit logic)
  sequentialState: SequentialState;

  // Environmental state (external inputs, non-deterministic sources)
  environmentalState: Map<string, EnvironmentalStateValue>;

  // Metadata
  cycleNumber: number;
  timestamp: number;
}
```

### Environmental State Contract

```typescript
type EnvironmentalStateValue =
  | boolean  // Switch, Button
  | number   // Input
  | string   // Future: file paths, URLs
  | Map<string, EnvironmentalStateValue>  // Nested structures

// Requirements:
// 1. Must be cloneable with structuredClone()
// 2. Must be deterministic (no Date.now(), Math.random())
// 3. Must be replay-safe (no side effects when restored)
```

---

## Implementation

### Files Created

#### 1. `src/features/visual-editor/types/simulation-snapshot.ts`
- Defines `EnvironmentalStateValue` type with contract
- Defines `SimulationSnapshot` interface
- Documents requirements for deterministic, cloneable, replay-safe values

#### 2. `src/features/visual-editor/lib/time-travel.ts`
Core utilities for capture and restoration:

```typescript
// Discover and capture all environmental state
export function captureEnvironmentalState(circuit: Circuit): Map<string, EnvironmentalStateValue>

// Restore environmental state to nodes (via circuit store)
export function restoreEnvironmentalState(
  circuit: Circuit,
  state: Map<string, EnvironmentalStateValue>,
  updateNode: (nodeId: string, updates: Partial<Node>) => void
): void

// Create complete snapshot
export function createSnapshot(
  seqState: SequentialState,
  circuit: Circuit
): SimulationSnapshot

// Restore complete snapshot
export function restoreSnapshot(
  snapshot: SimulationSnapshot,
  circuit: Circuit,
  updateNode: (nodeId: string, updates: Partial<Node>) => void
): void
```

### Files Modified

#### 1. `src/features/visual-editor/lib/primitives.ts`

Added environmental state hooks to `PrimitiveDefinition`:

```typescript
interface PrimitiveDefinition {
  // ... existing fields ...

  // Environmental state (for time-travel debugging)
  hasEnvironmentalState?: boolean;
  captureEnvironmentalState?: (node: Node) => EnvironmentalStateValue;
  restoreEnvironmentalState?: (node: Node, state: EnvironmentalStateValue) => void;
}
```

**Implemented for:**
- **Switch**: Captures boolean position (on/off)
- **Button**: Captures boolean state (pressed/released)
- **Input**: Captures numeric value (8-bit default)

**Example (Switch):**

```typescript
Switch: defineCombinational({
  // ... definition ...
  hasEnvironmentalState: true,

  captureEnvironmentalState: (node: Node): EnvironmentalStateValue => {
    return node.arguments.value as boolean;
  },

  restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
    node.arguments.value = state as boolean;
  },
})
```

#### 2. `src/features/visual-editor/stores/sequential-state-store.ts`

Extended with history management:

**New State:**
```typescript
interface SequentialStateStore {
  // ... existing state ...

  // Time-travel history
  history: SimulationSnapshot[];
  currentHistoryIndex: number;
  isViewingPast: boolean;
  checkpoints: Map<number, SimulationSnapshot>;
}
```

**New Actions:**
```typescript
// Save snapshot (with branching logic)
saveSnapshot: (snapshot: SimulationSnapshot) => void

// Navigation
stepBack: () => SimulationSnapshot | null
stepForward: () => SimulationSnapshot | null
jumpToCycle: (cycleNumber: number) => SimulationSnapshot | null

// Utilities
clearHistory: () => void
```

**Ring Buffer Logic:**
- Keeps last 1000 snapshots (configurable)
- Automatically drops oldest when limit reached
- Sparse checkpoints every 100 cycles for efficient long-range jumps

**Timeline Branching Logic:**

```typescript
saveSnapshot: (snapshot) => {
  if (state.isViewingPast) {
    // Creating a new timeline
    // 1. Keep history up to current position
    newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
    // 2. Append new snapshot
    newHistory.push(snapshot);
    // 3. Clear checkpoints in discarded future
    // 4. Set isViewingPast = false (back to live mode)
  } else {
    // Normal append (at latest state)
    newHistory = [...state.history, snapshot];
    // Ring buffer applies here
  }
}
```

#### 3. `src/features/visual-editor/components/ClockControls.tsx`

Integrated time-travel controls:

**Modified Handlers:**
- `handleStep`: Save snapshot before ticking
- `handleRun`: Save snapshots during Run mode

**New Handlers:**
- `handleStepBack`: Navigate to previous snapshot
- `handleStepForward`: Navigate to next snapshot
- `handleJumpToCycle`: Jump to specific cycle via scrubber

**UI Controls Added:**
- Back/Forward buttons (disabled when at boundaries)
- Timeline scrubber (visual navigation)
- Cycle counter with "(viewing past)" indicator
- All controls disabled during Run mode

---

## Timeline Branching

### How Timeline Branching Works

When you go back in time and then continue stepping/running, the simulator creates a **new timeline** and discards the old future. This matches the behavior of most time-travel debuggers (Redux DevTools, browser debugger, etc.).

### Example Scenario

#### Step 1: Initial Timeline
```
Run to cycle 10:
[cycle 0] → [cycle 1] → [cycle 2] → ... → [cycle 10] ← you are here
```

#### Step 2: Go Back in Time
```
Click "Back" to cycle 5:
[cycle 0] → [cycle 1] → [cycle 2] → [cycle 3] → [cycle 4] → [cycle 5] ← you are here
                                                                └─ (viewing past)

Old future still exists: [cycle 6] [cycle 7] [cycle 8] [cycle 9] [cycle 10]
```

#### Step 3: Continue from Past (Creates New Timeline)
```
Click "Step" or "Run":
[cycle 0] → [cycle 1] → [cycle 2] → [cycle 3] → [cycle 4] → [cycle 5] → [cycle 6 NEW] ← you are here

Old future is DISCARDED: [cycle 6 OLD] [cycle 7] [cycle 8] [cycle 9] [cycle 10] ✗ gone
```

### What Gets Captured in the New Timeline

When you create a new branch, the snapshot captures:

**1. Sequential State (Deterministic)**
- Register values at the branching point
- RAM contents at the branching point
- Counter values at the branching point
- All clocked component states

**2. Environmental State (Current Values)**
- **Switch positions** - whatever they are NOW (you can toggle switches while viewing past!)
- **Button states** - whatever they are NOW
- **Input values** - whatever they are NOW

### Example with Input Changes

```
Original timeline:
Cycle 5: counter=5, input=10, switch=OFF
Cycle 6: counter=6, input=10, switch=OFF
Cycle 7: counter=7, input=10, switch=OFF  ← go back to here, but...

While viewing cycle 7, you change:
- input from 10 → 20
- switch from OFF → ON

Then click "Step":

New timeline:
Cycle 8: counter=8, input=20, switch=ON  ← uses NEW environmental state!
         └─ counter continues from cycle 7
         └─ but input/switch use CURRENT values (20, ON)
```

### User Experience

| Action | Result |
|--------|--------|
| Go back 5 cycles, click "Step" | Creates new cycle 6, discards old cycles 6-10 |
| Go back, toggle switch, click "Step" | New timeline uses new switch state |
| Go back, click "Forward" repeatedly | Returns to old timeline (no branching) |
| Go back, click "Run" for 10 cycles | Creates new cycles 6-15, discards old future |
| Go back, click "Reset" | Clears all history, starts fresh at cycle 0 |

### Why This Design?

This branching model is standard in time-travel debugging because:

1. **Intuitive** - Matches mental model of "going back and trying something different"
2. **No confusion** - Can't have two different cycle 6's in the same timeline
3. **Memory efficient** - Don't keep multiple timeline branches
4. **Deterministic** - Clear what happens at each step

---

## Testing Guide

### Manual Tests

#### Test 1: Basic Navigation (5 min)
1. Create circuit with Register and Input
2. Run 10 cycles
3. Click "Back" → verify cycle decrements
4. Click "Back" 5 more times → should be at cycle 4
5. Click "Forward" 3 times → should be at cycle 7
6. Verify cycle counter shows correct position

#### Test 2: Environmental State (5 min)
1. Create circuit with Switch → LED
2. Toggle switch ON, step 1 cycle
3. Toggle switch OFF, step 1 cycle
4. Click "Back" → verify switch is OFF (previous state)
5. Click "Back" → verify switch is ON (state before that)
6. Click "Forward" → verify switch is OFF again
7. Verify LED reflects switch state at each point

#### Test 3: Timeline Scrubber (3 min)
1. Run 50 cycles
2. Use scrubber to jump to cycle 25
3. Verify state is correct
4. Drag to cycle 40 → verify state
5. Drag to cycle 0 → verify initial state

#### Test 4: Run Mode Integration (3 min)
1. Click "Run"
2. Verify Back/Forward buttons disabled
3. Snapshots accumulate in history
4. Click "Pause"
5. Back/Forward enabled again
6. Step through accumulated history

#### Test 5: Timeline Branching (5 min)
1. Create counter circuit
2. Run 10 cycles (counter = 10)
3. Go back to cycle 5 (counter = 5)
4. Click "Step" → shows cycle 6 with counter = 6
5. Verify history length = 7 (cycles 0-6), not 11
6. Old cycles 6-10 are gone (new timeline)

#### Test 6: Branch with Input Changes (5 min)
1. Create: Input → Register
2. Set input=5, run 5 cycles
3. Go back to cycle 2
4. Change input to 10 (while viewing past)
5. Click "Step" 3 times
6. Verify register uses new input (10)
7. Old timeline (input=5) discarded

#### Test 7: Forward Doesn't Branch (3 min)
1. Run 10 cycles
2. Go back to cycle 5
3. Click "Forward" repeatedly to cycle 10
4. Verify history still has 11 entries (0-10)
5. No branching occurred (just navigation)

### Performance Tests

#### Memory Test (5 min)
1. Open Chrome DevTools → Memory
2. Run 1000 cycles
3. Memory usage < 5MB
4. Ring buffer drops oldest snapshots
5. Only last 1000 kept

#### Navigation Speed Test (2 min)
1. Run 100 cycles
2. Click "Back" rapidly 10 times
3. Navigation < 50ms per step
4. Jump to cycle 50 via scrubber
5. Jump is instant

### Automated Tests

Located in `src/features/visual-editor/lib/__tests__/time-travel.test.ts`:

- ✅ Capture environmental state from components
- ✅ Restore environmental state via store
- ✅ Create snapshots with sequential + environmental state
- ✅ Restore snapshots correctly
- ✅ Handle components without environmental state
- ✅ Timeline branching discards future correctly
- ✅ Forward navigation preserves old timeline
- ✅ Ring buffer limits history size

---

## Future Enhancements

### Snapshot Serialization
Save/load snapshots for:
- Bug reproduction (export crash state)
- Differential testing (compare execution traces)
- Version control (commit test cases)
- Cross-process communication (workers, remote debugging)

```typescript
export function serializeSnapshot(snapshot: SimulationSnapshot): SerializableSnapshot {
  return {
    sequentialState: {
      currentState: Object.fromEntries(snapshot.sequentialState.currentState),
      nextState: Object.fromEntries(snapshot.sequentialState.nextState),
      clocks: Object.fromEntries(snapshot.sequentialState.clocks),
      cycleCount: snapshot.sequentialState.cycleCount,
    },
    environmentalState: Object.fromEntries(snapshot.environmentalState),
    cycleNumber: snapshot.cycleNumber,
    timestamp: snapshot.timestamp,
  };
}
```

### Additional Features
- Keyboard shortcuts (Ctrl+Left/Right for navigation)
- "Jump to cycle" input field
- Timeline visualization with markers
- Multi-timeline branches (keep multiple "what-if" scenarios)
- Snapshot comparison (diff two states)
- Environmental state for more components (Random, UART, etc.)

---

## Appendix: Bug Fix History

### Issue: Immutability Violation (Resolved ✅)

**Problem:**
```
Cannot assign to read only property 'value' of object '#<Object>'
```

**Root Cause:**
The circuit store uses Immer for immutability. Outside `set()` calls, the circuit is frozen. The initial implementation tried to mutate `node.arguments.value` directly.

**Solution:**
Use the circuit store's `updateNode` function for restoration:

```typescript
// ❌ WRONG - tries to mutate frozen object
restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
  node.arguments.value = state as number;  // Error!
}

// ✅ CORRECT - uses store's updateNode
export function restoreEnvironmentalState(
  circuit: Circuit,
  environmentalState: Map<string, EnvironmentalStateValue>,
  updateNode: (nodeId: string, updates: Partial<Node>) => void
): void {
  for (const node of circuit.nodes) {
    const state = environmentalState.get(node.id);
    if (state !== undefined) {
      updateNode(node.id, {
        arguments: {
          ...node.arguments,
          value: state as ArgumentValue,
        },
      });
    }
  }
}
```

**Files Changed:**
1. `src/features/visual-editor/lib/time-travel.ts` - Added `updateNode` parameter
2. `src/features/visual-editor/components/ClockControls.tsx` - Pass `updateNode` to restoration calls

**Key Takeaway:**
Never mutate circuit objects directly - always use store actions to respect immutability.

---

## Related Documents

- [Component Model](../SPECIFICATIONS/component-model.md) - Component behavior and execution model
- [DSL Specification](../SPECIFICATIONS/DSL-and-IR-specification.md) - Circuit definition language

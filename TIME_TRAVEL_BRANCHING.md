# Time-Travel Timeline Branching

## How Timeline Branching Works

When you go back in time and then continue stepping/running, the simulator creates a **new timeline** and discards the old future. This matches the behavior of most time-travel debuggers (Redux DevTools, browser debugger, etc.).

## Example Scenario

### Step 1: Initial Timeline
```
Run to cycle 10:
[cycle 0] → [cycle 1] → [cycle 2] → ... → [cycle 10] ← you are here
```

### Step 2: Go Back in Time
```
Click "Back" to cycle 5:
[cycle 0] → [cycle 1] → [cycle 2] → [cycle 3] → [cycle 4] → [cycle 5] ← you are here
                                                                └─ (viewing past)

Old future still exists: [cycle 6] [cycle 7] [cycle 8] [cycle 9] [cycle 10]
```

### Step 3: Continue from Past (Creates New Timeline)
```
Click "Step" or "Run":
[cycle 0] → [cycle 1] → [cycle 2] → [cycle 3] → [cycle 4] → [cycle 5] → [cycle 6 NEW] ← you are here

Old future is DISCARDED: [cycle 6 OLD] [cycle 7] [cycle 8] [cycle 9] [cycle 10] ✗ gone
```

## What Gets Captured in the New Timeline

When you create a new branch, the snapshot captures:

### 1. Sequential State (Deterministic)
- Register values at the branching point
- RAM contents at the branching point
- Counter values at the branching point
- All clocked component states

### 2. Environmental State (Current Values)
- **Switch positions** - whatever they are NOW (you can toggle switches while viewing past!)
- **Button states** - whatever they are NOW
- **Input values** - whatever they are NOW

### Example with Input Changes:

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

## Implementation Details

### Timeline Trimming Logic

Located in: `src/features/visual-editor/stores/sequential-state-store.ts`

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

### Checkpoint Management

When branching, checkpoints in the discarded future are also removed:

```typescript
const newCheckpoints = new Map<number, SimulationSnapshot>();
for (const [cycleNum, checkpoint] of state.checkpoints) {
  if (cycleNum <= snapshot.cycleNumber) {
    newCheckpoints.set(cycleNum, checkpoint);  // Keep
  }
  // Else: discard (it's in the trimmed future)
}
```

## User Experience

### Visual Indicators

1. **"(viewing past)" label** - Shows when you're not at the latest state
2. **Timeline scrubber** - Shows your position in history
3. **Back/Forward buttons** - Enabled/disabled based on position

### Expected Behavior

| Action | Result |
|--------|--------|
| Go back 5 cycles, click "Step" | Creates new cycle 6, discards old cycles 6-10 |
| Go back, toggle switch, click "Step" | New timeline uses new switch state |
| Go back, click "Forward" repeatedly | Returns to old timeline (no branching) |
| Go back, click "Run" for 10 cycles | Creates new cycles 6-15, discards old future |
| Go back, click "Reset" | Clears all history, starts fresh at cycle 0 |

### Preventing Accidental Branches

To avoid accidentally creating a new branch:
1. Use **Forward** button to return to the latest state
2. Only use **Step/Run** when you intentionally want to branch

## Testing the Branching Behavior

### Test 1: Simple Branch
1. Create a counter circuit (register with incrementer)
2. Run 10 cycles (counter = 10)
3. Go back to cycle 5 (counter = 5)
4. Click "Step" → should show cycle 6 with counter = 6
5. Check history length → should be 7 cycles (0-6), not 11

### Test 2: Branch with Input Change
1. Create circuit: Input → Register
2. Set input = 5, run 5 cycles
3. Go back to cycle 2
4. Change input to 10
5. Click "Step" 3 times
6. Verify register stores values based on NEW input (10)
7. Old timeline with input=5 should be gone

### Test 3: Forward Doesn't Branch
1. Run 10 cycles
2. Go back to cycle 5
3. Click "Forward" 5 times → should return to cycle 10
4. History should still have 11 entries (0-10), no branching

### Test 4: Run Creates Branch
1. Run 10 cycles
2. Go back to cycle 5
3. Click "Run" (let it run 5+ cycles)
4. Pause
5. Old cycles 6-10 should be replaced with new cycles

## Why This Design?

This branching model is standard in time-travel debugging because:

1. **Intuitive** - Matches mental model of "going back and trying something different"
2. **No confusion** - Can't have two different cycle 6's in the same timeline
3. **Memory efficient** - Don't keep multiple timeline branches
4. **Deterministic** - Clear what happens at each step

## Alternative Designs (Not Implemented)

### Multi-Timeline Model
Keep multiple branches, let user switch between them.
- **Pros**: Can explore multiple "what-if" scenarios
- **Cons**: Complex UX, high memory usage, confusing for most users

### Immutable Timeline Model
Never discard history, only append.
- **Pros**: Never lose data
- **Cons**: Confusing (multiple cycle 6's), breaks determinism

### Warning Before Branch
Show dialog: "This will create a new timeline. Continue?"
- **Pros**: No accidental branches
- **Cons**: Annoying for intentional use, breaks flow

**Our choice**: Single-timeline with automatic branching is the best balance of simplicity and power.

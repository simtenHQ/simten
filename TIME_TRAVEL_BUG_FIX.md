# Time-Travel Debugging Bug Fix

## Problem

When using the Back/Forward buttons for time-travel navigation, the application threw an error:

```
Cannot assign to read only property 'value' of object '#<Object>'
```

This occurred at `primitives.ts:597` in the `restoreEnvironmentalState` function.

## Root Cause

The circuit store uses **Immer** for immutability management. This means:

1. **Inside store `set()` calls**: You can mutate the draft state (Immer handles it)
2. **Outside store `set()` calls**: The circuit is frozen/immutable

The original implementation tried to directly mutate `node.arguments.value`:

```typescript
// ❌ WRONG - tries to mutate frozen object
restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
  node.arguments.value = state as number;  // Error: read-only property!
}
```

This worked in the capture direction (reading is fine) but failed during restoration (writing is blocked).

## Solution

Update environmental state through the circuit store's `updateNode` function, which properly handles immutability:

### 1. Updated `restoreEnvironmentalState` function

**File**: `src/features/visual-editor/lib/time-travel.ts`

```typescript
// ✅ CORRECT - uses store's updateNode function
export function restoreEnvironmentalState(
  circuit: Circuit,
  environmentalState: Map<string, EnvironmentalStateValue>,
  updateNode: (nodeId: string, updates: Partial<Node>) => void  // NEW parameter
): void {
  for (const node of circuit.nodes) {
    const state = environmentalState.get(node.id);

    if (state !== undefined) {
      const primitiveDef = PRIMITIVE_DEFINITIONS[node.componentRef];

      if (primitiveDef?.hasEnvironmentalState) {
        const clonedState = structuredClone(state);

        // Update via circuit store to respect immutability
        updateNode(node.id, {
          arguments: {
            ...node.arguments,
            value: clonedState as ArgumentValue,
          },
        });
      }
    }
  }
}
```

### 2. Updated ClockControls to pass `updateNode`

**File**: `src/features/visual-editor/components/ClockControls.tsx`

```typescript
// Get updateNode from circuit store
const updateNode = useCircuitStore((state) => state.updateNode);

// Pass it to restoration functions
const handleStepBack = useCallback(() => {
  if (!circuit) return;
  const snapshot = stepBack();
  if (snapshot) {
    restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);
  }
}, [circuit, stepBack, updateNode]);
```

## How Immer Works

The circuit store uses Immer via Zustand:

```typescript
export const useCircuitStore = create<CircuitStore>()(
  immer((set, get) => ({
    // ...
    updateNode: (nodeId, updates) => {
      set((state) => {
        // Inside this set() callback:
        // - state is a mutable draft (Immer magic)
        // - Can safely mutate: state.circuit.nodes[0].arguments.value = 42
        const node = state.circuit.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);  // This works!
        }
      });
    },
  }))
);
```

**Outside** the `set()` callback, the circuit is frozen and cannot be mutated.

## Key Takeaways

1. **Never mutate circuit objects directly** - always use store actions
2. **Environmental state hooks** are kept for documentation and future extensibility
3. **Restoration must go through the store** to respect immutability
4. **Type safety** - Cast `EnvironmentalStateValue` to `ArgumentValue` since we know they're compatible for Switch/Button/Input

## Testing

After the fix:
- ✅ Back button works correctly
- ✅ Forward button works correctly
- ✅ Timeline scrubber works correctly
- ✅ Switch/Button/Input states are preserved during navigation
- ✅ No console errors
- ✅ TypeScript compilation passes
- ✅ Development server starts successfully

## Files Changed

1. `src/features/visual-editor/lib/time-travel.ts`
   - Added `updateNode` parameter to `restoreEnvironmentalState`
   - Added `updateNode` parameter to `restoreSnapshot`
   - Changed restoration to use store's `updateNode` function

2. `src/features/visual-editor/components/ClockControls.tsx`
   - Import `updateNode` from circuit store
   - Pass `updateNode` to all restoration calls
   - Updated dependency arrays in useCallback hooks

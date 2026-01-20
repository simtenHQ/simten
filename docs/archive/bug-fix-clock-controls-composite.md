# Bug Fix: Clock Controls Not Appearing for Composite Components

## Problem Description

When a user creates a composite component (like `DFlipFlopTest`) that internally contains sequential primitives (like `DFlipFlop`), and places it on the canvas, the clock controls (Step/Run/Pause/Reset buttons) do not appear in the toolbar.

### Root Cause

The `ClockControls` component was checking only the top-level component types:

```typescript
const hasSequential = Object.values(components).some(
  (c) => c.type === 'D_FLIP_FLOP' || c.type === 'REGISTER' || c.type === 'RAM'
);
```

When a composite component like `DFlipFlopTest` is placed on the canvas, its type is `'DFlipFlopTest'`, not `'D_FLIP_FLOP'`. The detection logic didn't recursively check if the composite component contained sequential primitives internally.

## Solution

Created a new utility module `/src/features/visual-editor/lib/component-utils.ts` with two key functions:

### 1. `containsSequentialComponent()`

Recursively checks if a component (or any of its nested components) contains sequential primitives. The function:

- Handles both old IR naming convention (`D_FLIP_FLOP`, `REGISTER`, `RAM`) and new IR v0.1 naming convention (`DFlipFlop`, `Register`, `RAM`)
- Resolves component definitions from the component library
- Recursively traverses composite component nodes
- Prevents infinite recursion with a visited set (handles circular references)
- Returns `true` if any sequential primitive is found at any nesting level

### 2. `hasSequentialComponents()`

Checks if the current circuit contains any sequential components, including those nested inside composite components.

## Changes Made

### New File: `/src/features/visual-editor/lib/component-utils.ts`

```typescript
export function containsSequentialComponent(
  componentType: string,
  components: Record<string, Component>,
  resolveComponent: (name: string) => Circuit | undefined,
  visited: Set<string> = new Set()
): boolean
```

### Modified File: `/src/features/visual-editor/components/ClockControls.tsx`

**Changed:**
1. Added imports for `useComponentLibraryStore` and `hasSequentialComponents`
2. Added `resolveComponent` from the component library store
3. Replaced direct type checking with `hasSequentialComponents()` call in two locations:
   - In the initialization `useEffect`
   - In the render return check

**Before:**
```typescript
const hasSequential = Object.values(components).some(
  (c) => c.type === 'D_FLIP_FLOP' || c.type === 'REGISTER' || c.type === 'RAM'
);
```

**After:**
```typescript
const hasSequential = hasSequentialComponents(components, resolveComponent);
```

### New File: `/src/features/visual-editor/lib/component-utils.test.ts`

Comprehensive test suite covering:
- Sequential primitive type detection (both old and new naming)
- Combinational primitive type detection
- Composite components containing sequential primitives
- Composite components with only combinational logic
- Deeply nested composite components
- Undefined components
- Circular reference handling
- Integration with `hasSequentialComponents()`

## Testing

All 11 new tests pass:
- Sequential primitive detection (old IR: `D_FLIP_FLOP`, `REGISTER`, `RAM`)
- Sequential primitive detection (new IR v0.1: `DFlipFlop`, `Register`, `RAM`)
- Composite component analysis
- Deep nesting support
- Circular reference protection
- Full integration scenarios

All existing tests (173 tests) continue to pass, confirming no regressions.

## Behavior After Fix

1. **Primitive sequential components** (e.g., placing a `D_FLIP_FLOP` directly on canvas): Clock controls appear ✓
2. **Composite components containing sequential primitives** (e.g., placing `DFlipFlopTest` which contains a `DFlipFlop`): Clock controls now appear ✓
3. **Deeply nested composites** (e.g., a component containing `DFlipFlopTest`): Clock controls appear ✓
4. **Pure combinational circuits**: Clock controls correctly do not appear ✓

## Technical Notes

### Naming Convention Handling

The fix handles two different naming conventions:

1. **Old IR** (`/src/features/visual-editor/types/ir.ts`):
   - `D_FLIP_FLOP`, `REGISTER`, `RAM`
   - Used by canvas component instances

2. **New IR v0.1** (`/src/features/visual-editor/types/ir-v0.1.ts`):
   - `DFlipFlop`, `Register`, `RAM`
   - Used by component library definitions

The `isSequentialPrimitive()` helper function checks both conventions to ensure compatibility.

### Performance Considerations

- Uses memoization via `visited` set to prevent redundant checks
- Handles circular component references without infinite loops
- Minimal overhead: only checks component definitions when needed

### Edge Cases Handled

1. **Circular references**: Component A references B, B references A
2. **Missing components**: Component not found in library (returns `false`)
3. **Mixed nesting**: Composite containing both sequential and combinational components
4. **Deep nesting**: Multiple levels of composite hierarchy

## Files Changed

- **New**: `/src/features/visual-editor/lib/component-utils.ts`
- **New**: `/src/features/visual-editor/lib/component-utils.test.ts`
- **Modified**: `/src/features/visual-editor/components/ClockControls.tsx`

## Verification Steps

To verify the fix works:

1. Create a DSL circuit that contains a sequential primitive:
   ```dsl
   circuit DFlipFlopTest {
     input d: Bit
     input clk: Bit
     output q: Bit
     output q_bar: Bit

     impl {
       node dff: DFlipFlop
       connect d -> dff.d
       connect clk -> dff.clk
       connect dff.q -> q
       connect dff.q_bar -> q_bar
     }
   }
   ```

2. Place `DFlipFlopTest` on the canvas
3. Connect switches and LEDs
4. Verify that clock controls (Step/Run/Pause/Reset) appear in the toolbar

## Future Considerations

- The utility functions in `component-utils.ts` could be extended to detect other component properties (e.g., clock domains, memory usage)
- Consider caching component analysis results for better performance with large circuits
- Could extend to provide detailed reports on what sequential components were found and where

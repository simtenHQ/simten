# Testbench Split Mode Bug Fix

## Issue Summary

When loading a circuit DSL file in split mode and then running a testbench, the VCD output was incomplete:
- Stimulus signals (inputs) changed correctly
- Output signals showed initial value but never updated
- Simulation appeared to stop early

## Root Cause

**File:** `src/features/visual-editor/components/VisualEditor.tsx`

In split mode, when DSL circuits were compiled, they were displayed on the canvas but **NOT registered in the component library**. This caused the testbench compiler to fail to resolve the circuit reference.

### The Bug

The `handleDSLCompile` callback (lines 33-38) only called:
```typescript
setCompiledCircuits(circuits, dslCode);
```

This stored circuits in the DSL preview store but did NOT register them for use by other components.

### Comparison

**DSL Editor mode** (DSLEditor.tsx line 185):
```typescript
registerUser(circuit); // ✅ Registers circuits
```

**Split mode** (VisualEditor.tsx):
```typescript
setCompiledCircuits(circuits, dslCode); // ❌ Did NOT register circuits
```

## The Fix

Added component library registration to split mode compilation:

```typescript
const handleDSLCompile = useCallback(
  (circuits: Circuit[], dslCode: string) => {
    // Register all compiled circuits in the component library
    // so they can be referenced by testbenches and other circuits
    circuits.forEach((circuit) => {
      registerUser(circuit);
    });

    setCompiledCircuits(circuits, dslCode);
  },
  [setCompiledCircuits, registerUser]
);
```

## Impact

**Before fix:**
- Loading Counter.dsl in split mode → displayed but not in library
- Loading SimpleCounter.tb.dsl → couldn't find Counter circuit
- Testbench used incomplete/empty circuit
- VCD output broken (no output signal changes)

**After fix:**
- Loading Counter.dsl in split mode → displayed AND registered
- Loading SimpleCounter.tb.dsl → finds Counter circuit correctly
- Testbench runs with proper circuit
- VCD output correct with incrementing count values

## Testing

Verified with existing test: `counter-vcd.test.ts`
- Test loads Counter.dsl programmatically
- Compiles and runs testbench
- Generates valid VCD with incrementing count
- All assertions pass ✅

## User Workflow

**Correct workflow** (now works):
1. Load circuit DSL in any mode (visual/DSL/split)
2. Switch to visual editor tab
3. Paste testbench DSL in testbench panel
4. Click "Load Testbench"
5. Use clock controls to run simulation
6. Download VCD file

The circuit is now properly registered and available to the testbench compiler regardless of which tab/mode it was loaded in.

## Related Files

- `src/features/visual-editor/components/VisualEditor.tsx` - Fixed
- `src/features/dsl/components/DSLEditor.tsx` - Reference implementation
- `src/features/visual-editor/stores/component-library-store.ts` - Library store
- `src/features/visual-editor/stores/dsl-preview-store.ts` - Preview store
- `src/features/dsl/compiler/testbench-compiler.ts` - Circuit resolution

## Date

2026-02-04

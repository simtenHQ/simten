# Nested Sequential Components Bug Investigation - RESOLVED

## Summary

**Status:** ✅ RESOLVED - No simulator bug found

**Root Cause:** Test setup issue - missing primitive component registration

**Date:** 2026-02-03

---

## Investigation Timeline

### Initial Report
Tests in `nested-sequential-test.test.ts` were failing with:
1. **Test 1 (Simple Register):** Output was `0` instead of `42`
2. **Test 2 (Counter with Feedback):** "Cycle detected in circuit" error

This appeared to indicate that nested sequential components weren't working.

### Key Discovery
The test assertions were using the WRONG API:
```typescript
// INCORRECT ❌
const output = node?.outputs.find(o => o.name === 'dataOut');
expect(output?.value).toBe(42); // Port definitions don't store values!
```

Port definitions in the IR don't store runtime values. Values are stored in the simulation result's `portValues` Map.

```typescript
// CORRECT ✅
const result = runSimulationTick(circuit, seqState);
const outputValue = result.portValues.get('nodeId.portName');
expect(outputValue).toBe(42);
```

### Test Correction
After fixing the test assertions, the real problem was revealed through debug logging:

```
[initCircuit] circuit=SimpleReg, prefix="reg_instance.", nodes=2
  node=reg, componentRef=Register, found=false, kind=undefined
  node=we_const, componentRef=Constant, found=false, kind=undefined
```

**The primitives weren't registered!**

When `initializeSequentialState` recursed into the nested `SimpleReg` composite, it couldn't find `Register` or `Constant` in the component library because the test only registered the user-defined composites but not the primitives.

### Solution
Added primitive registration to the test's `beforeAll` hook:

```typescript
beforeAll(() => {
  // Register primitives first (required for nested components to work)
  const store = useComponentLibraryStore.getState();
  store.clearAll();
  store.registerPrimitives(getPrimitives());

  // Register user-defined composites
  store.registerUser(registerCircuit);
  store.registerUser(counterCircuit);
});
```

---

## Test Results

### Before Fix
```
❌ Test 1: expected +0 to be 42
❌ Test 2: expected 'Cycle detected in circuit' to be undefined
```

### After Fix
```
✅ Test 1: Register correctly outputs 42 after one clock tick
✅ Test 2: Counter correctly increments 0 → 1 → 2 → 3 → 4 → 5
```

```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

---

## Verification

Ran full simulator test suite:
```
✓ src/features/visual-editor/lib/nested-sequential-test.test.ts (2 tests) 7ms
✓ src/features/visual-editor/lib/simulator-v0.1.test.ts (24 tests) 14ms

Test Files  2 passed (2)
     Tests  26 passed (26)
```

All tests pass. No regressions.

---

## Simulator Behavior Confirmed

The simulator **correctly** handles nested sequential components:

1. **State Initialization:** `initializeSequentialState` properly recurses into composites and initializes internal sequential component state with scoped keys (e.g., `reg_instance.reg`)

2. **State Scoping:** `evaluateComposite` creates scoped sequential state by remapping global keys:
   - Global: `reg_instance.reg` → Scoped: `reg`
   - This allows the internal circuit to use local node IDs

3. **Output Propagation:** Composite outputs are correctly extracted from internal simulation results and returned to the parent circuit

4. **Feedback Loops:** The counter test proves that feedback loops within nested composites work correctly - the cycle detection correctly identifies these as sequential (not combinational) cycles

---

## Lessons Learned

1. **Test Setup is Critical:** Tests must mirror production environment setup (registering primitives, initializing stores, etc.)

2. **Correct API Usage:** Use `result.portValues.get()` to read simulation outputs, not `node.outputs[].value`

3. **Debug Strategically:** Adding targeted logging at key points (state initialization, composite evaluation) quickly revealed the root cause

4. **The Simulator is Robust:** No bugs were found in the simulator's handling of nested composites. The hierarchical state management and evaluation works as designed.

---

## Files Modified

### Test File
- `src/features/visual-editor/lib/nested-sequential-test.test.ts`
  - Added `getPrimitives()` import
  - Added primitive registration in `beforeAll`
  - Fixed test assertions to use `result.portValues.get()`
  - Removed duplicate circuit definitions
  - Removed debug logging

### No Simulator Changes Required
The simulator is working correctly. No changes were needed to:
- `src/features/visual-editor/lib/simulator-v0.1.ts`

---

## Conclusion

**The "bug" was in the test, not the simulator.**

Nested sequential components work correctly. The simulator properly:
- Initializes state for nested composites recursively
- Scopes state using hierarchical node IDs
- Evaluates composites with correct state isolation
- Propagates outputs from nested components
- Handles feedback loops within composites

This investigation validates the robustness of the hierarchical simulation architecture.

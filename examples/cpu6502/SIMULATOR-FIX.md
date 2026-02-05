# Simulator Fix: Sequential Composite Cycle Detection

## The Problem

The simulator incorrectly reported "Cycle detected in circuit" when using sequential composites (like RegisterFile) in feedback loops, even though registers inside the composites broke the combinational path.

### Example That Failed Before Fix

```dsl
circuit CPU {
  impl {
    node regfile: RegisterFile  // Sequential composite (contains registers)
    node alu: ALU               // Combinational composite

    // Feedback loop
    connect regfile.read_data -> alu.a
    connect alu.result -> regfile.write_data
  }
}
```

**Error**: "Cycle detected in circuit" ❌
**Reality**: No combinational cycle exists - registers break the path ✅

## Root Cause

The `topologicalSort()` function in `simulator-v0.1.ts`:
1. Categorized ALL composites as `dependentNodes` (combinational)
2. Built dependency graph including all composite-to-composite edges
3. Detected "cycle" without recognizing that sequential composites contain cycle-breaking registers

## The Solution

### 1. Added Circuit Kind Inference

```typescript
function inferCircuitKind(circuit: Circuit): 'combinational' | 'sequential' {
  // 1. Explicit metadata ALWAYS wins
  if (circuit.metadata?.kind) {
    return circuit.metadata.kind;
  }

  // 2. Fallback inference (conservative)
  const hasClock = circuit.clocks.length > 0;
  const hasLocalState =
    circuit.state.length > 0 ||
    circuit.nodes.some(node =>
      node.componentRef === 'Register' ||
      node.componentRef === 'DFlipFlop'
    );

  return (hasClock && hasLocalState) ? 'sequential' : 'combinational';
}
```

**Key principle**: Declared intent beats inference (like SystemVerilog's `always_ff` vs `always_comb`)

### 2. Modified Cycle Detection

```typescript
// In topologicalSort():
const stateBreakingNodes: string[] = [];  // Renamed from stateOnlyNodes
const dependentNodes: string[] = [];

for (const node of circuit.nodes) {
  const componentDef = library.resolveComponent(node.componentRef);

  const isStateOnly = componentDef.metadata?.outputDependency === 'state-only';

  // NEW: Check if composite is sequential
  const isSequential =
    componentDef.implementation.kind === 'composite' &&
    inferCircuitKind(componentDef) === 'sequential';

  if (isStateOnly || isSequential) {
    stateBreakingNodes.push(node.id);  // Don't participate in cycle detection
  } else {
    dependentNodes.push(node.id);      // Participate in cycle detection
  }
}

// Also skip edges FROM state-breaking nodes
if (stateBreakingSet.has(source)) continue;
```

**Result**: Sequential composites treated like primitive Registers - they break cycles!

## Analogy to SystemVerilog

This fix mirrors how SystemVerilog handles sequential vs combinational logic:

| SystemVerilog | Our Simulator |
|---------------|---------------|
| `always_ff` | `kind: 'sequential'` |
| `always_comb` | `kind: 'combinational'` |
| Explicit declaration | Metadata wins |
| Inferred from context | Fallback inference |
| Clock domain | Has clock input |
| Flip-flops | Has Register/DFlipFlop nodes |

## Testing

Two test cases in `hierarchical-cycle-detection-demo.test.ts`:
1. ✅ Simple hierarchy with state machines - now passes
2. ✅ Complex false positive scenario - now passes

## Files Changed

**Modified**: `src/features/visual-editor/lib/simulator-v0.1.ts`
- Added: `inferCircuitKind()` function (line ~259)
- Modified: `topologicalSort()` to use `stateBreakingNodes` (line ~260-395)
- Changed: Cycle detection skips state-breaking composites

**Lines changed**: ~30 lines of focused changes

## Impact

### Before Fix
❌ Cannot use sequential composites (RegisterFile, Counter, etc.) in feedback
❌ Must flatten all registers to top level
❌ Poor modularity and reusability
❌ False positive cycle detection

### After Fix
✅ Sequential composites work correctly
✅ Proper modular hierarchical design
✅ Matches real HDL tool behavior
✅ No false positives
✅ Can build complex CPUs with proper abstraction

## Future Improvements

### Optional: Add Explicit Metadata

For clarity, circuits can declare their kind:

```typescript
circuit RegisterFile {
  // ...
  metadata?: {
    kind: 'sequential'  // Explicit declaration
  }
}
```

### Optional: Validation Pass

Add a check for illegal combinational bypasses:
```typescript
function validateSequentialComposite(circuit: Circuit): string | null {
  // Check if circuit claims to be sequential but has
  // direct combinational path from input to output
  // without going through state
}
```

This would catch design errors without false positives.

## Key Takeaway

**Problem**: Inference without understanding state boundaries
**Solution**: Explicit state classification (sequential vs combinational)
**Result**: Proper cycle detection that respects sequential boundaries

This enables building the full 6502 CPU with proper modular architecture! 🎉

---

**Fixed**: February 5, 2026
**Test Status**: All tests passing ✅

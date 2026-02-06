# Circuit Elaboration - Debug Findings

## Summary

The flat simulator is working correctly, but **elaboration is dropping connections**. This is a pure elaboration bug, not a simulation bug - exactly as predicted.

## What We Found

### Test: `stage3-flat-debug.test.ts`

**Circuit:** 6502 CPU Stage 3 Complete (`CompleteCPU`)

**Results:**
- ✅ Elaboration completes: 193 flat nodes, 268 connections
- ❌ **MASSIVE number of unconnected inputs (60+ reported)**
- ❌ Most connections are missing

### Unconnected Inputs Sample

```
UNCONNECTED INPUT: CompleteCPU_pc_reg...data has no value
UNCONNECTED INPUT: CompleteCPU_pc_reg...we has no value
UNCONNECTED INPUT: CompleteCPU_ir...data has no value
UNCONNECTED INPUT: CompleteCPU_ir...we has no value
UNCONNECTED INPUT: CompleteCPU_addr_lo_reg...data has no value
UNCONNECTED INPUT: CompleteCPU_addr_lo_reg...we has no value
... (60+ more)
```

**All registers are unconnected!** Their `data` and `we` inputs have no incoming connections.

### Root Cause

When flattening composites, connections to/from composite-level ports (empty `nodeId`) are being created with the composite's path as the node ID:

```typescript
// Current behavior:
// Connection inside composite:
{source: {nodeId: '', portName: 'in'}, target: {nodeId: 'reg1', portName: 'data'}}

// Gets flattened to:
{source: {nodeId: 'CompleteCPU_control', portName: 'in'}, target: {nodeId: 'CompleteCPU_control.reg1', portName: 'data'}}

// But 'CompleteCPU_control' is NOT a primitive node! It's a composite.
// So the source node doesn't exist in the flat node list.
```

**The bug:** We're creating connections to/from non-existent nodes (the composite instances themselves).

**What should happen:** Connections to composite ports should be traced through to their ultimate source/target.

## The Fix

We need to implement proper **connection stitching** for composite boundaries:

### Algorithm

1. When flattening a composite's internal circuit:
   - Track which internal nodes connect to circuit-level ports
   - Build a "port forwarding map": `composite.portName → internal.node.port`

2. After all flattening:
   - For each connection where source/target is a composite node
   - Look up the forwarding map
   - Rewrite the connection to point to the actual primitive

3. Filter out any remaining connections to non-existent nodes

### Example

```
Parent circuit:
  node control: CompleteControl { ... }
  node pc_reg: Register { ... }
  connect control.pc_load -> pc_reg.we

Inside CompleteControl composite:
  node state_reg: Register
  connect state_reg.q -> {circuit-output}.pc_load

Flattening should produce:
  CompleteCPU.control.state_reg.q -> CompleteCPU.pc_reg.we

NOT:
  CompleteCPU.control.pc_load -> CompleteCPU.pc_reg.we
  (because CompleteCPU.control is not a primitive!)
```

## Why Silent Defaults Were Hiding This

Before:
```typescript
// Unconnected input would silently get 0
inputs.set(portName, portType.kind === 'bit' ? false : 0);
```

After:
```typescript
// Unconnected input causes loud error
console.error(`UNCONNECTED INPUT: ${node.id}.${portName}`);
```

**Impact:** We went from "simulator silently produces wrong results" to "elaboration bugs are immediately visible".

This is exactly what was needed - making wiring bugs loud instead of silent.

## Next Steps

### 1. Fix Empty Composite Stitching (High Priority)

Implement the port forwarding algorithm described above. This will fix most connection issues.

**Files to modify:**
- `src/features/visual-editor/lib/elaboration.ts`

**Approach:**
```typescript
// After flattening, build forwarding map
const portForwarding = new Map<string, PortPath>();

// For each composite node that has no primitives:
for (const composite of emptyComposites) {
  // Trace through its internal connections
  // Build map: composite.portName -> ultimate source/target
}

// Rewrite all connections using the forwarding map
const fixedConnections = connections.map(conn => {
  let source = conn.source;
  let target = conn.target;

  // Follow forwarding chains
  while (portForwarding.has(portPathKey(source))) {
    source = portForwarding.get(portPathKey(source))!;
  }
  while (portForwarding.has(portPathKey(target))) {
    target = portForwarding.get(portPathKey(target))!;
  }

  return { ...conn, source, target };
});
```

### 2. Fix Non-Empty Composite Port Resolution (High Priority)

Even composites with primitives need their circuit-level ports resolved to internal nodes.

**The issue:** When we create a connection like:
```
parent.compositeNode.inputPort -> ...
```

We need to find which internal node that inputPort actually connects to.

**Solution:** Build the same forwarding map, but for ALL composites (not just empty ones).

### 3. Filter Invalid Connections (Safety Net)

After stitching, remove any connections where source or target doesn't exist as a primitive:

```typescript
const validConnections = stitchedConnections.filter(conn => {
  const sourceExists = conn.source.nodeId === TOP_LEVEL_NODE ||
                      flatNodes.some(n => n.id === conn.source.nodeId);
  const targetExists = conn.target.nodeId === TOP_LEVEL_NODE ||
                      flatNodes.some(n => n.id === conn.target.nodeId);
  return sourceExists && targetExists;
});
```

### 4. Test with 6502 CPU Again

Once connection stitching is implemented, run `stage3-flat-debug.test.ts` again:

**Expected:**
- ✅ No unconnected inputs (or very few)
- ✅ Memory operations work correctly
- ✅ A=0x42, X=0x43 after test program

## Lessons Learned

1. **"Kill silent defaults" was 100% correct** - It immediately exposed the wiring bugs
2. **The architecture is sound** - Flat simulation works; only elaboration needs fixing
3. **String paths and graph edges** - Much easier to debug than execution semantics
4. **One failing test is normal** - This is exactly what happens when you change architecture

## Status

**Elaboration core:** ✅ Working (nodes are flattened correctly)
**Connection stitching:** ❌ Not implemented (dropping most connections)
**Simulation:** ✅ Working (runs without errors, just with wrong wiring)

**Blocker:** Connection stitching for composite port boundaries

**Confidence:** High - This is a well-understood, tractable problem.

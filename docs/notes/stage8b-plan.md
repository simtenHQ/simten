# Stage 8B: Full Memory Infrastructure

**Status:** Ready for Implementation
**Prerequisite:** Stage 8A Complete (16-bit PC working, 194 tests passing)
**Goal:** Expand memory to full 64KB address space with proper memory map

---

## Current State (Stage 8A Complete)

- 16-bit PC (`pc_lo` + `pc_hi`) working correctly
- PC increments across page boundaries ($00FF → $0100)
- JMP/JSR/RTS load full 16-bit addresses
- Branches work with sign-extended offsets across pages
- `addr_hi` correctly outputs `pc_hi` during fetch
- `addr_hi_reg` used for absolute addressing

**Current Limitations:**
- ROM primitive limited to 8-bit addresses (256 bytes max)
- ROM at $0000 (overlays RAM) instead of $C000-$FFFF
- RAM only 256 bytes instead of 2KB
- No reset vector fetch from $FFFC/$FFFD

---

## Target Memory Map

```
$0000-$00FF  Zero Page (RAM)
$0100-$01FF  Stack (RAM)
$0200-$07FF  General RAM
$0800-$BFFF  Unmapped (open bus)
$C000-$FFFF  ROM (16KB)
  $FFFC-$FFFD  Reset Vector
```

---

## Implementation Tasks

### Task 1: Update ROM Primitive to 16-bit Addressing

**File:** `src/features/visual-editor/lib/primitive-registry.ts`

**Current (line ~1527):**
```typescript
ROM: defineSequential({
  inputs: [{ name: 'addr', portType: busType(8) }],  // 8-bit
  state: [{
    stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
    initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
  }],
  // ...
  createComponent: (id) => {
    const addressWidth: number = 8;  // 8-bit
    // ...
  },
})
```

**Change to:**
```typescript
ROM: defineSequential({
  inputs: [{ name: 'addr', portType: busType(16) }],  // 16-bit
  state: [{
    stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
    initialValue: { data: new Map(), addressWidth: 16, dataWidth: 8 },
  }],
  // ...
  createComponent: (id) => {
    const addressWidth: number = 16;  // 16-bit
    // ...
  },
})
```

**Risk:** This changes the ROM primitive globally. Need to verify no other circuits break.

---

### Task 2: Create AddressCombiner Primitive

**File:** `src/features/visual-editor/lib/primitive-registry.ts`

Need a way to combine `addr_hi` (8-bit) and `addr_lo` (8-bit) into a 16-bit address for ROM.

**New primitive:**
```typescript
AddressCombiner: defineCombinational({
  name: 'AddressCombiner',
  description: 'Combines two 8-bit buses into one 16-bit bus (hi << 8 | lo)',
  category: 'utilities',
  icon: '⊕16',
  componentType: 'AddressCombiner',
  inputs: [
    { name: 'lo', portType: busType(8) },
    { name: 'hi', portType: busType(8) },
  ],
  outputs: [{ name: 'out', portType: busType(16) }],
  evaluate: (inputs) => {
    const lo = inputs.get('lo') as number;
    const hi = inputs.get('hi') as number;
    return new Map([['out', (hi << 8) | lo]]);
  },
}),
```

---

### Task 3: Create RAM2K Circuit

**File:** `examples/cpu6502/32-memory-bus.dsl`

**New circuit:**
```dsl
// === RAM2K: 2KB RAM at $0000-$07FF ===
circuit RAM2K {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]
  input data_in: Bus[8]
  input we: Bit

  output data_out: Bus[8]
  output responds: Bit    // True if this device handles the address

  clock clk

  impl {
    // RAM responds to $0000-$07FF (addr_hi < 8)
    node eight: Constant(value=8)
    node addr_hi_cmp: Comparator
    connect addr_hi -> addr_hi_cmp.a
    connect eight.out -> addr_hi_cmp.b
    connect addr_hi_cmp.lt -> responds  // addr_hi < 8

    // Use 11-bit address: addr_hi[2:0] << 8 | addr_lo
    // For now, use separate RAMs or a larger RAM primitive
    // Simplified: use addr_lo for 256-byte pages, selected by addr_hi[2:0]

    node ram: RAM
    connect clk -> ram.clk
    connect addr_lo -> ram.addr
    connect data_in -> ram.data_in

    // Only write if we respond to this address
    node write_enable: And
    connect responds -> write_enable.a
    connect we -> write_enable.b
    connect write_enable.out -> ram.we

    connect ram.data_out -> data_out
  }
}
```

**Note:** Current RAM primitive is 256 bytes. For true 2KB, either:
1. Create a larger RAM primitive (RAM2K in primitives.ts)
2. Use 8 separate 256-byte RAMs with page selection
3. Accept 256-byte limitation for now (still works for most programs)

**Recommendation:** Start with option 3, upgrade later if needed.

---

### Task 4: Create ROM16K Circuit

**File:** `examples/cpu6502/32-memory-bus.dsl`

**New circuit:**
```dsl
// === ROM16K: 16KB ROM at $C000-$FFFF ===
circuit ROM16K {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]

  output data_out: Bus[8]
  output responds: Bit    // True if this device handles the address

  impl {
    // ROM responds to $C000-$FFFF (addr_hi >= 0xC0)
    node c0: Constant(value=192)  // 0xC0
    node addr_hi_cmp: Comparator
    connect addr_hi -> addr_hi_cmp.a
    connect c0.out -> addr_hi_cmp.b

    // responds = addr_hi >= 0xC0 (i.e., NOT lt)
    node not_lt: Not
    connect addr_hi_cmp.lt -> not_lt.in
    connect not_lt.out -> responds

    // Combine address for 16-bit ROM lookup
    node addr_combine: AddressCombiner
    connect addr_lo -> addr_combine.lo
    connect addr_hi -> addr_combine.hi

    // ROM with test program and reset vector
    node rom: ROM(data={
      // Reset vector points to $C000
      0xFFFC: 0x00,  // Reset vector low byte
      0xFFFD: 0xC0,  // Reset vector high byte -> $C000

      // Program at $C000 (same test as before)
      0xC000: 0x38,  // SEC
      0xC001: 0x78,  // SEI
      0xC002: 0x08,  // PHP
      0xC003: 0x18,  // CLC
      0xC004: 0x58,  // CLI
      0xC005: 0x28,  // PLP
      0xC006: 0xA9,  // LDA #$0F
      0xC007: 0x0F,
      0xC008: 0x29,  // AND #$F0
      0xC009: 0xF0,
      0xC00A: 0x09,  // ORA #$F0
      0xC00B: 0xF0,
      0xC00C: 0xC8,  // INY
      0xC00D: 0xC8,  // INY
      0xC00E: 0xCA,  // DEX
      0xC00F: 0xEA,  // NOP
    })
    connect addr_combine.out -> rom.addr
    connect rom.data_out -> data_out
  }
}
```

---

### Task 5: Update MemoryBus with New Address Decode

**File:** `examples/cpu6502/32-memory-bus.dsl`

Replace current `MemoryBus` with new address decode:

```dsl
circuit MemoryBus {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]
  input data_in: Bus[8]
  input rw: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    // Memory devices
    node ram: RAM2K
    node rom: ROM16K

    connect clk -> ram.clk
    connect addr_lo -> ram.addr_lo
    connect addr_hi -> ram.addr_hi
    connect data_in -> ram.data_in

    connect addr_lo -> rom.addr_lo
    connect addr_hi -> rom.addr_hi

    // RAM write enable: ram.responds AND NOT(rw)
    node not_rw: Not
    connect rw -> not_rw.in

    node ram_we: And
    connect ram.responds -> ram_we.a
    connect not_rw.out -> ram_we.b
    connect ram_we.out -> ram.we

    // Open bus register (latches last read value)
    node open_bus: Register
    connect clk -> open_bus.clk

    // Data output mux chain: open_bus -> RAM -> ROM
    // Priority: ROM > RAM > open_bus
    node data_mux_ram: Mux
    connect ram.responds -> data_mux_ram.sel
    connect open_bus.q -> data_mux_ram.in0
    connect ram.data_out -> data_mux_ram.in1

    node data_mux_rom: Mux
    connect rom.responds -> data_mux_rom.sel
    connect data_mux_ram.out -> data_mux_rom.in0
    connect rom.data_out -> data_mux_rom.in1

    connect data_mux_rom.out -> data_out

    // Update open bus on reads
    node any_device: Or
    connect ram.responds -> any_device.a
    connect rom.responds -> any_device.b

    node open_bus_we: And
    connect any_device.out -> open_bus_we.a
    connect rw -> open_bus_we.b

    connect open_bus_we.out -> open_bus.we
    connect data_mux_rom.out -> open_bus.data
  }
}
```

---

### Task 6: Add Reset Vector Fetch to CPU

**File:** `examples/cpu6502/33-cpu-core.dsl`

The CPU needs to fetch the reset vector from $FFFC/$FFFD on startup.

**Approach:** Add reset states to FSM

**In Stage6Control, add new states:**
```dsl
// Reset sequence states
node state_reset_lo: Constant(value=253)  // State for reading $FFFC
node state_reset_hi: Constant(value=254)  // State for reading $FFFD

// On reset signal, go to RESET_LO state instead of FETCH
// RESET_LO: output addr=$FFFC, read data -> pc_lo_temp
// RESET_HI: output addr=$FFFD, read data -> pc_hi_temp
// Then: load pc_lo from pc_lo_temp, pc_hi from pc_hi_temp
// Then: go to FETCH state
```

**Key changes needed:**
1. FSM starts in RESET_LO state (not FETCH) when reset=1
2. RESET_LO outputs addr_lo=$FC, addr_hi=$FF, reads to pc_lo_temp
3. RESET_HI outputs addr_lo=$FD, addr_hi=$FF, reads to pc_hi_temp
4. After RESET_HI, load PC from temps and go to FETCH

**New control signals:**
- `is_reset_lo`: True during reset vector low byte fetch
- `is_reset_hi`: True during reset vector high byte fetch
- `reset_load_pc`: True to load PC from reset vector temps

---

### Task 7: Create stage8b.test.ts

**File:** `examples/cpu6502/test/stage8b.test.ts`

```typescript
describe('6502 CPU Stage 8B: Full Memory Infrastructure', () => {
  describe('ROM16K', () => {
    it('should respond to addresses $C000-$FFFF');
    it('should not respond to addresses below $C000');
    it('should read reset vector from $FFFC/$FFFD');
  });

  describe('RAM2K', () => {
    it('should respond to addresses $0000-$07FF');
    it('should not respond to addresses $0800 and above');
    it('should allow read/write to zero page ($0000-$00FF)');
    it('should allow read/write to stack ($0100-$01FF)');
  });

  describe('Memory Map', () => {
    it('should return open bus for unmapped addresses ($0800-$BFFF)');
    it('should prioritize ROM over RAM for overlapping addresses');
  });

  describe('Reset Vector', () => {
    it('should fetch PC from $FFFC/$FFFD on reset');
    it('should start execution at address from reset vector');
    it('should execute program at $C000 after reset');
  });

  describe('Full System', () => {
    it('should execute test program from ROM at $C000');
    it('should use RAM at $0000 for zero page operations');
    it('should use RAM at $0100 for stack operations');
  });
});
```

---

## Implementation Order

1. **Task 2: AddressCombiner primitive** - Needed for 16-bit ROM addressing
2. **Task 1: Update ROM to 16-bit** - Enable larger address space
3. **Task 4: ROM16K circuit** - ROM at $C000-$FFFF with reset vector
4. **Task 3: RAM2K circuit** - RAM at $0000-$07FF (or keep 256-byte for now)
5. **Task 5: Update MemoryBus** - New address decode logic
6. **Task 6: Reset vector fetch** - CPU fetches PC from $FFFC/$FFFD
7. **Task 7: Tests** - Verify everything works

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ROM primitive change breaks other circuits | High | Check all existing tests, ROM is widely used |
| Reset FSM states complex | Medium | Add states incrementally, test each |
| Address decode logic errors | Medium | Comprehensive tests for boundary addresses |
| RAM size limitation (256 vs 2KB) | Low | Most test programs fit in 256 bytes |

---

## Success Criteria

- [ ] ROM primitive accepts 16-bit addresses
- [ ] ROM16K responds to $C000-$FFFF only
- [ ] RAM responds to $0000-$07FF only
- [ ] Reset vector fetched from $FFFC/$FFFD
- [ ] CPU starts execution at reset vector address
- [ ] Open bus returns last read value for unmapped addresses
- [ ] All 194 existing tests still pass
- [ ] New stage8b.test.ts tests pass

---

## Files to Modify

| File | Changes |
|------|---------|
| `primitives.ts` | ROM: 8-bit → 16-bit, add AddressCombiner |
| `32-memory-bus.dsl` | RAM2K, ROM16K, new MemoryBus address decode |
| `33-cpu-core.dsl` | Reset vector fetch states in FSM |
| `34-system.dsl` | Minor updates if needed |
| `stage7-combined.dsl` | Regenerate after changes |
| `test/stage8b.test.ts` | New test file |

---

*Plan Created: 2026-02-09*
*Based on: 6502-cpu-plan.md Stage 8B requirements*

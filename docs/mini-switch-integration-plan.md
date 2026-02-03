# MiniSwitch2Port Integration Plan

## Overview

This document provides step-by-step integration guidance for assembling the 2-port packet switch from tested components.

**Goal:** Wire 5 tested components + RAMs into a working end-to-end system.

**Estimated Complexity:** ~200 lines of DSL wiring

---

## Component Inventory

### Input Components (2×)
1. **MacRxParser** (tested ✓)
   - Inputs: byte_in, valid, clk_in
   - Outputs: data_out, sof, eof, data_valid, error

2. **IngressController** (tested ✓)
   - Inputs: data_in, sof, eof, data_valid, grant
   - Outputs: buf_addr, buf_data, buf_we, pkt_ready, buf_full
   - Internal: write_ptr, pkt_count, byte_count

### Central Components (1×)
3. **SimpleArbiter2Port** (tested ✓)
   - Inputs: port0_ready, port1_ready, forwarder_done
   - Outputs: grant_port, grant_valid

4. **PacketForwarder2Port** (tested ✓)
   - Inputs: grant_port, grant_valid, port0_read_ptr, port1_read_ptr
   - Outputs: ingress_addr, ingress_re, egress_addr, egress_we, done
   - Internal: ingress_port, output_port, byte_counter

### Output Components (2×)
5. **EgressController** (tested ✓)
   - Inputs: pkt_ready, trigger
   - Outputs: egress_addr, egress_re, byte_out, data_valid, sof, eof, ready

### Memory Components (4×)
6. **RAM** (primitive)
   - 2× Ingress RAMs (32 bytes each: 4 packets × 8 bytes)
   - 2× Egress RAMs (16 bytes each: 2 packets × 8 bytes)

---

## Top-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Port 0 Input                                                    │
│   raw_byte[8], valid                                            │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ MacRxParser0  │
    └───────┬───────┘
            │ data, sof, eof, valid
            ▼
    ┌───────────────────┐         ┌──────────┐
    │IngressController0 │◄────────┤ RAM0     │ (ingress buffer)
    └───────┬───────────┘  grant  │ 32 bytes │
            │ pkt_ready            └──────────┘
            │
            ▼
    ┌──────────────────────────────────────────┐
    │        SimpleArbiter2Port                │
    │  port0_ready, port1_ready → grant        │
    └───────┬──────────────────────────────────┘
            │ grant_port, grant_valid
            ▼
    ┌──────────────────────────────────────────┐
    │      PacketForwarder2Port                │
    │  Reads ingress RAMs, writes egress RAMs  │
    └───────┬──────────────────────────────────┘
            │ done
            ▼
    ┌─────────────┬─────────────┐
    │ Egress0     │ Egress1     │
    │ (port 0)    │ (port 1)    │
    └──────┬──────┴──────┬──────┘
           │             │
    ┌──────▼──────┐ ┌───▼────────┐
    │ RAM_egress0 │ │RAM_egress1 │
    │ 16 bytes    │ │16 bytes    │
    └──────┬──────┘ └───┬────────┘
           │            │
    ┌──────▼────────────▼──────┐
    │ EgressController0/1      │
    └──────┬────────────────────┘
           │ byte_out, valid, sof, eof
           ▼
    Port 0/1 Output
```

---

## Signal Routing Details

### 1. Port 0 Ingress Path

**External → MacRxParser0:**
```
circuit inputs:
  p0_byte[8] → MacRxParser0.byte_in
  p0_valid   → MacRxParser0.valid
```

**MacRxParser0 → IngressController0:**
```
MacRxParser0.data_out   → IngressController0.data_in
MacRxParser0.sof        → IngressController0.sof
MacRxParser0.eof        → IngressController0.eof
MacRxParser0.data_valid → IngressController0.data_valid
```

**IngressController0 ↔ RAM0:**
```
IngressController0.buf_addr → RAM0.addr
IngressController0.buf_data → RAM0.data_in (from MacRxParser0.data_out)
IngressController0.buf_we   → RAM0.we
RAM0.data_out               → (not used by ingress, only forwarder reads)
```

**IngressController0 → Arbiter:**
```
IngressController0.pkt_ready → SimpleArbiter2Port.port0_ready
```

**Arbiter → IngressController0:**
```
SimpleArbiter2Port.grant_port   → (compare to 0)
SimpleArbiter2Port.grant_valid  → (AND with grant_port==0)
→ IngressController0.grant
```

### 2. Port 1 Ingress Path

(Identical to Port 0, just with "1" suffix)

**External → MacRxParser1 → IngressController1 → RAM1 → Arbiter**

```
p1_byte[8], p1_valid → MacRxParser1 → IngressController1 ↔ RAM1
IngressController1.pkt_ready → SimpleArbiter2Port.port1_ready
grant_port==1 → IngressController1.grant
```

### 3. Arbiter ↔ Forwarder

**Arbiter → Forwarder:**
```
SimpleArbiter2Port.grant_port  → PacketForwarder2Port.grant_port
SimpleArbiter2Port.grant_valid → PacketForwarder2Port.grant_valid
```

**Forwarder → Arbiter:**
```
PacketForwarder2Port.done → SimpleArbiter2Port.forwarder_done
```

### 4. Forwarder ↔ Ingress RAMs (Read)

**Challenge:** Forwarder needs to read from RAM0 or RAM1 based on grant_port.

**Solution:** Mux RAM addresses and data

**Read Pointers:**
```
IngressController0.write_ptr → PacketForwarder2Port.port0_read_ptr
IngressController1.write_ptr → PacketForwarder2Port.port1_read_ptr
```

**Address Mux:**
```
// Inside forwarder: ingress_addr = selected_read_ptr + byte_counter
// But which RAM to access?

// Mux RAM address based on grant_port
node ingress_ram_addr: Mux
  .in0 = PacketForwarder2Port.ingress_addr  // Use for RAM0
  .in1 = PacketForwarder2Port.ingress_addr  // Use for RAM1
  .sel = (PacketForwarder2Port.ingress_port == 1)

// Actually, we need TWO separate connections:
RAM0.addr = PacketForwarder2Port.ingress_addr  // when ingress_port == 0
RAM1.addr = PacketForwarder2Port.ingress_addr  // when ingress_port == 1

// Data comes back from both, forwarder selects:
node ingress_data: Mux
  .in0 = RAM0.data_out
  .in1 = RAM1.data_out
  .sel = PacketForwarder2Port.ingress_port
```

**Simplified Approach:**
Connect both RAMs, forwarder reads from both, muxes the data internally.

```
PacketForwarder2Port.ingress_addr → RAM0.addr (port 0 read)
PacketForwarder2Port.ingress_addr → RAM1.addr (port 1 read)

RAM0.data_out → ingress_data_mux.in0
RAM1.data_out → ingress_data_mux.in1
PacketForwarder2Port.ingress_port → ingress_data_mux.sel
```

### 5. Forwarder ↔ Egress RAMs (Write)

**Challenge:** Forwarder writes to egress_ram[output_port].

**Solution:** Demux write enables

```
// Forwarder provides:
PacketForwarder2Port.egress_addr  → (goes to both egress RAMs)
PacketForwarder2Port.egress_we    → (needs to be demuxed)
ingress_data_mux.out              → (data to write)

// Demux write enable:
node egress0_we: And
  .a = PacketForwarder2Port.egress_we
  .b = (PacketForwarder2Port.output_port == 0)

node egress1_we: And
  .a = PacketForwarder2Port.egress_we
  .b = (PacketForwarder2Port.output_port == 1)

// Connect to RAMs:
PacketForwarder2Port.egress_addr → RAM_egress0.addr
PacketForwarder2Port.egress_addr → RAM_egress1.addr
ingress_data_mux.out → RAM_egress0.data_in
ingress_data_mux.out → RAM_egress1.data_in
egress0_we → RAM_egress0.we
egress1_we → RAM_egress1.we
```

### 6. Egress Path

**Forwarder → EgressControllers:**
```
PacketForwarder2Port.done → (trigger both egress controllers)
// Actually, need to route done to correct egress controller

node egress0_trigger: And
  .a = PacketForwarder2Port.done
  .b = (PacketForwarder2Port.output_port == 0)

node egress1_trigger: And
  .a = PacketForwarder2Port.done
  .b = (PacketForwarder2Port.output_port == 1)
```

**EgressController ↔ Egress RAMs:**
```
EgressController0.egress_addr → RAM_egress0.addr
EgressController0.egress_re   → (not used for RAM, just internal control)
RAM_egress0.data_out → EgressController0.byte_out (external connection)

EgressController1.egress_addr → RAM_egress1.addr
RAM_egress1.data_out → EgressController1.byte_out
```

**EgressController → Output:**
```
EgressController0.byte_out   → p0_out[8]
EgressController0.data_valid → p0_valid_out
EgressController0.sof        → p0_sof_out
EgressController0.eof        → p0_eof_out

(same for EgressController1 → port 1 outputs)
```

---

## Critical Wiring Issues & Solutions

### Issue 1: Multi-Reader RAM Access

**Problem:** Ingress RAMs are written by IngressController, read by PacketForwarder.

**Solution:** Dual-port RAM
- Port A: IngressController writes
- Port B: PacketForwarder reads

```
node ingress_ram0: DualPortRAM
  // Port A (write by IngressController0)
  .addrA = IngressController0.buf_addr
  .dataInA = MacRxParser0.data_out
  .weA = IngressController0.buf_we

  // Port B (read by PacketForwarder)
  .addrB = PacketForwarder2Port.ingress_addr  // when ingress_port==0
  .dataOutB → ingress_data_mux.in0
```

### Issue 2: Grant Signal Splitting

**Problem:** grant_valid goes to both IngressControllers, but only one should receive it.

**Solution:** AND with port match

```
node grant_to_port0: Comparator
  .a = SimpleArbiter2Port.grant_port
  .b = ZERO  // 0

node port0_grant_signal: And
  .a = SimpleArbiter2Port.grant_valid
  .b = grant_to_port0.eq

→ IngressController0.grant = port0_grant_signal
```

### Issue 3: Forwarder Needs Write Pointers

**Problem:** PacketForwarder needs to know where each IngressController is writing.

**Solution:** Expose write_ptr as output from IngressController

**Modification needed:** IngressController doesn't currently output write_ptr.

**Workaround:**
- IngressController manages buffers internally
- PacketForwarder always reads from offset 0 (oldest packet)
- IngressController maintains read/write pointers internally

**Better approach:**
- Add output wire: `IngressController.read_offset → PacketForwarder.portN_read_ptr`

### Issue 4: Egress RAM Conflicts

**Problem:** PacketForwarder writes to egress RAMs, EgressController reads from same RAMs.

**Solution:** Dual-port RAM (again)
- Port A: PacketForwarder writes
- Port B: EgressController reads

---

## Integration Steps (Sequential)

### Step 1: Ingress Path (Port 0 Only)
**Goal:** Get packets into ingress RAM

1. Instantiate: MacRxParser0, IngressController0, DualPortRAM0
2. Wire: External input → Parser → Controller → RAM (Port A)
3. Test: Send packet, verify RAM contains data

### Step 2: Add Port 1 Ingress
**Goal:** Both ports can receive

1. Duplicate Step 1 for port 1
2. Test: Send to port 0, send to port 1, verify both RAMs

### Step 3: Add Arbiter
**Goal:** Arbiter grants based on pkt_ready

1. Instantiate: SimpleArbiter2Port
2. Wire: pkt_ready signals → arbiter
3. Wire: grant → IngressControllers (with port matching)
4. Test: Trigger pkt_ready on port 0 → verify grant

### Step 4: Add Forwarder
**Goal:** Forwarder reads ingress, writes egress

1. Instantiate: PacketForwarder2Port, DualPortRAM_egress0, DualPortRAM_egress1
2. Wire: Arbiter → Forwarder (grant signals)
3. Wire: Forwarder → Ingress RAMs (Port B read)
4. Wire: Forwarder → Egress RAMs (Port A write)
5. Wire: Forwarder.done → Arbiter.forwarder_done
6. Test: Grant port 0 → verify packet copied from ingress0 to egress1 (cross-over)

### Step 5: Add Egress Controllers
**Goal:** Packets serialized to output

1. Instantiate: EgressController0, EgressController1
2. Wire: Forwarder.done → EgressController triggers (demuxed by output_port)
3. Wire: EgressControllers → Egress RAMs (Port B read)
4. Wire: EgressControllers → External outputs
5. Test: End-to-end packet flow

### Step 6: Full Integration Test
**Goal:** Complete packet flow

1. Send packet to port 0 (DA=1) → verify emerges at port 1
2. Send packet to port 1 (DA=0) → verify emerges at port 0
3. Send to both ports → verify arbitration
4. Fill buffer → verify backpressure

---

## DSL Template Structure

```dsl
circuit MiniSwitch2Port {
  impl {
    // ========================================================================
    // External Inputs/Outputs
    // ========================================================================

    // Port 0 inputs
    node p0_byte: Input
    node p0_valid: Input

    // Port 1 inputs
    node p1_byte: Input
    node p1_valid: Input

    // Constants
    node ZERO: Input
    node ONE: Input

    // ========================================================================
    // Component Instantiation
    // ========================================================================

    // MAC RX Parsers
    node parser0: MacRxParser
    node parser1: MacRxParser

    // Ingress Controllers
    node ingress0: IngressController
    node ingress1: IngressController

    // Ingress Buffers (dual-port RAMs)
    node ram_ingress0: DualPortRAM
    node ram_ingress1: DualPortRAM

    // Arbiter
    node arbiter: SimpleArbiter2Port

    // Forwarder
    node forwarder: PacketForwarder2Port

    // Egress Buffers (dual-port RAMs)
    node ram_egress0: DualPortRAM
    node ram_egress1: DualPortRAM

    // Egress Controllers
    node egress0: EgressController
    node egress1: EgressController

    // ========================================================================
    // Port 0 Ingress Wiring
    // ========================================================================

    connect p0_byte.out -> parser0.byte_in
    connect p0_valid.out -> parser0.valid

    connect parser0.data_out -> ingress0.data_in
    connect parser0.sof -> ingress0.sof
    connect parser0.eof -> ingress0.eof
    connect parser0.data_valid -> ingress0.data_valid

    // Port 1 ingress (similar)...

    // ========================================================================
    // Arbiter Wiring
    // ========================================================================

    connect ingress0.pkt_ready -> arbiter.port0_ready
    connect ingress1.pkt_ready -> arbiter.port1_ready
    connect forwarder.done -> arbiter.forwarder_done

    // Grant demux (port 0)
    node grant_is_port0: Comparator
    connect arbiter.grant_port -> grant_is_port0.a
    connect ZERO.out -> grant_is_port0.b

    node grant_to_port0: And
    connect arbiter.grant_valid -> grant_to_port0.a
    connect grant_is_port0.eq -> grant_to_port0.b

    connect grant_to_port0.out -> ingress0.grant

    // (similar for port 1)

    // ========================================================================
    // Forwarder Wiring
    // ========================================================================

    connect arbiter.grant_port -> forwarder.grant_port
    connect arbiter.grant_valid -> forwarder.grant_valid

    // Ingress RAM read (Port B)
    // ... (complex muxing as described above)

    // Egress RAM write (Port A)
    // ... (complex demuxing as described above)

    // ========================================================================
    // Egress Wiring
    // ========================================================================

    // Trigger demux
    // RAM reads (Port B)
    // Output connections

    // ========================================================================
    // Debug Outputs
    // ========================================================================

    node debug_arbiter_grant: HexDisplay
    connect arbiter.grant_port -> debug_arbiter_grant.in

    // ... more debug outputs
  }
}
```

---

## Testing Strategy

### Unit Tests (Already Done ✓)
- All 5 components compile and pass structure tests

### Integration Tests (Incremental)

**Test 1: Ingress Only**
```
Input: Port 0 receives preamble + packet
Expected: RAM0 contains packet data
Verify: RAM0[0..7] == packet bytes
```

**Test 2: Arbiter Grant**
```
Input: ingress0.pkt_ready = 1
Expected: arbiter.grant_port = 0, grant_valid = 1
```

**Test 3: Forwarder Copy**
```
Input: Grant port 0, RAM0 has packet
Expected: Packet copied to RAM_egress1 (cross-over)
Verify: RAM_egress1[0..7] == RAM0[0..7]
```

**Test 4: End-to-End**
```
Input: Send packet to port 0
Expected:
  - Cycle 0-10: Preamble + SFD + packet received
  - Cycle 11-15: Buffered in RAM0
  - Cycle 16: Arbiter grants port 0
  - Cycle 17-25: Forwarder copies to RAM_egress1
  - Cycle 26-34: EgressController1 transmits
  - Cycle 35: Packet emerges at port 1
```

### Golden Trace Format

```
Cycle | Event
------|---------------------------------------------------------
0     | p0_byte=0x55, p0_valid=1 (preamble start)
1-6   | Preamble continues
7     | p0_byte=0xD5 (SFD)
8     | parser0.sof=1, parser0.data_out=0x12 (header)
9-14  | Packet data bytes
15    | parser0.eof=1, ingress0.pkt_ready=1
16    | arbiter.grant_port=0, grant_valid=1
17    | forwarder enters READ_HEADER state
18    | forwarder enters WAIT_HEADER (RAM latency)
19    | forwarder enters ROUTE state
20-27 | forwarder copies bytes to RAM_egress1
28    | forwarder.done=1, egress1_trigger=1
29    | egress1 enters TRANSMIT state
30-37 | egress1.byte_out = packet bytes, data_valid=1
38    | egress1.eof=1, egress1 back to IDLE
```

---

## Potential Issues & Mitigations

### Issue: RAM Address Width Mismatch
**Symptom:** Compiler error about bus width
**Fix:** Ensure all addresses are 8-bit (even if only using 0-31)

### Issue: Clock Domains
**Symptom:** Setup/hold violations in simulation
**Fix:** All components use same clock (single-domain design)

### Issue: Grant Pulse Too Short
**Symptom:** IngressController misses grant signal
**Fix:** Arbiter holds grant_valid high until forwarder_done

### Issue: Buffer Pointer Confusion
**Symptom:** Forwarder reads wrong data
**Fix:** Clearly document: IngressController manages write_ptr, Forwarder uses it as read base

### Issue: Egress Trigger Missed
**Symptom:** EgressController doesn't transmit
**Fix:** Forwarder.done must pulse on correct cycle, demux logic must route to right controller

---

## Success Metrics

### Compilation
- [ ] MiniSwitch2Port.dsl compiles without errors
- [ ] All sub-circuits resolved correctly
- [ ] No width mismatches

### Functionality
- [ ] Port 0 → Port 1 forwarding works
- [ ] Port 1 → Port 0 forwarding works
- [ ] Simultaneous packets arbitrated correctly
- [ ] Buffer overflow handled gracefully

### Timing
- [ ] No combinational loops
- [ ] FSMs advance correctly each cycle
- [ ] RAM latency respected throughout

---

## Estimated Line Count Breakdown

| Section | Lines |
|---------|-------|
| External I/O declarations | 20 |
| Component instantiation | 15 |
| Constants | 5 |
| Port 0 ingress wiring | 15 |
| Port 1 ingress wiring | 15 |
| Arbiter connections | 20 |
| Grant demux logic | 15 |
| Forwarder ↔ ingress RAMs | 25 |
| Forwarder ↔ egress RAMs | 25 |
| Egress trigger demux | 15 |
| Egress RAM connections | 15 |
| Output wiring | 10 |
| Debug displays | 10 |
| **Total** | **~205 lines** |

---

## Next Steps After Integration

1. **Visualization:** Create circuit diagram showing packet flow
2. **Performance Analysis:** Measure throughput (packets/cycle), latency (cycles from ingress to egress)
3. **Documentation:** Record design decisions and trade-offs
4. **Demo Script:** Prepare 2-3 demo scenarios for presentation
5. **Extension:** Add MAC learning (if time permits)

---

## Conclusion

This integration plan provides:
- Clear component connections
- Step-by-step build process
- Testing strategy
- Issue anticipation

**Complexity Assessment:** Medium-high
- Most complexity is in mux/demux logic for multi-RAM access
- Individual components are already tested
- Integration is primarily wiring, not logic

**Time Estimate:** 2-3 hours for implementation, 1-2 hours for testing

**Risk Level:** Medium
- Well-defined interfaces reduce risk
- Incremental testing catches issues early
- Dual-port RAM availability is key assumption

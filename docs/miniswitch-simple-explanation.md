# MiniSwitch2Port - Simple Visual Explanation

## The Problem: Current Demo Isn't Clear

The current demo (`MiniSwitch2Port-Demo-Complete.dsl`) has **40+ components** and only shows:
- ✅ Packet generation
- ✅ Packet parsing
- ✅ Packet buffering
- ✅ Forwarding

But it **doesn't clearly show SWITCHING** because:
- ❌ Only one input port is active (Port 0)
- ❌ No routing decisions visible
- ❌ No contention (arbiter has nothing to arbitrate)
- ❌ Too many technical indicators (`debug_grant_valid`, etc.)

---

## What a Switch Demo Should Show

To demonstrate **switching behavior**, users need to see:

### 1. Multiple Input Sources
```
Port 0: 🔵●●●●●●●● (sending packets)
Port 1: 🟢●●●●●●●● (also sending packets)
```

### 2. Contention & Arbitration
```
Both ports want to send → Arbiter picks winner → One goes first
```

### 3. Routing to Destinations
```
Port 0 packet → routed to → Port 1 output
Port 1 packet → routed to → Port 0 output
```

---

## Proposed Simple Demo Layout

### Visual Indicators (6 total)

```
INPUT STAGE:
┌─────────────────────────────────────┐
│ 🔵 Port 0 Receiving  [LED]          │
│ 🟢 Port 1 Receiving  [LED]          │
└─────────────────────────────────────┘

BUFFERING STAGE:
┌─────────────────────────────────────┐
│ 📦 Port 0 Packet Ready  [LED]       │
│ 📦 Port 1 Packet Ready  [LED]       │
└─────────────────────────────────────┘

ARBITRATION (Who Wins?):
┌─────────────────────────────────────┐
│ ⚡ Port 0 Granted Access  [LED]     │
│ ⚡ Port 1 Granted Access  [LED]     │
└─────────────────────────────────────┘

OUTPUT STAGE:
┌─────────────────────────────────────┐
│ 📤 Port 0 Transmitting  [LED]       │
│ 📤 Port 1 Transmitting  [LED]       │
└─────────────────────────────────────┘
```

### Expected Behavior

**Cycle 0-15**: Port 0 sends packet
- 🔵 Port 0 Receiving = ON
- 🟢 Port 1 Receiving = OFF

**Cycle 16**: Packet buffered
- 📦 Port 0 Packet Ready = ON

**Cycle 17**: Arbiter grants Port 0
- ⚡ Port 0 Granted Access = ON

**Cycle 18-25**: Packet forwarded to output
- 📤 Port 1 Transmitting = ON (routed to Port 1)

**Cycle 10-25**: Port 1 ALSO sends packet (overlapping!)
- 🟢 Port 1 Receiving = ON
- 📦 Port 1 Packet Ready = ON (waiting...)
- ⚡ Port 0 Granted Access = ON (Port 0 won, Port 1 must wait)

**Cycle 26**: Port 0 done, arbiter switches
- ⚡ Port 1 Granted Access = ON (now Port 1's turn!)

**Cycle 27-34**: Port 1's packet forwarded
- 📤 Port 0 Transmitting = ON (routed to Port 0)

---

## What Needs to Change

### Option 1: Two PacketGenerators (Best for Demo)

**Challenge**: Need phase offset parameter
```dsl
node gen0: PacketGenerator(phase=0)   // Starts at cycle 0
node gen1: PacketGenerator(phase=10)  // Starts at cycle 10
```

**Benefit**: Real contention, clear arbitration

### Option 2: Manual Stimulus (Testbench)

Use the new testbench system to inject packets with precise timing:
```dsl
stimulus on clk {
  // Port 0 packet
  at 0..15: p0_byte = ..., p0_valid = 1

  // Port 1 packet (overlapping!)
  at 10..25: p1_byte = ..., p1_valid = 1
}
```

**Benefit**: Full control over timing
**Challenge**: Requires testbench integration (Phase 1 is done!)

### Option 3: Simplified Static Demo

Show the switching concept with just LEDs and muxes, no real packets:
```dsl
circuit SwitchConcept {
  // Two buttons (simulating packet arrival)
  input p0_request: Bit
  input p1_request: Bit

  // Arbiter decides
  node arbiter: Arbiter

  // Outputs show who won
  output p0_granted: Bit
  output p1_granted: Bit
}
```

**Benefit**: Crystal clear, minimal components
**Challenge**: Not a "real" switch, just the concept

---

## Recommendation

### Immediate: Create Testbench-Based Demo

Use the testbench system (already implemented!) to create a demo with precise two-port stimulus:

**File**: `MiniSwitch2Port-Switching.tb.dsl`

```dsl
testbench SwitchingDemo {
  use circuit MiniSwitch2Port as dut

  impl {
    stimulus on clk {
      // Port 0 sends packet starting at cycle 0
      at 0..15: p0_byte = [preamble sequence], p0_valid = 1

      // Port 1 sends packet starting at cycle 10 (OVERLAPS!)
      at 10..25: p1_byte = [preamble sequence], p1_valid = 1

      // Watch the arbiter decide!
    }

    capture {
      signals: [p0_valid, p1_valid, grant_port, p0_output, p1_output]
      format: vcd
    }
  }
}
```

**Benefits**:
- ✅ Shows real two-port contention
- ✅ Clear arbitration behavior
- ✅ Can export VCD for GTKWave visualization
- ✅ Uses existing testbench infrastructure

### Medium-term: Add PacketGenerator Phase Parameter

Extend PacketGenerator to support phase offset:
```dsl
node gen0: PacketGenerator(phase=0)
node gen1: PacketGenerator(phase=10)
```

Then rebuild the demo with two active generators.

---

## Current Status

The demo **works technically** but doesn't **communicate "switching"** to users because:
1. Only one port is active
2. No visible contention/arbitration
3. Too many components cluttering the view

**Next step**: Create testbench-based demo or simplify PacketGenerator with phase parameter?

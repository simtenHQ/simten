# MiniSwitch2Port Visual Demo Guide

## How to Run the Demo

### Step 1: Load the Complete Demo File

In the visual editor, load:
```
dsl-files/MiniSwitch2Port-Demo-Complete.dsl
```

**Important**: Use the `-Complete` version! This file includes all component definitions in one file, so you don't need to load dependencies separately.

### Step 2: Click "Run"

That's it! The circuit will automatically start processing packets.

## What You'll See

The demo uses a **PacketGenerator** that automatically sends packets on Port 0 every 20 clock cycles:

- **Cycles 0-6**: Preamble bytes (0x55)
- **Cycle 7**: SFD byte (0xD5)
- **Cycles 8-15**: Packet data (0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22)
- **Cycles 16-19**: Idle gap
- **Cycle 20**: Loop repeats

## Key Components to Watch

### 🟢 Debug Indicators (LEDs)

1. **debug_gen_valid** - Lights up when packet generator is transmitting
   - ON for cycles 0-15
   - OFF for cycles 16-19

2. **debug_ingress0_ready** - Lights up when packet is buffered in ingress RAM
   - Turns ON after packet is fully received

3. **debug_grant_valid** - Lights up when arbiter grants access to forwarder
   - Pulses when forwarding begins

4. **p1_valid_out** - Lights up when packet is being transmitted on Port 1
   - Shows output activity

### 📊 Debug Displays (HexDisplays)

1. **debug_gen_byte** - Shows current byte from packet generator
   - 0x55 during preamble
   - 0xD5 for SFD
   - 0xAA, 0xBB, 0xCC... for packet data

2. **p1_out** - Shows packet bytes being transmitted on Port 1
   - Displays forwarded packet data

3. **debug_grant_port** - Shows which port arbiter granted (0 or 1)

4. **debug_forwarder_output_port** - Shows destination port for current packet

## How the Packet Flows

```
PacketGenerator → MacRxParser → IngressController → RAM
                                       ↓
                                   Arbiter
                                       ↓
                                 Forwarder → RAM → EgressController → Port 1 Output
```

## What Makes This Work

### The PacketGenerator Component

Automatically cycles through a complete packet sequence:
- Counter increments from 0 to 19
- Mux chain selects the right byte for each cycle
- Valid signal turns on/off automatically
- Loops infinitely

### Fixed Components

All component files now have:
- ✅ Write enable signals properly set to 1 (were broken with Switch nodes)
- ✅ Constants initialized with values (e.g., `Input(value=85)` for preamble)

## Timeline (Approximate)

- **Cycles 0-15**: Packet generator sends packet
- **Cycles 16-19**: Packet generator idle
- **~Cycle 17**: Ingress buffer ready (debug_ingress0_ready lights up)
- **~Cycle 18**: Arbiter grants access (debug_grant_valid lights up)
- **~Cycles 19-26**: Forwarder copies packet to egress RAM
- **~Cycles 27-34**: Egress controller transmits on Port 1 (p1_valid_out lights up)
- **Cycle 20**: Next packet starts...

## Files

- **⭐ Main Demo (USE THIS)**: `dsl-files/MiniSwitch2Port-Demo-Complete.dsl` - All-in-one file with all components
- **Separate Files** (for reference):
  - `dsl-files/MiniSwitch2Port-Demo.dsl` - Demo circuit only
  - `dsl-files/PacketGenerator.dsl` - Auto packet generator
  - `dsl-files/MacRxParser.dsl`, etc. - Individual components
- **Test Output**: Run `pnpm test:run dsl-files/test/MiniSwitch2Port-Demo.test.ts -t complete` to see activity log

## What This Demonstrates

✅ **Hierarchical Cycle Detection** - Complex nested circuit with 40+ registers compiles without false cycle errors

✅ **Automatic Packet Processing** - Just click Run, no manual input needed

✅ **Real FSM Behavior** - State machines transition, counters increment, packets flow

✅ **Complete Data Path** - From packet generator through parsing, buffering, arbitration, forwarding, to transmission

This is a **production-quality demonstration** of the hierarchical cycle detection fix enabling real-world digital system designs!

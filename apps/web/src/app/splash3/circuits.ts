/**
 * Demo circuits for the splash page.
 *
 * Each circuit has:
 * - displayDsl: The circuit definition shown to users
 * - dsl: Full DSL including wrapper with Switch/LED nodes for simulation
 */

export interface CircuitDefinition {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const CIRCUITS: Record<string, CircuitDefinition> = {
  inverter: {
    name: "NOT Gate",
    description: "Inverts the input signal",
    displayDsl: `circuit Not {
  input a: Bit
  output out: Bit
  impl {
    node nand1: Nand
    connect a -> nand1.a
    connect a -> nand1.b
    connect nand1.out -> out
  }
}`,
    // Use unique name "NotGate" to avoid conflict with primitive "Not"
    dsl: `
circuit NotGate {
  input a: Bit
  output out: Bit
  impl {
    node nand1: Nand
    connect a -> nand1.a
    connect a -> nand1.b
    connect nand1.out -> out
  }
}

circuit DemoNot {
  impl {
    node sw_a: Switch
    node dut: NotGate
    node led_out: Led
    connect sw_a.out -> dut.a
    connect dut.out -> led_out.in
  }
}`,
  },

  and: {
    name: "AND Gate",
    description: "Output is 1 only when both inputs are 1",
    displayDsl: `circuit And {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> out
  }
}`,
    dsl: `
circuit And {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> out
  }
}

circuit DemoAnd {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: And
    node led_out: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.out -> led_out.in
  }
}`,
  },

  or: {
    name: "OR Gate",
    description: "Output is 1 when either input is 1",
    displayDsl: `circuit Or {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand
    connect a -> not_a.a
    connect a -> not_a.b
    connect b -> not_b.a
    connect b -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out
  }
}`,
    dsl: `
circuit Or {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand
    connect a -> not_a.a
    connect a -> not_a.b
    connect b -> not_b.a
    connect b -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out
  }
}

circuit DemoOr {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: Or
    node led_out: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.out -> led_out.in
  }
}`,
  },

  xor: {
    name: "XOR Gate",
    description: "Output is 1 when inputs are different",
    displayDsl: `circuit Xor {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect a -> nand2.a
    connect nand1.out -> nand2.b
    connect nand1.out -> nand3.a
    connect b -> nand3.b
    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b
    connect nand4.out -> out
  }
}`,
    dsl: `
circuit Xor {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect a -> nand2.a
    connect nand1.out -> nand2.b
    connect nand1.out -> nand3.a
    connect b -> nand3.b
    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b
    connect nand4.out -> out
  }
}

circuit DemoXor {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: Xor
    node led_out: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.out -> led_out.in
  }
}`,
  },

  halfAdder: {
    name: "Half Adder",
    description: "Adds two bits, outputs sum and carry",
    displayDsl: `circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}`,
    dsl: `
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit DemoHalfAdder {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: HalfAdder
    node led_sum: Led
    node led_carry: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.sum -> led_sum.in
    connect dut.carry -> led_carry.in
  }
}`,
  },

  fullAdder: {
    name: "Full Adder",
    description: "Adds three bits (a, b, carry-in)",
    displayDsl: `circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}`,
    // Include HalfAdder and Or dependencies so it's self-contained
    dsl: `
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit Or {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand
    connect a -> not_a.a
    connect a -> not_a.b
    connect b -> not_b.a
    connect b -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out
  }
}

circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}

circuit DemoFullAdder {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_cin: Switch
    node dut: FullAdder
    node led_sum: Led
    node led_cout: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect sw_cin.out -> dut.cin
    connect dut.sum -> led_sum.in
    connect dut.cout -> led_cout.in
  }
}`,
  },

  mux: {
    name: "Multiplexer",
    description: "sel=0 picks a, sel=1 picks b",
    displayDsl: `circuit Mux {
  input a: Bit
  input b: Bit
  input sel: Bit
  output out: Bit
  impl {
    node not_sel: Not
    node and_a: And
    node and_b: And
    node or_out: Or
    connect sel -> not_sel.in
    connect a -> and_a.a
    connect not_sel.out -> and_a.b
    connect b -> and_b.a
    connect sel -> and_b.b
    connect and_a.out -> or_out.a
    connect and_b.out -> or_out.b
    connect or_out.out -> out
  }
}`,
    // Use unique name "MuxGate" to avoid conflict with primitive "Mux"
    dsl: `
circuit MuxGate {
  input a: Bit
  input b: Bit
  input sel: Bit
  output out: Bit
  impl {
    node not_sel: Not
    node and_a: And
    node and_b: And
    node or_out: Or
    connect sel -> not_sel.in
    connect a -> and_a.a
    connect not_sel.out -> and_a.b
    connect b -> and_b.a
    connect sel -> and_b.b
    connect and_a.out -> or_out.a
    connect and_b.out -> or_out.b
    connect or_out.out -> out
  }
}

circuit DemoMux {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_sel: Switch
    node dut: MuxGate
    node led_out: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect sw_sel.out -> dut.sel
    connect dut.out -> led_out.in
  }
}`,
  },

  delayLine: {
    name: "2-Cycle Delay",
    description: "Data takes 2 clock ticks to reach output",
    displayDsl: `circuit DelayLine {
  input d: Bit
  clock clk
  output q1: Bit
  output q2: Bit
  impl {
    node dff1: DFlipFlop
    node dff2: DFlipFlop
    connect clk -> dff1.clk
    connect clk -> dff2.clk
    connect d -> dff1.d
    connect dff1.q -> dff2.d
    connect dff1.q -> q1
    connect dff2.q -> q2
  }
}`,
    dsl: `
circuit DelayLine {
  input d: Bit
  clock clk
  output q1: Bit
  output q2: Bit
  impl {
    node dff1: DFlipFlop
    node dff2: DFlipFlop
    connect clk -> dff1.clk
    connect clk -> dff2.clk
    connect d -> dff1.d
    connect dff1.q -> dff2.d
    connect dff1.q -> q1
    connect dff2.q -> q2
  }
}

circuit DemoDelayLine {
  clock clk
  impl {
    node sw_d: Switch
    node dut: DelayLine
    node led_q1: Led
    node led_q2: Led
    connect clk -> dut.clk
    connect sw_d.out -> dut.d
    connect dut.q1 -> led_q1.in
    connect dut.q2 -> led_q2.in
  }
}`,
  },
};

export const CIRCUIT_KEYS = Object.keys(CIRCUITS) as (keyof typeof CIRCUITS)[];

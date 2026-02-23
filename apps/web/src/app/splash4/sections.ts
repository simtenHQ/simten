/**
 * Section definitions for the scrolling splash page.
 * Each section tells part of the story and has an interactive circuit.
 */

export interface SectionDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  hint?: string;
  dsl: string;
  align: "left" | "right";
}

export const SECTIONS: SectionDef[] = [
  {
    id: "nand",
    title: "Everything starts with NAND",
    subtitle: "The universal gate",
    description:
      "A NAND gate outputs 0 only when both inputs are 1. That's it. From this simple rule, we can build an entire computer.",
    hint: "Click the inputs to toggle them",
    align: "right",
    dsl: `
circuit NandDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node gate: Nand
    node out: Led
    connect in_a.out -> gate.a
    connect in_b.out -> gate.b
    connect gate.out -> out.in
  }
}`,
  },
  {
    id: "not",
    title: "Two inputs, one wire",
    subtitle: "Building NOT from NAND",
    description:
      "Connect both inputs of a NAND to the same signal. Now 1 becomes 0, and 0 becomes 1. We've built an inverter.",
    align: "left",
    dsl: `
circuit NotDemo {
  impl {
    node input: Switch
    node gate: Nand
    node out: Led
    connect input.out -> gate.a
    connect input.out -> gate.b
    connect gate.out -> out.in
  }
}`,
  },
  {
    id: "and",
    title: "Invert the NAND",
    subtitle: "Building AND",
    description:
      "NAND gives us the opposite of AND. So put a NOT after it. Two NANDs working together give us AND logic.",
    align: "right",
    dsl: `
circuit AndDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node nand1: Nand
    node nand2: Nand
    node out: Led
    connect in_a.out -> nand1.a
    connect in_b.out -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> out.in
  }
}`,
  },
  {
    id: "or",
    title: "Flip the logic",
    subtitle: "Building OR",
    description:
      "Invert each input, then NAND them together. Output is 1 when either input is 1. Three NANDs make an OR gate.",
    align: "left",
    dsl: `
circuit OrDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand
    node out: Led
    connect in_a.out -> not_a.a
    connect in_a.out -> not_a.b
    connect in_b.out -> not_b.a
    connect in_b.out -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out.in
  }
}`,
  },
  {
    id: "xor",
    title: "The odd one out",
    subtitle: "Building XOR",
    description:
      "XOR outputs 1 when inputs are different. It's trickier to build, but still just four NANDs arranged cleverly.",
    align: "right",
    dsl: `
circuit XorDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand
    node out: Led
    connect in_a.out -> nand1.a
    connect in_b.out -> nand1.b
    connect in_a.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand1.out -> nand3.a
    connect in_b.out -> nand3.b
    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b
    connect nand4.out -> out.in
  }
}`,
  },
  {
    id: "half-adder",
    title: "Now we can add",
    subtitle: "The Half Adder",
    description:
      "XOR tells us if the sum is odd. AND tells us if we need to carry. Together they add two bits. This is arithmetic.",
    hint: "Try: 0+0=00, 0+1=01, 1+0=01, 1+1=10",
    align: "left",
    dsl: `
circuit HalfAdderDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node xor1: Xor
    node and1: And
    node sum: Led
    node carry: Led
    connect in_a.out -> xor1.a
    connect in_b.out -> xor1.b
    connect in_a.out -> and1.a
    connect in_b.out -> and1.b
    connect xor1.out -> sum.in
    connect and1.out -> carry.in
  }
}`,
  },
  {
    id: "full-adder",
    title: "Chain them together",
    subtitle: "The Full Adder",
    description:
      "A full adder takes a carry-in from the previous bit. Chain these together and you can add any size numbers.",
    hint: "Three inputs: A, B, and Carry-in",
    align: "right",
    dsl: `
circuit HalfAdder4 {
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

circuit FullAdderDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node in_cin: Switch
    node ha1: HalfAdder4
    node ha2: HalfAdder4
    node or1: Or
    node sum: Led
    node cout: Led
    connect in_a.out -> ha1.a
    connect in_b.out -> ha1.b
    connect ha1.sum -> ha2.a
    connect in_cin.out -> ha2.b
    connect ha2.sum -> sum.in
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout.in
  }
}`,
  },
  {
    id: "memory",
    title: "Add memory",
    subtitle: "The D Flip-Flop",
    description:
      "So far, circuits forget immediately. A flip-flop remembers. On each clock tick, it captures the input and holds it until the next tick.",
    hint: "Set input, then click Tick to capture",
    align: "left",
    dsl: `
circuit MemoryDemo {
  clock clk
  impl {
    node input: Switch
    node dff: DFlipFlop
    node stored: Led
    connect clk -> dff.clk
    connect input.out -> dff.d
    connect dff.q -> stored.in
  }
}`,
  },
];

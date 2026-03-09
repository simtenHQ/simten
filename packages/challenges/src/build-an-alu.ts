import type { ChallengeStep, ChallengeMetadata } from './types.js';

export const ALU_METADATA: ChallengeMetadata = {
  slug: 'build-an-alu',
  title: 'Build an ALU from Scratch',
  description:
    'Start with a single AND gate. End with the arithmetic heart of a CPU — addition, subtraction, AND, OR, all selected by an opcode. Seven steps from nothing to a real ALU.',
  steps: 7,
  difficulty: 'Beginner',
  tag: 'Start here',
};

export const ALU_STEPS: ChallengeStep[] = [
  // ── Step 1: Your First Gate ──────────────────────────────────────
  {
    id: "and-gate",
    title: "Your First Gate",
    concept:
      "Everything in a computer is built from logic gates. An AND gate outputs 1 only when both inputs are 1. Toggle the switches and watch the LED — that's a single transistor-level decision.",
    objective:
      "Connect the two switches to the AND gate's inputs, and connect its output to the LED.",
    hints: [
      "Switch A has an output port called 'out'. The AND gate has input ports 'a' and 'b'.",
      "Click switch A's output port (right side), then click the AND gate's 'a' port (left side).",
      "Do the same for switch B → AND gate's 'b' input.",
      "Finally connect the AND gate's 'out' port to the LED's 'in' port.",
    ],
    scaffold: `circuit FirstGate {
  impl {
    node A: Switch
    node B: Switch
    node gate: And
    node light: Led

    // Connect A and B to the gate, then gate to the LED
  }
}`,
    solution: `circuit FirstGate {
  impl {
    node A: Switch
    node B: Switch
    node gate: And
    node light: Led

    connect A.out -> gate.a
    connect B.out -> gate.b
    connect gate.out -> light.in
  }
}`,
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 120 },
      gate: { x: 250, y: 50 },
      light: { x: 470, y: 50 },
    },
    height: 220,
  },

  // ── Step 2: OR and NOT ───────────────────────────────────────────
  {
    id: "or-not",
    title: "OR and NOT",
    concept:
      "An OR gate outputs 1 when either input is 1. A NOT gate flips its input. With AND, OR, and NOT you can build any digital circuit ever made — these three are 'functionally complete'.",
    objective:
      "Wire the circuit so the LED lights when A is on OR B is on, but only when the enable switch is NOT off. (LED = (A OR B) AND (NOT enable)).",
    hints: [
      "First connect A and B to the OR gate's inputs.",
      "Connect the enable switch to the NOT gate's 'in' port.",
      "The AND gate combines the OR result with the inverted enable.",
      "Connect the AND gate's output to the LED.",
    ],
    scaffold: `circuit OrNot {
  impl {
    node A: Switch
    node B: Switch
    node enable: Switch

    node orGate: Or
    node notGate: Not
    node andGate: And
    node light: Led

    // Wire: LED = (A OR B) AND (NOT enable)
  }
}`,
    solution: `circuit OrNot {
  impl {
    node A: Switch
    node B: Switch
    node enable: Switch

    node orGate: Or
    node notGate: Not
    node andGate: And
    node light: Led

    connect A.out -> orGate.a
    connect B.out -> orGate.b
    connect enable.out -> notGate.in
    connect orGate.out -> andGate.a
    connect notGate.out -> andGate.b
    connect andGate.out -> light.in
  }
}`,
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 110 },
      enable: { x: 0, y: 230 },
      orGate: { x: 220, y: 40 },
      notGate: { x: 220, y: 210 },
      andGate: { x: 420, y: 110 },
      light: { x: 600, y: 110 },
    },
    height: 280,
  },

  // ── Step 3: The Half Adder ───────────────────────────────────────
  {
    id: "half-adder",
    title: "The Half Adder",
    concept:
      "To add two single-bit numbers you need two outputs: the sum and the carry. A XOR gate gives the sum (1+1=0 with carry, 1+0=1, 0+0=0). An AND gate gives the carry (1 only when both inputs are 1). That's it — addition from two logic gates.",
    objective:
      "Connect A and B to both the XOR (sum) and AND (carry) gates. Display the results on the LEDs.",
    hints: [
      "Both gates need the same two inputs — A and B each connect to two places.",
      "The XOR gate's output is the sum bit. Connect it to the sum LED.",
      "The AND gate's output is the carry bit. Connect it to the carry LED.",
      "Try toggling: A=1 B=1 should give sum=0, carry=1 (binary 10 = decimal 2).",
    ],
    scaffold: `circuit HalfAdder {
  impl {
    node A: Switch
    node B: Switch

    node sum: Xor
    node carry: And

    node sumLed: Led
    node carryLed: Led

    // Connect A and B to both gates
    // Connect outputs to LEDs
  }
}`,
    solution: `circuit HalfAdder {
  impl {
    node A: Switch
    node B: Switch

    node sum: Xor
    node carry: And

    node sumLed: Led
    node carryLed: Led

    connect A.out -> sum.a
    connect B.out -> sum.b
    connect A.out -> carry.a
    connect B.out -> carry.b
    connect sum.out -> sumLed.in
    connect carry.out -> carryLed.in
  }
}`,
    nodePositions: {
      A: { x: 0, y: 30 },
      B: { x: 0, y: 170 },
      sum: { x: 240, y: 0 },
      carry: { x: 240, y: 150 },
      sumLed: { x: 450, y: 0 },
      carryLed: { x: 450, y: 150 },
    },
    height: 250,
  },

  // ── Step 4: The Full Adder ───────────────────────────────────────
  {
    id: "full-adder",
    title: "The Full Adder",
    concept:
      "A half adder can't handle carry-in from a previous column. A full adder adds three bits: A, B, and carry-in. It's built from two XOR gates, two AND gates, and an OR gate. The magic: this single circuit can be chained to add numbers of any width.",
    objective:
      "Wire the full adder: sum = A XOR B XOR Cin, carry-out = (A AND B) OR ((A XOR B) AND Cin).",
    hints: [
      "First XOR: connect A and B to xor1. This gives the partial sum.",
      "Second XOR: connect xor1's output and Cin to xor2. This is the final sum.",
      "First AND: connect A and B to and1. Second AND: connect xor1's output and Cin to and2.",
      "OR gate: connect and1's output and and2's output. This is carry-out.",
    ],
    scaffold: `circuit FullAdder {
  impl {
    node A: Switch
    node B: Switch
    node Cin: Switch

    node xor1: Xor
    node xor2: Xor
    node and1: And
    node and2: And
    node orGate: Or

    node sumLed: Led
    node coutLed: Led

    // Wire the full adder logic
    // sum = A XOR B XOR Cin
    // cout = (A AND B) OR ((A XOR B) AND Cin)
  }
}`,
    solution: `circuit FullAdder {
  impl {
    node A: Switch
    node B: Switch
    node Cin: Switch

    node xor1: Xor
    node xor2: Xor
    node and1: And
    node and2: And
    node orGate: Or

    node sumLed: Led
    node coutLed: Led

    connect A.out -> xor1.a
    connect B.out -> xor1.b
    connect xor1.out -> xor2.a
    connect Cin.out -> xor2.b
    connect A.out -> and1.a
    connect B.out -> and1.b
    connect xor1.out -> and2.a
    connect Cin.out -> and2.b
    connect and1.out -> orGate.a
    connect and2.out -> orGate.b
    connect xor2.out -> sumLed.in
    connect orGate.out -> coutLed.in
  }
}`,
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 120 },
      Cin: { x: 0, y: 250 },
      xor1: { x: 200, y: 30 },
      and1: { x: 200, y: 150 },
      xor2: { x: 400, y: 30 },
      and2: { x: 400, y: 180 },
      orGate: { x: 400, y: 310 },
      sumLed: { x: 600, y: 30 },
      coutLed: { x: 600, y: 310 },
    },
    height: 360,
  },

  // ── Step 5: Multi-bit Addition ───────────────────────────────────
  {
    id: "multi-bit-adder",
    title: "Multi-Bit Addition",
    concept:
      "Now we jump from single bits to real numbers. An 8-bit Adder adds two numbers and produces a sum — it's just 8 full adders chained together internally, each carry feeding the next. Enter two numbers and see addition happen in hardware.",
    objective:
      "Connect the two inputs to the Adder and display the result. Try 3 + 5 — you should see 8.",
    hints: [
      "The Adder has two inputs: 'a' and 'b', and an output 'sum'.",
      "Connect inputA.out to the adder's 'a' port.",
      "Connect inputB.out to the adder's 'b' port.",
      "Connect the adder's 'sum' to the display's 'in' port.",
    ],
    scaffold: `circuit MultiBitAdder {
  impl {
    node inputA: Input(value=3)
    node inputB: Input(value=5)

    node adder: Adder

    node result: HexDisplay

    // Connect the inputs to the adder
    // Connect the result to the display
  }
}`,
    solution: `circuit MultiBitAdder {
  impl {
    node inputA: Input(value=3)
    node inputB: Input(value=5)

    node adder: Adder

    node result: HexDisplay

    connect inputA.out -> adder.a
    connect inputB.out -> adder.b
    connect adder.sum -> result.in
  }
}`,
    nodePositions: {
      inputA: { x: 0, y: 0 },
      inputB: { x: 0, y: 140 },
      adder: { x: 280, y: 50 },
      result: { x: 500, y: 50 },
    },
    height: 230,
  },

  // ── Step 6: Subtraction (same hardware!) ─────────────────────────
  {
    id: "subtraction",
    title: "Subtraction Is Free",
    concept:
      "Here's the trick that makes hardware beautiful: subtraction is just addition in disguise. To compute A - B, you flip all bits of B (using NOT/XOR) and add 1. In 8-bit unsigned: A - B = A + (255 - B) + 1 = A + (256 - B). The Adder doesn't know or care — it just adds.",
    objective:
      "Wire a circuit that subtracts: display should show A - B. Use a NOT gate to flip B, then add A + (NOT B) + 1.",
    hints: [
      "The Not gate flips all 8 bits of B (bitwise complement, ~B = 255 - B).",
      "Connect inputB.out to the Not gate's 'in' port.",
      "The first Adder adds A + ~B. Connect inputA and the Not output.",
      "The second Adder adds 1 (the 'plus one' in two's complement). Connect the first sum + the one constant.",
      "Display the final result. Try 10 - 3 = 7.",
    ],
    scaffold: `circuit Subtract {
  impl {
    node inputA: Input(value=10)
    node inputB: Input(value=3)

    node flipB: Not
    node addStep: Adder
    node one: Constant(value=1)
    node plusOne: Adder

    node result: HexDisplay

    // Flip B, add A + ~B, then add 1
  }
}`,
    solution: `circuit Subtract {
  impl {
    node inputA: Input(value=10)
    node inputB: Input(value=3)

    node flipB: Not
    connect inputB.out -> flipB.in

    node addStep: Adder
    connect inputA.out -> addStep.a
    connect flipB.out -> addStep.b

    node one: Constant(value=1)
    node plusOne: Adder
    connect addStep.sum -> plusOne.a
    connect one.out -> plusOne.b

    node result: HexDisplay
    connect plusOne.sum -> result.in
  }
}`,
    nodePositions: {
      inputA: { x: 0, y: 0 },
      inputB: { x: 0, y: 150 },
      flipB: { x: 200, y: 150 },
      addStep: { x: 370, y: 50 },
      one: { x: 370, y: 220 },
      plusOne: { x: 550, y: 120 },
      result: { x: 730, y: 120 },
    },
    height: 280,
  },

  // ── Step 7: The ALU ──────────────────────────────────────────────
  {
    id: "alu",
    title: "The ALU",
    concept:
      "The Arithmetic Logic Unit is the brain of every CPU. It takes two inputs and an operation code, and selects between different results. With a 2-bit opcode you get four operations: AND, OR, ADD, SUBTRACT. A Mux cascade picks which result to output. You just built the core of a processor.",
    objective:
      "Wire A and B to all four operation units (AND, OR, Add, Subtract). Use the Mux cascade to select the result based on the opcode. Opcode 0=AND, 1=OR, 2=ADD, 3=SUB.",
    hints: [
      "Connect inputA and inputB to all four operations: the AND gate, OR gate, Adder, and subtraction chain.",
      "For subtraction: NOT inputB, then add inputA + ~B + 1 (same as step 6).",
      "mux1 selects between AND (in0) and OR (in1) using opcode bit 0 (op0).",
      "mux2 selects between ADD (in0) and SUB (in1) using opcode bit 0 (op0).",
      "muxFinal selects between mux1's result (in0) and mux2's result (in1) using opcode bit 1 (op1).",
    ],
    scaffold: `circuit ALU {
  impl {
    node inputA: Input(value=12)
    node inputB: Input(value=5)
    node op0: Switch
    node op1: Switch

    node andOp: And
    node orOp: Or
    node addOp: Adder
    node flipB: Not
    node subStep: Adder
    node one: Constant(value=1)
    node subOp: Adder

    node mux1: Mux
    node mux2: Mux
    node muxFinal: Mux

    node result: HexDisplay

    // 1. Connect inputs to all four operations
    // 2. Build subtraction: NOT B, then A + ~B + 1
    // 3. Wire the mux cascade:
    //    mux1: AND vs OR (selected by op0)
    //    mux2: ADD vs SUB (selected by op0)
    //    muxFinal: mux1 vs mux2 (selected by op1)
    // 4. Connect to display
  }
}`,
    solution: `circuit ALU {
  impl {
    node inputA: Input(value=12)
    node inputB: Input(value=5)
    node op0: Switch
    node op1: Switch

    node andOp: And
    connect inputA.out -> andOp.a
    connect inputB.out -> andOp.b

    node orOp: Or
    connect inputA.out -> orOp.a
    connect inputB.out -> orOp.b

    node addOp: Adder
    connect inputA.out -> addOp.a
    connect inputB.out -> addOp.b

    node flipB: Not
    connect inputB.out -> flipB.in

    node subStep: Adder
    connect inputA.out -> subStep.a
    connect flipB.out -> subStep.b

    node one: Constant(value=1)
    node subOp: Adder
    connect subStep.sum -> subOp.a
    connect one.out -> subOp.b

    node mux1: Mux
    connect andOp.out -> mux1.in0
    connect orOp.out -> mux1.in1
    connect op0.out -> mux1.sel

    node mux2: Mux
    connect addOp.sum -> mux2.in0
    connect subOp.sum -> mux2.in1
    connect op0.out -> mux2.sel

    node muxFinal: Mux
    connect mux1.out -> muxFinal.in0
    connect mux2.out -> muxFinal.in1
    connect op1.out -> muxFinal.sel

    node result: HexDisplay
    connect muxFinal.out -> result.in
  }
}`,
    nodePositions: {
      inputA: { x: 0, y: 0 },
      inputB: { x: 0, y: 140 },
      op0: { x: 0, y: 350 },
      op1: { x: 0, y: 480 },
      andOp: { x: 230, y: 0 },
      orOp: { x: 230, y: 120 },
      addOp: { x: 230, y: 240 },
      flipB: { x: 230, y: 370 },
      subStep: { x: 400, y: 340 },
      one: { x: 400, y: 470 },
      subOp: { x: 560, y: 380 },
      mux1: { x: 490, y: 50 },
      mux2: { x: 490, y: 230 },
      muxFinal: { x: 700, y: 140 },
      result: { x: 880, y: 140 },
    },
    height: 460,
  },
];

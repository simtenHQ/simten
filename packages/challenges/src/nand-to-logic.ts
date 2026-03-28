import type { ChallengeLevel, ChallengeMetadata } from "./types.js";

export const NAND_METADATA: ChallengeMetadata = {
  slug: "nand-to-logic",
  title: "From NAND to Logic",
  description:
    "Every digital circuit ever built can be constructed from a single gate: NAND. Start with nothing but NAND gates and build NOT, AND, OR, XOR, and a half adder — proving that one humble gate is all you need.",
  levels: 7,
  difficulty: "Beginner",
  tag: "Start here",
};

export const NAND_LEVELS: ChallengeLevel[] = [
  // ── Level 1: Meet NAND ──────────────────────────────────────────────
  {
    id: "meet-nand",
    title: "Meet NAND",
    concept:
      "A NAND gate outputs 0 only when both inputs are 1. Every other combination gives 1. It's the opposite of AND — that's where the name comes from (Not-AND). This single gate can build every digital circuit in existence.",
    objective:
      "Wire the two switches to the NAND gate and connect its output to the LED. Toggle both switches ON — the LED should turn OFF. That's NAND: 'not both'.",
    hints: [
      "Connect A.out to the NAND gate's 'a' input.",
      "Connect B.out to the NAND gate's 'b' input.",
      "Connect the NAND gate's 'out' to the LED's 'in'.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit MeetNand {
  impl {
    node A: Switch
    node B: Switch
    node gate: Nand
    node light: Led

    // Wire A and B to the NAND gate, then NAND to the LED:
    // connect A.out -> gate.a
    // connect B.out -> gate.b
    // connect gate.out -> light.in
  }
}`,
    solution: `circuit MeetNand {
  impl {
    node A: Switch
    node B: Switch
    node gate: Nand
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

  // ── Level 2: NOT from NAND ──────────────────────────────────────────
  {
    id: "not-from-nand",
    title: "NOT from NAND",
    concept:
      "What happens when you connect both inputs of a NAND gate to the same signal? NAND(1,1) = 0 and NAND(0,0) = 1. That's an inverter — a NOT gate, built from a single NAND. This is your first taste of building complex things from simple parts.",
    objective:
      "Build a NOT gate: connect the switch to BOTH inputs of the NAND gate. When the switch is ON, the LED should be OFF, and vice versa.",
    hints: [
      "The trick is connecting A.out to both gate.a AND gate.b.",
      "When A=0: NAND(0,0) = 1. When A=1: NAND(1,1) = 0. That's NOT!",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit NotFromNand {
  impl {
    node A: Switch
    node gate: Nand
    node light: Led

    // Connect A to BOTH inputs of the NAND gate:
    // connect A.out -> gate.a
    // connect A.out -> gate.b
    // connect gate.out -> light.in
  }
}`,
    solution: `circuit NotFromNand {
  impl {
    node A: Switch
    node gate: Nand
    node light: Led

    connect A.out -> gate.a
    connect A.out -> gate.b
    connect gate.out -> light.in
  }
}`,
    checks: [
      { description: "NOT(0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0]] },
      { description: "NOT(1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 50 },
      gate: { x: 250, y: 50 },
      light: { x: 470, y: 50 },
    },
    height: 180,
  },

  // ── Level 3: AND from NAND ──────────────────────────────────────────
  {
    id: "and-from-nand",
    title: "AND from NAND",
    concept:
      "NAND is Not-AND. So if you negate a NAND, you get... AND. Two NAND gates: the first does NAND(A,B), the second inverts the result (using the NOT trick from level 2). You've just built AND from scratch.",
    objective:
      "Build an AND gate using exactly two NAND gates. The LED should light only when BOTH switches are ON.",
    hints: [
      "First NAND gate: connect A and B as normal inputs.",
      "Second NAND gate: connect the first gate's output to BOTH inputs (the NOT trick).",
      "The second gate's output is AND(A,B). Connect it to the LED.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit AndFromNand {
  impl {
    node A: Switch
    node B: Switch
    node nand1: Nand
    node nand2: Nand
    node light: Led

    // Step 1: NAND(A, B)
    // connect A.out -> nand1.a
    // connect B.out -> nand1.b

    // Step 2: NOT the result (NAND with both inputs tied)
    // connect nand1.out -> nand2.a
    // connect nand1.out -> nand2.b

    // connect nand2.out -> light.in
  }
}`,
    solution: `circuit AndFromNand {
  impl {
    node A: Switch
    node B: Switch
    node nand1: Nand
    node nand2: Nand
    node light: Led

    connect A.out -> nand1.a
    connect B.out -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> light.in
  }
}`,
    checks: [
      { description: "AND(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
      { description: "AND(0,1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 1]] },
      { description: "AND(1,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1], ["B", 0]] },
      { description: "AND(1,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 130 },
      nand1: { x: 220, y: 50 },
      nand2: { x: 420, y: 50 },
      light: { x: 600, y: 50 },
    },
    height: 220,
  },

  // ── Level 4: OR from NAND ───────────────────────────────────────────
  {
    id: "or-from-nand",
    title: "OR from NAND",
    concept:
      "De Morgan's law says NOT(A) NAND NOT(B) = A OR B. In gates: invert each input (NAND with both pins tied), then NAND the results together. Three NAND gates total. You now have OR — built from the same gate as everything else.",
    objective:
      "Build an OR gate using exactly three NAND gates. The LED should light when EITHER switch (or both) is ON.",
    hints: [
      "First: invert A using a NAND gate (both inputs = A).",
      "Second: invert B using a NAND gate (both inputs = B).",
      "Third: NAND the two inverted signals together. NAND(NOT A, NOT B) = A OR B.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit OrFromNand {
  impl {
    node A: Switch
    node B: Switch
    node notA: Nand
    node notB: Nand
    node combine: Nand
    node light: Led

    // Invert A: connect A.out to both inputs of notA
    // Invert B: connect B.out to both inputs of notB
    // NAND the inverted signals:
    // connect notA.out -> combine.a
    // connect notB.out -> combine.b
    // connect combine.out -> light.in
  }
}`,
    solution: `circuit OrFromNand {
  impl {
    node A: Switch
    node B: Switch
    node notA: Nand
    node notB: Nand
    node combine: Nand
    node light: Led

    connect A.out -> notA.a
    connect A.out -> notA.b
    connect B.out -> notB.a
    connect B.out -> notB.b
    connect notA.out -> combine.a
    connect notB.out -> combine.b
    connect combine.out -> light.in
  }
}`,
    checks: [
      { description: "OR(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
      { description: "OR(0,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0], ["B", 1]] },
      { description: "OR(1,0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 0]] },
      { description: "OR(1,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 160 },
      notA: { x: 200, y: 0 },
      notB: { x: 200, y: 160 },
      combine: { x: 400, y: 70 },
      light: { x: 590, y: 70 },
    },
    height: 260,
  },

  // ── Level 5: XOR from NAND ──────────────────────────────────────────
  {
    id: "xor-from-nand",
    title: "XOR from NAND",
    concept:
      "XOR outputs 1 when the inputs are different. It takes four NAND gates — the most complex circuit so far. The trick: NAND(A,B) gives you a signal that's 0 only when both are 1. Feed that back into two more NANDs with the original inputs, then NAND those results together. This is the gate that makes addition possible.",
    objective:
      "Build XOR using exactly four NAND gates. The LED should light when exactly one switch is ON.",
    hints: [
      "Gate 1: NAND(A, B) — call this 'mid'.",
      "Gate 2: NAND(A, mid). Gate 3: NAND(mid, B).",
      "Gate 4: NAND(gate2.out, gate3.out). That's your XOR output.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit XorFromNand {
  impl {
    node A: Switch
    node B: Switch
    node mid: Nand
    node left: Nand
    node right: Nand
    node final: Nand
    node light: Led

    // Gate 1: NAND(A, B)
    // connect A.out -> mid.a
    // connect B.out -> mid.b

    // Gate 2: NAND(A, mid)
    // Gate 3: NAND(mid, B)
    // Gate 4: NAND(left, right) → output
  }
}`,
    solution: `circuit XorFromNand {
  impl {
    node A: Switch
    node B: Switch
    node mid: Nand
    node left: Nand
    node right: Nand
    node final: Nand
    node light: Led

    connect A.out -> mid.a
    connect B.out -> mid.b
    connect A.out -> left.a
    connect mid.out -> left.b
    connect mid.out -> right.a
    connect B.out -> right.b
    connect left.out -> final.a
    connect right.out -> final.b
    connect final.out -> light.in
  }
}`,
    checks: [
      { description: "XOR(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
      { description: "XOR(0,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0], ["B", 1]] },
      { description: "XOR(1,0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 0]] },
      { description: "XOR(1,1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1], ["B", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 200 },
      mid: { x: 190, y: 90 },
      left: { x: 370, y: 10 },
      right: { x: 370, y: 170 },
      final: { x: 550, y: 90 },
      light: { x: 720, y: 90 },
    },
    height: 280,
  },

  // ── Level 6: Half Adder from NAND ───────────────────────────────────
  {
    id: "half-adder-nand",
    title: "Half Adder from NAND",
    concept:
      "A half adder adds two 1-bit numbers. The sum is XOR(A,B) and the carry is AND(A,B). You already know how to build both from NAND gates. Now combine them into one circuit. This is the building block of every adder, every ALU, every CPU.",
    objective:
      "Build a half adder using only NAND gates. Sum LED = XOR(A,B), Carry LED = AND(A,B). You'll need five NAND gates total.",
    hints: [
      "The XOR part needs four NANDs (same as level 5).",
      "The AND part needs the first NAND (already built for XOR) plus one more to invert it.",
      "The mid NAND gate is shared between XOR and AND — it does double duty.",
      "Try A=1, B=1: sum should be OFF (0), carry should be ON (1). That's binary: 1+1 = 10.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit HalfAdderNand {
  impl {
    node A: Switch
    node B: Switch

    // XOR for sum (4 NANDs):
    node mid: Nand
    node left: Nand
    node right: Nand
    node xorOut: Nand

    // AND for carry (reuse mid + 1 NAND):
    node andOut: Nand

    node sumLed: Led
    node carryLed: Led

    // Build it! XOR is the same as level 5.
    // AND = NOT(NAND(A,B)) = NOT(mid) — tie mid.out to both inputs of andOut.
  }
}`,
    solution: `circuit HalfAdderNand {
  impl {
    node A: Switch
    node B: Switch

    node mid: Nand
    node left: Nand
    node right: Nand
    node xorOut: Nand
    node andOut: Nand

    node sumLed: Led
    node carryLed: Led

    connect A.out -> mid.a
    connect B.out -> mid.b
    connect A.out -> left.a
    connect mid.out -> left.b
    connect mid.out -> right.a
    connect B.out -> right.b
    connect left.out -> xorOut.a
    connect right.out -> xorOut.b
    connect xorOut.out -> sumLed.in
    connect mid.out -> andOut.a
    connect mid.out -> andOut.b
    connect andOut.out -> carryLed.in
  }
}`,
    checks: [
      { description: "0+0: sum=0, carry=0", node: "sumLed", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
      { description: "0+0: carry=0", node: "carryLed", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
      { description: "0+1: sum=1", node: "sumLed", port: "in", expected: 1, inputs: [["A", 0], ["B", 1]] },
      { description: "0+1: carry=0", node: "carryLed", port: "in", expected: 0, inputs: [["A", 0], ["B", 1]] },
      { description: "1+0: sum=1", node: "sumLed", port: "in", expected: 1, inputs: [["A", 1], ["B", 0]] },
      { description: "1+0: carry=0", node: "carryLed", port: "in", expected: 0, inputs: [["A", 1], ["B", 0]] },
      { description: "1+1: sum=0", node: "sumLed", port: "in", expected: 0, inputs: [["A", 1], ["B", 1]] },
      { description: "1+1: carry=1", node: "carryLed", port: "in", expected: 1, inputs: [["A", 1], ["B", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 20 },
      B: { x: 0, y: 210 },
      mid: { x: 180, y: 100 },
      left: { x: 350, y: 20 },
      right: { x: 350, y: 180 },
      xorOut: { x: 530, y: 90 },
      andOut: { x: 530, y: 240 },
      sumLed: { x: 710, y: 90 },
      carryLed: { x: 710, y: 240 },
    },
    height: 330,
  },

  // ── Level 7: The Multiplexer ────────────────────────────────────────
  {
    id: "mux-from-nand",
    title: "The Multiplexer",
    concept:
      "A multiplexer (MUX) selects between two inputs based on a selector signal. When sel=0, output=A. When sel=1, output=B. It's the hardware equivalent of an if-else statement. In a CPU, multiplexers route data everywhere — selecting registers, choosing ALU inputs, picking branch targets. Build one and you'll see it everywhere.",
    objective:
      "Build a 2-to-1 MUX using only NAND gates. When sel is OFF, the LED follows A. When sel is ON, the LED follows B. You'll need four NAND gates.",
    hints: [
      "Invert sel using a NAND (both inputs tied to sel).",
      "NAND(A, NOT sel) — this 'passes' A when sel=0.",
      "NAND(B, sel) — this 'passes' B when sel=1.",
      "NAND the two results together. That's your MUX output.",
    ],
    allowedPrimitives: ["Switch", "Nand", "Led"],
    scaffold: `circuit MuxFromNand {
  impl {
    node A: Switch
    node B: Switch
    node sel: Switch

    node notSel: Nand
    node passA: Nand
    node passB: Nand
    node combine: Nand
    node light: Led

    // Invert sel:
    // connect sel.out -> notSel.a
    // connect sel.out -> notSel.b

    // Pass A when sel=0, pass B when sel=1:
    // NAND(A, notSel) and NAND(B, sel)

    // Combine: NAND(passA, passB) → output
  }
}`,
    solution: `circuit MuxFromNand {
  impl {
    node A: Switch
    node B: Switch
    node sel: Switch

    node notSel: Nand
    node passA: Nand
    node passB: Nand
    node combine: Nand
    node light: Led

    connect sel.out -> notSel.a
    connect sel.out -> notSel.b
    connect A.out -> passA.a
    connect notSel.out -> passA.b
    connect B.out -> passB.a
    connect sel.out -> passB.b
    connect passA.out -> combine.a
    connect passB.out -> combine.b
    connect combine.out -> light.in
  }
}`,
    checks: [
      { description: "sel=0, A=0, B=0 → 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0], ["sel", 0]] },
      { description: "sel=0, A=1, B=0 → 1 (selects A)", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 0], ["sel", 0]] },
      { description: "sel=0, A=0, B=1 → 0 (ignores B)", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 1], ["sel", 0]] },
      { description: "sel=1, A=0, B=1 → 1 (selects B)", node: "light", port: "in", expected: 1, inputs: [["A", 0], ["B", 1], ["sel", 1]] },
      { description: "sel=1, A=1, B=0 → 0 (ignores A)", node: "light", port: "in", expected: 0, inputs: [["A", 1], ["B", 0], ["sel", 1]] },
      { description: "sel=1, A=1, B=1 → 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 1], ["sel", 1]] },
    ],
    nodePositions: {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 140 },
      sel: { x: 0, y: 280 },
      notSel: { x: 200, y: 250 },
      passA: { x: 380, y: 30 },
      passB: { x: 380, y: 170 },
      combine: { x: 560, y: 90 },
      light: { x: 730, y: 90 },
    },
    height: 350,
  },
];

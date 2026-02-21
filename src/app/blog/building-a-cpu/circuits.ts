/**
 * Circuit definitions for the "Building a CPU" blog post.
 *
 * Reuses basic gates from splash3 and adds sequential circuits
 * (SR Latch, D Flip-Flop, Register, Counter) for the memory sections.
 */

// Re-export gate circuits from splash3
export { CIRCUITS as GATE_CIRCUITS } from "@/app/splash3/circuits";

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  srLatch: {
    name: "SR Latch",
    description:
      "The simplest memory element. Set (S) stores a 1, Reset (R) clears to 0.",
    displayDsl: `circuit SRLatch {
  input s: Bit
  input r: Bit
  output q: Bit
  output q_bar: Bit
  impl {
    node nor1: Nor
    node nor2: Nor
    connect s -> nor1.a
    connect nor2.out -> nor1.b
    connect r -> nor2.a
    connect nor1.out -> nor2.b
    connect nor1.out -> q
    connect nor2.out -> q_bar
  }
}`,
    dsl: `
circuit SRLatch {
  input s: Bit
  input r: Bit
  output q: Bit
  output q_bar: Bit
  impl {
    node nor1: Nor
    node nor2: Nor
    connect s -> nor1.a
    connect nor2.out -> nor1.b
    connect r -> nor2.a
    connect nor1.out -> nor2.b
    connect nor1.out -> q
    connect nor2.out -> q_bar
  }
}

circuit DemoSRLatch {
  impl {
    node sw_s: Switch
    node sw_r: Switch
    node latch: SRLatch
    node led_q: Led
    node led_qbar: Led
    connect sw_s.out -> latch.s
    connect sw_r.out -> latch.r
    connect latch.q -> led_q.in
    connect latch.q_bar -> led_qbar.in
  }
}`,
  },

  dFlipFlop: {
    name: "D Flip-Flop",
    description:
      "Captures the input value on each clock edge. The building block of registers.",
    displayDsl: `circuit DemoFlipFlop {
  clock clk
  impl {
    node sw_d: Switch
    node dff: DFlipFlop
    node led_q: Led
    connect clk -> dff.clk
    connect sw_d.out -> dff.d
    connect dff.q -> led_q.in
  }
}`,
    dsl: `
circuit DemoFlipFlop {
  clock clk
  impl {
    node sw_d: Switch
    node dff: DFlipFlop
    node led_q: Led
    connect clk -> dff.clk
    connect sw_d.out -> dff.d
    connect dff.q -> led_q.in
  }
}`,
  },

  register4bit: {
    name: "4-Bit Register",
    description:
      "Four flip-flops in parallel store a nibble (4 bits) of data.",
    displayDsl: `circuit Reg4 {
  input d0: Bit
  input d1: Bit
  input d2: Bit
  input d3: Bit
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    connect d0 -> ff0.d
    connect d1 -> ff1.d
    connect d2 -> ff2.d
    connect d3 -> ff3.d
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}`,
    dsl: `
circuit Reg4 {
  input d0: Bit
  input d1: Bit
  input d2: Bit
  input d3: Bit
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    connect d0 -> ff0.d
    connect d1 -> ff1.d
    connect d2 -> ff2.d
    connect d3 -> ff3.d
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}

circuit DemoReg4 {
  clock clk
  impl {
    node sw_d0: Switch
    node sw_d1: Switch
    node sw_d2: Switch
    node sw_d3: Switch
    node reg: Reg4
    node led_q0: Led
    node led_q1: Led
    node led_q2: Led
    node led_q3: Led
    connect clk -> reg.clk
    connect sw_d0.out -> reg.d0
    connect sw_d1.out -> reg.d1
    connect sw_d2.out -> reg.d2
    connect sw_d3.out -> reg.d3
    connect reg.q0 -> led_q0.in
    connect reg.q1 -> led_q1.in
    connect reg.q2 -> led_q2.in
    connect reg.q3 -> led_q3.in
  }
}`,
  },

  counter4bit: {
    name: "4-Bit Counter",
    description:
      "Counts from 0 to 15 using toggle flip-flops chained by their carry outputs.",
    displayDsl: `circuit Counter4 {
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    // Toggle flip-flops: each one's
    // output feeds the next one's clock
    node t0: DFlipFlop
    node t1: DFlipFlop
    node t2: DFlipFlop
    node t3: DFlipFlop
    node inv0: Not
    node inv1: Not
    node inv2: Not
    node inv3: Not
    // Each DFF toggles by feeding
    // its inverted output back to D
    connect t0.q -> inv0.in
    connect inv0.out -> t0.d
    connect t1.q -> inv1.in
    connect inv1.out -> t1.d
    connect t2.q -> inv2.in
    connect inv2.out -> t2.d
    connect t3.q -> inv3.in
    connect inv3.out -> t3.d
    // Chain: clk -> t0, t0.q -> t1.clk ...
    connect clk -> t0.clk
    connect t0.q -> t1.clk
    connect t1.q -> t2.clk
    connect t2.q -> t3.clk
    connect t0.q -> q0
    connect t1.q -> q1
    connect t2.q -> q2
    connect t3.q -> q3
  }
}`,
    dsl: `
circuit Counter4 {
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node t0: DFlipFlop
    node t1: DFlipFlop
    node t2: DFlipFlop
    node t3: DFlipFlop
    node inv0: Not
    node inv1: Not
    node inv2: Not
    node inv3: Not
    connect t0.q -> inv0.in
    connect inv0.out -> t0.d
    connect t1.q -> inv1.in
    connect inv1.out -> t1.d
    connect t2.q -> inv2.in
    connect inv2.out -> t2.d
    connect t3.q -> inv3.in
    connect inv3.out -> t3.d
    connect clk -> t0.clk
    connect t0.q -> t1.clk
    connect t1.q -> t2.clk
    connect t2.q -> t3.clk
    connect t0.q -> q0
    connect t1.q -> q1
    connect t2.q -> q2
    connect t3.q -> q3
  }
}

circuit DemoCounter4 {
  clock clk
  impl {
    node ctr: Counter4
    node led_q0: Led
    node led_q1: Led
    node led_q2: Led
    node led_q3: Led
    connect clk -> ctr.clk
    connect ctr.q0 -> led_q0.in
    connect ctr.q1 -> led_q1.in
    connect ctr.q2 -> led_q2.in
    connect ctr.q3 -> led_q3.in
  }
}`,
  },
};

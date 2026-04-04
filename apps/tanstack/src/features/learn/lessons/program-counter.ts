import type { Lesson } from "../types";

const BASE_POSITIONS = {
  pc: { x: 200, y: 150 },
  adder: { x: 500, y: 100 },
  four: { x: 500, y: 300 },
  we: { x: 200, y: 350 },
};

export const PROGRAM_COUNTER_LESSON: Lesson = {
  slug: "program-counter",
  title: "The Program Counter",
  description:
    "How a CPU knows which instruction to execute next — built from a register, an adder, and a constant.",
  sections: [
    {
      id: "intro",
      heading: "What is a Program Counter?",
      body: [
        "Every CPU has a special register called the Program Counter — or PC for short. It holds one thing: the memory address of the next instruction to execute.",
        "When the CPU starts, the PC is zero. After executing an instruction, the PC advances to point at the next one. That's it. But getting that increment right is the foundation of everything a CPU does.",
        "Here it is: a single 32-bit register, sitting alone. Right now it just holds a value — it doesn't do anything yet.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .connect(({ in: inp, out, pc }) => [
    pc.q.to(out.pc_out),
  ])
  .build()
`,
      focus: "pc",
      nodePositions: { pc: BASE_POSITIONS.pc },
    },
    {
      id: "counting-by-4",
      heading: "Counting by 4",
      body: [
        "In RISC-V, every instruction is exactly 4 bytes wide. That means after executing an instruction at address N, the next instruction is at address N + 4.",
        "So we need a circuit that adds 4 to whatever the PC currently holds. An Adder takes two inputs and produces their sum. We'll use a 32-bit adder with a constant value of 4.",
        "Three nodes, not yet connected. The adder is waiting for its inputs. The constant 4 is ready to provide one of them.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .connect(({ in: inp, out, pc, adder, four }) => [
    pc.q.to(out.pc_out),
  ])
  .build()
`,
      focus: "adder",
      nodePositions: {
        pc: BASE_POSITIONS.pc,
        adder: BASE_POSITIONS.adder,
        four: BASE_POSITIONS.four,
      },
    },
    {
      id: "feeding-the-adder",
      heading: "Feeding the Adder",
      body: [
        "Now we connect the pieces. The register's output — pc.q — feeds into the adder's first input. The constant 4 feeds into the adder's second input.",
        "On every cycle, the adder computes pc.q + 4. The result sits at adder.sum, ready to be used. But nothing has changed yet — the sum isn't going anywhere.",
        "Notice the wire from pc.q splitting: one branch goes to the adder, the other to pc_out. This is how hardware multiplexes a signal to multiple consumers — no copying, just wiring.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .connect(({ in: inp, out, pc, adder, four }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
  ])
  .build()
`,
      focus: ["pc", "adder"],
      nodePositions: {
        pc: BASE_POSITIONS.pc,
        adder: BASE_POSITIONS.adder,
        four: BASE_POSITIONS.four,
      },
    },
    {
      id: "closing-the-loop",
      heading: "Closing the Loop",
      body: [
        "Here's the key insight: we feed the adder's sum back into the register's data input. adder.sum → pc.data.",
        "Now the circuit has a feedback loop. Each clock tick, the register captures the value on its data input — which is pc.q + 4. The register's output jumps to the new value, which immediately flows through the adder again, adding 4 again, ready for the next tick.",
        "This is what makes it a counter. The output of the computation feeds back as the next input. The register is the memory that lets the circuit 'remember' where it is between clock edges.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .connect(({ in: inp, out, pc, adder, four }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
  ])
  .build()
`,
      focus: "pc",
      nodePositions: {
        pc: BASE_POSITIONS.pc,
        adder: BASE_POSITIONS.adder,
        four: BASE_POSITIONS.four,
      },
    },
    {
      id: "write-enable",
      heading: "Write Enable",
      body: [
        "Registers have a write-enable input: pc.we. When it's high (1), the register captures its data input on the next clock edge. When it's low (0), the register holds its current value.",
        "We want the PC to advance every single cycle, so we tie write-enable permanently high with a 1-bit constant. This is a common pattern — drive a control signal to a fixed value when you don't need dynamic control.",
        "The circuit is now fully connected. All inputs are driven, all outputs are used. This is a complete, synthesizable program counter.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('we', Constant, { value: 1, width: 1 })
  .connect(({ in: inp, out, pc, adder, four, we }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    we.out.to(pc.we),
  ])
  .build()
`,
      nodePositions: BASE_POSITIONS,
    },
    {
      id: "watch-it-count",
      heading: "Watch it Count",
      body: [
        "Hit the Tick button. The PC jumps from 0 to 4. Tick again: 8. Then 12, 16, 20... Each clock edge, the register captures its data input, which is always four more than what it just output.",
        "This is the heartbeat of a CPU. Every instruction fetch begins with 'what does the PC say?' The fetch unit reads memory at that address, the PC advances, and the cycle repeats billions of times per second in a modern processor.",
        "From here, a real CPU would add logic to override the PC on branch instructions — jumping to a different address rather than just adding 4. But the foundation is what you see here: a register in a feedback loop with an adder.",
      ],
      dsl: `
const ProgramCounter = component('ProgramCounter')
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('we', Constant, { value: 1, width: 1 })
  .connect(({ in: inp, out, pc, adder, four, we }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    we.out.to(pc.we),
  ])
  .build()
`,
      ticks: 8,
      nodePositions: BASE_POSITIONS,
    },
  ],
};

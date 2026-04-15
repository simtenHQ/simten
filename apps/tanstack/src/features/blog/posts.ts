export type PostCategory = 'game' | 'cpu' | 'accelerator' | 'networking' | 'architecture' | 'interactive'

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: PostCategory;
  nodes: string;
}

export const posts: BlogPost[] = [
  {
    slug: "pong-in-hardware",
    title: "Pong in Hardware",
    description:
      "A complete Pong game built from logic gates, registers, and memory — two paddles, a bouncing ball, and a 14-phase rendering pipeline, all without a CPU.",
    category: 'game',
    nodes: '~80 nodes',
  },
  {
    slug: "snake-in-hardware",
    title: "Snake in Hardware",
    description:
      "A complete Snake game built entirely from logic gates, registers, and memory — no CPU, no software, just digital circuits.",
    category: 'game',
    nodes: '~100 nodes',
  },
  {
    slug: "building-a-cpu",
    title: "Building a CPU from Scratch",
    description:
      "From NAND gates to a working processor — fetch, decode, execute, all built from logic gates you can click.",
    category: 'cpu',
    nodes: '~300 nodes',
  },
  {
    slug: "how-tpus-work",
    title: "How TPUs Do Calculations",
    description:
      "Inside Google's Tensor Processing Units: a 2x2 systolic array built from logic gates. Watch matrix multiplication happen one clock cycle at a time.",
    category: 'accelerator',
    nodes: '~60 nodes',
  },
  {
    slug: "computing-trig-in-hardware",
    title: "Computing Trig in Hardware",
    description:
      "How calculators and GPUs compute sine and cosine using only bit shifts and addition — the CORDIC algorithm, built from logic gates.",
    category: 'accelerator',
    nodes: '~40 nodes',
  },
  {
    slug: "sorting-networks",
    title: "Sorting Networks",
    description:
      "A fixed wiring of comparators that sorts any input in the same number of steps — no branches, no loops. The algorithm behind network switch fabrics, GPU sort, and median filters.",
    category: 'accelerator',
    nodes: '~25 nodes',
  },
  {
    slug: "how-network-switches-work",
    title: "How Network Switches Work",
    description:
      "Packet buffering, MAC address lookup, and forwarding — built from the same primitives as everything else.",
    category: 'networking',
    nodes: '~50 nodes',
  },
  {
    slug: "breakout-in-hardware",
    title: "Breakout in Hardware",
    description:
      "A classic brick-breaking game built entirely from logic gates — ball physics, paddle control, brick collision detection, and score tracking, all without a CPU.",
    category: 'game',
    nodes: '~90 nodes',
  },
  {
    slug: "aes-in-hardware",
    title: "AES in Hardware",
    description:
      "Why Intel built AES into the CPU. SubBytes, XTime, and MixColumns — the operations behind the world's most deployed cipher, verified against FIPS 197.",
    category: 'accelerator',
    nodes: '~60 nodes',
  },
  {
    slug: "chacha20-in-hardware",
    title: "ChaCha20 in Hardware",
    description:
      "The TLS cipher that encrypts most of the internet, built from logic gates. Explore the ADD-XOR-ROTATE quarter-round with live interactive circuits.",
    category: 'networking',
    nodes: '~50 nodes',
  },
  {
    slug: "rv32i-cpu",
    title: "A RISC-V CPU That Runs C",
    description:
      "A 5-stage pipelined RISC-V processor with data forwarding and hazard detection — write C, compile it, and step through execution cycle by cycle.",
    category: 'cpu',
    nodes: '~200 nodes',
  },
  {
    slug: "mcp-bidirectional-bridge",
    title: "MCP Bidirectional Bridge",
    description:
      "How the MCP WebSocket bridge connects AI models to live circuit simulations — bidirectional tool calls, state synchronization, and real-time collaboration.",
    category: 'architecture',
    nodes: 'N/A',
  },
];

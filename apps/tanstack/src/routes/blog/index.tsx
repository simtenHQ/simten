import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/blog/')({
  head: () => ({
    meta: [{ title: 'Blog | Turing Incomplete' }],
  }),
  component: BlogIndex,
})

type PostCategory = 'game' | 'cpu' | 'accelerator' | 'networking' | 'architecture'

const CATEGORY_COLORS: Record<PostCategory, string> = {
  game: 'bg-green-900/50 text-green-400 border-green-800/50',
  cpu: 'bg-blue-900/50 text-blue-400 border-blue-800/50',
  accelerator: 'bg-violet-900/50 text-violet-400 border-violet-800/50',
  networking: 'bg-amber-900/50 text-amber-400 border-amber-800/50',
  architecture: 'bg-cyan-900/50 text-cyan-400 border-cyan-800/50',
}

const CATEGORY_LABELS: Record<PostCategory, string> = {
  game: 'Game',
  cpu: 'CPU',
  accelerator: 'Accelerator',
  networking: 'Networking',
  architecture: 'Architecture',
}

const posts: { slug: string; title: string; description: string; category: PostCategory; nodes: string }[] = [
  {
    slug: "pong-in-hardware",
    title: "Pong in Hardware",
    description:
      "A complete Pong game built from logic gates, registers, and memory — two paddles, a bouncing ball, and a 6-phase rendering pipeline, all without a CPU.",
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
    slug: "mcp-bidirectional-bridge",
    title: "MCP Bidirectional Bridge",
    description:
      "How the MCP WebSocket bridge connects AI models to live circuit simulations — bidirectional tool calls, state synchronization, and real-time collaboration.",
    category: 'architecture',
    nodes: 'N/A',
  },
]

function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#010409] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="text-gray-600 hover:text-gray-300 transition-colors text-sm"
        >
          &larr; Home
        </Link>
        <h1 className="text-3xl font-bold mt-6 mb-2">Blog</h1>
        <p className="text-gray-500 text-sm mb-12">
          Interactive articles about how hardware works. Every circuit is live.
        </p>
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}` as string}
              className="block group rounded-lg border border-[#21262d] hover:border-[#30363d] bg-[#0d1117] hover:bg-[#161b22] transition-all px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-200 group-hover:text-white transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[post.category]}`}>
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <span className="text-[11px] text-gray-600 font-mono">{post.nodes}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

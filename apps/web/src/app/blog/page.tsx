import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog | Turing Incomplete",
  description:
    "Interactive articles about how hardware really works — every circuit is live and explorable.",
};

const posts = [
  {
    slug: "pong-in-hardware",
    title: "Pong in Hardware",
    description:
      "A complete Pong game built from logic gates, registers, and memory — two paddles, a bouncing ball, and a 6-phase rendering pipeline, all without a CPU.",
  },
  {
    slug: "snake-in-hardware",
    title: "Snake in Hardware",
    description:
      "A complete Snake game built entirely from logic gates, registers, and memory — no CPU, no software, just digital circuits.",
  },
  {
    slug: "building-a-cpu",
    title: "Building a CPU from Scratch",
    description:
      "From NAND gates to a working processor — fetch, decode, execute, all built from logic gates you can click.",
  },
  {
    slug: "how-tpus-work",
    title: "How TPUs Do Calculations",
    description:
      "Inside Google's Tensor Processing Units: a 2x2 systolic array built from logic gates. Watch matrix multiplication happen one clock cycle at a time.",
  },
  {
    slug: "computing-trig-in-hardware",
    title: "Computing Trig in Hardware",
    description:
      "How calculators and GPUs compute sine and cosine using only bit shifts and addition — the CORDIC algorithm, built from logic gates.",
  },
  {
    slug: "how-network-switches-work",
    title: "How Network Switches Work",
    description:
      "Packet buffering, MAC address lookup, and forwarding — built from the same primitives as everything else.",
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#010409] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/splash5"
          className="text-gray-600 hover:text-gray-300 transition-colors text-sm"
        >
          &larr; Home
        </Link>
        <h1 className="text-2xl font-semibold mt-6 mb-2">Blog</h1>
        <p className="text-gray-500 text-sm mb-10">
          Interactive articles about how hardware works. Every circuit is live.
        </p>
        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group"
            >
              <h2 className="text-lg font-medium text-gray-200 group-hover:text-white transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

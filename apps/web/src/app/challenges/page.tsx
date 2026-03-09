import type { Metadata } from "next";
import Link from "next/link";
import { ALL_CHALLENGES } from "@turing-incomplete/challenges";

export const metadata: Metadata = {
  title: "Challenges | Turing Incomplete",
  description:
    "Build real hardware projects from scratch — no CPU, no software, just logic gates and registers.",
};

export default function ChallengesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <section className="py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Challenges
          </h1>
          <p className="mt-6 text-xl text-gray-400 leading-relaxed max-w-2xl">
            Learn digital logic by building real things. Each challenge walks
            you through a project stage by stage — you write the connections, the
            simulator checks your work.
          </p>
        </section>

        <div className="space-y-4">
          {ALL_CHALLENGES.map((c) => (
            <Link
              key={c.slug}
              href={`/challenges/${c.slug}`}
              className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                    {c.title}
                  </h2>
                  <p className="mt-2 text-gray-400 leading-relaxed">
                    {c.description}
                  </p>
                </div>
                <span className="text-gray-600 group-hover:text-blue-400 transition-colors text-2xl ml-4">
                  →
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span>{c.stages} stages</span>
                <span>{c.difficulty}</span>
                {"tag" in c && c.tag && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs font-medium">
                    {c.tag}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Turing Incomplete
          </Link>
        </footer>
      </main>
    </div>
  );
}

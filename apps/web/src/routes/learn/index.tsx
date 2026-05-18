import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/learn/")({
  head: () =>
    pageHead({
      title: "Learn",
      description:
        "Guided lessons on how hardware works — from logic gates to a full RISC-V CPU. Every circuit is live: tick it, poke it, break it.",
      path: "/learn",
    }),
  component: LearnIndexPage,
});

function LearnIndexPage() {
  return (
    <div className="bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <section className="py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Learn
          </h1>
          <p className="mt-6 text-xl text-gray-400 leading-relaxed max-w-2xl">
            Guided lessons that explain how hardware works, one scrollable step
            at a time. Every circuit is live — tick it, poke it, break it.
          </p>
        </section>

        <div className="space-y-4">
          <p className="text-gray-500">
            Foundational lessons coming soon &mdash; adders, registers, FSMs.
          </p>
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Simten
          </Link>
        </footer>
      </main>
    </div>
  );
}

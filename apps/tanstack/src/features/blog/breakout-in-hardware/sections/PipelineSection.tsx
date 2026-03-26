"use client";

export function PipelineSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The 10-Phase Rendering Pipeline
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The DualPortRAM has one write port. But each frame needs to clear 4
          old pixels (ball + 3 paddle) and draw 4 new pixels (ball + 3 paddle),
          plus optionally clear a hit brick. That&rsquo;s up to 9 writes per
          frame &mdash; so the frame is split into 10 phases, each doing one
          RAM operation:
        </p>
        <div className="my-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { phase: 0, label: "Read", desc: "Check brick at next ball position" },
            { phase: 1, label: "Clear", desc: "Old ball pixel" },
            { phase: 2, label: "Clear", desc: "Old paddle left" },
            { phase: 3, label: "Clear", desc: "Old paddle center" },
            { phase: 4, label: "Clear", desc: "Old paddle right / brick" },
            { phase: 5, label: "Draw", desc: "New ball pixel" },
            { phase: 6, label: "Draw", desc: "New paddle left" },
            { phase: 7, label: "Draw", desc: "New paddle center" },
            { phase: 8, label: "Draw", desc: "New paddle right" },
            { phase: 9, label: "Update", desc: "Commit new positions" },
          ].map(({ phase, label, desc }) => (
            <div
              key={phase}
              className={`rounded-lg border p-2 text-center ${
                label === "Clear"
                  ? "border-red-800/50 bg-red-950/20"
                  : label === "Draw"
                  ? "border-green-800/50 bg-green-950/20"
                  : label === "Read"
                  ? "border-blue-800/50 bg-blue-950/20"
                  : "border-amber-800/50 bg-amber-950/20"
              }`}
            >
              <div className="text-[10px] font-mono text-gray-500">Phase {phase}</div>
              <div className={`text-xs font-semibold ${
                label === "Clear" ? "text-red-400" :
                label === "Draw" ? "text-green-400" :
                label === "Read" ? "text-blue-400" : "text-amber-400"
              }`}>{label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
        <p className="text-gray-300 leading-relaxed">
          A 4-bit phase counter cycles 0&ndash;9 and resets. Each phase drives
          a chain of muxes that select the RAM address and data. Clears write 0,
          draws write 1. The write-enable signal is only high during phases
          1&ndash;8 &mdash; phase 0 is read-only (brick check) and phase 9
          commits the new register values.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is exactly how a GPU schedules memory operations &mdash; a
          pipeline that breaks each frame into phases, each with a specific
          memory operation. The only difference is scale: a real GPU has
          millions of pixels and thousands of pipeline stages. This one has 64
          pixels and 10 stages. But the principle is identical.
        </p>
      </div>
    </section>
  );
}

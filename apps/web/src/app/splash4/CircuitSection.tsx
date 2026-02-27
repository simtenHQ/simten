"use client";

import { motion } from "framer-motion";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";
import type { SectionDef } from "./sections";

interface CircuitSectionProps {
  section: SectionDef;
  index: number;
  isLast: boolean;
}

export function CircuitSection({ section, index }: CircuitSectionProps) {
  const isLeft = section.align === "left";
  const sim = useCircuitSimulator(section.dsl);

  return (
    <section className="min-h-screen flex items-center relative px-6 py-20">
      <div className="max-w-6xl mx-auto w-full">
        <div
          className={`flex flex-col ${
            isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
          } items-center gap-12 lg:gap-16`}
        >
          {/* Text content */}
          <motion.div
            className="flex-1 max-w-xl"
            initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="text-green-400 text-sm font-medium mb-2 tracking-wide uppercase">
              {section.subtitle}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {section.title}
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed">
              {section.description}
            </p>
          </motion.div>

          {/* Circuit */}
          <motion.div
            className="flex-1 w-full max-w-lg"
            initial={{ opacity: 0, x: isLeft ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-gray-900/80 backdrop-blur rounded-2xl border border-gray-800 p-4 shadow-2xl">
              {section.hint && (
                <div className="text-xs text-gray-500 mb-3 text-center">
                  {section.hint}
                </div>
              )}
              <div className="h-[280px] md:h-[320px]">
                {sim.error ? (
                  <div className="h-full flex items-center justify-center text-red-400 text-sm p-4 text-center">
                    {sim.error}
                  </div>
                ) : !sim.ready ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Loading...
                  </div>
                ) : (
                  <CircuitCanvas
                    circuit={sim.circuit}
                    portValues={sim.portValues}
                    sequentialState={sim.sequentialState}
                    onToggleNode={sim.toggleNode}
                    drillDown={false}
                  />
                )}
              </div>
              {/* Clock controls for sequential circuits */}
              {sim.ready && sim.isSequential && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
                  <button
                    onClick={sim.tick}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Tick
                  </button>
                  <button
                    onClick={sim.reset}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                  >
                    Reset
                  </button>
                  <span className="text-gray-500 text-xs ml-auto">
                    #{sim.cycleCount}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Section number indicator */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden xl:block">
        <div className="text-gray-800 text-8xl font-bold">
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}

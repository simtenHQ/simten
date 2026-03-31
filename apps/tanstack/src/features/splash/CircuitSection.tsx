import { useCircuitSimulator } from "@turing-incomplete/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";
import type { SectionDef } from "./sections";

interface CircuitSectionProps {
  section: SectionDef;
  index: number;
  isLast: boolean;
}

export function CircuitSection({ section }: CircuitSectionProps) {
  const isLeft = section.align === "left";
  const sim = useCircuitSimulator(section.dsl);

  return (
    <section className="px-6 py-16">
      <div className="max-w-6xl mx-auto w-full">
        <div
          className={`flex flex-col ${
            isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
          } items-center gap-10 lg:gap-16`}
        >
          {/* Text */}
          <div className="flex-1 max-w-xl">
            <div className="text-gray-500 text-xs font-medium mb-1.5 tracking-wide uppercase">
              {section.subtitle}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
              {section.title}
            </h2>
            <p className="text-base text-gray-400 leading-relaxed">
              {section.description}
            </p>
          </div>

          {/* Circuit */}
          <div className="flex-1 w-full max-w-lg">
            <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
              {section.hint && (
                <div className="text-xs text-gray-500 mb-3 text-center">
                  {section.hint}
                </div>
              )}
              <div className="h-[260px] md:h-[300px]">
                {sim.error ? (
                  <div className="h-full flex items-center justify-center text-red-400 text-sm p-4 text-center">
                    {sim.error}
                  </div>
                ) : !sim.ready ? (
                  <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                    Compiling...
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
                  <span className="text-gray-600 text-xs ml-auto font-mono tabular-nums">
                    #{sim.cycleCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

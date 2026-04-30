import { useCircuitSimulator } from "@simten/embed";
import { SortDemo } from "./circuits";

/**
 * Hook for the sorting networks demo circuit.
 * Purely combinational — no clock ticks needed.
 * Exposes `sim` and a helper to read the sorted output values.
 */
export function useSortingSimulator() {
  const sim = useCircuitSimulator(SortDemo);

  function getSortedValues(): number[] {
    const keys = ["s0", "s1", "s2", "s3"];
    return keys.map((k) => {
      const v = sim.portValues?.get(`sorter.${k}`);
      return typeof v === "number" ? v : 0;
    });
  }

  return { sim, getSortedValues };
}

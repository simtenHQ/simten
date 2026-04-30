
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { Breakout } from "./circuits";

// One full raster frame for 32x16 display (34x18 grid with blanking)
const TICKS_PER_FRAME = 612;

export function useBreakoutSimulator() {
  const sim = useCircuitSimulator(Breakout);
  const [isRunning, setIsRunning] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Find the mangled node ID for "keyboard"
  const keyboardNodeId = useMemo(() => {
    if (!sim.circuit?.nodes) return null;
    for (const node of sim.circuit.nodes) {
      if (node.label === "keyboard" || node.id === "keyboard") return node.id;
    }
    return null;
  }, [sim.circuit]);

  // Keyboard handling
  useEffect(() => {
    if (!keyboardNodeId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = {
        ArrowLeft: 75,
        ArrowRight: 77,
      };
      const code = keyMap[e.key];
      if (code !== undefined) {
        e.preventDefault();
        sim.setNodeValue(keyboardNodeId, code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        sim.setNodeValue(keyboardNodeId, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [keyboardNodeId, sim.setNodeValue]);

  // Run continuously like real hardware: advance one full raster frame
  // (TICKS_PER_FRAME ticks) per browser frame via `tickN` — one postMessage
  // round-trip, one React state update per rAF instead of TICKS_PER_FRAME.
  useEffect(() => {
    if (!isRunning || !sim.ready) return;

    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      await sim.tickN(TICKS_PER_FRAME);
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning, sim.ready, sim.tickN]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    sim.reset();
  }, [sim]);

  const sendDirection = useCallback(
    (code: number) => {
      if (keyboardNodeId) sim.setNodeValue(keyboardNodeId, code);
    },
    [keyboardNodeId, sim.setNodeValue],
  );

  return {
    sim,
    isRunning,
    setIsRunning,
    handleReset,
    sendDirection,
  };
}


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

  // Run continuously like real hardware: tick the engine directly (no React
  // state updates per tick), then update React once per browser frame.
  // This avoids 612 setState calls per frame — only 1 after the full raster scan.
  useEffect(() => {
    if (!isRunning || !sim.ready) return;

    const engine = sim.getSimulator();
    if (!engine) return;

    const loop = () => {
      // Tick most of the frame directly on the engine (no React overhead)
      for (let i = 0; i < TICKS_PER_FRAME - 1; i++) {
        engine.tick();
      }
      // Final tick via sim.tick() triggers a single React state update
      sim.tick();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning, sim.ready, sim.tick, sim.getSimulator]);

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

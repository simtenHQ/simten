"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { BREAKOUT_DSL } from "./circuits";

export function useBreakoutSimulator() {
  const sim = useCircuitSimulator(BREAKOUT_DSL);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(200);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Auto-run using requestAnimationFrame for smooth rendering
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    if (!isRunning || !sim.ready) return;

    const loop = (timestamp: number) => {
      const elapsed = timestamp - lastFrameRef.current;
      if (elapsed >= speed) {
        lastFrameRef.current = timestamp;
        // Tick a full raster frame (100 ticks) atomically
        for (let i = 0; i < 100; i++) {
          sim.tick();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning, sim.ready, speed, sim.tick]);

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
    speed,
    setSpeed,
    handleReset,
    sendDirection,
  };
}

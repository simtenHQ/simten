"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { BREAKOUT_DSL } from "./circuits";

export function useBreakoutSimulator() {
  const sim = useCircuitSimulator(BREAKOUT_DSL);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(30);
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

  // Auto-run interval
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => {
        // Tick a full frame (10 phases) atomically so React only sees
        // the completed frame, not intermediate clear/draw states
        for (let i = 0; i < 10; i++) {
          sim.tick();
        }
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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

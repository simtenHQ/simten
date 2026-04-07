import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@turing-incomplete/embed";
import { PongSimple } from "./circuits";

export function usePongSimulator() {
  const sim = useCircuitSimulator(PongSimple);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialized = useRef(false);

  // Find node IDs for keyboard inputs and switches
  const nodeIds = useMemo(() => {
    const map: Record<string, string> = {};
    if (!sim.circuit?.nodes) return map;
    const names = [
      "keyboard0",
      "keyboard1",
      "phaseEnable",
      "updateEnable",
      "writeEnable",
    ];
    for (const node of sim.circuit.nodes) {
      for (const name of names) {
        if (node.label === name || node.id === name) {
          map[name] = node.id;
        }
      }
    }
    return map;
  }, [sim.circuit]);

  // Auto-toggle switches when simulator is ready
  // Constants are now embedded via Input(value=...) and Register(initial=...)
  useEffect(() => {
    if (sim.ready && !hasInitialized.current) {
      hasInitialized.current = true;

      // Toggle switches ON
      if (nodeIds.phaseEnable) sim.toggleNode(nodeIds.phaseEnable);
      if (nodeIds.updateEnable) sim.toggleNode(nodeIds.updateEnable);
      if (nodeIds.writeEnable) sim.toggleNode(nodeIds.writeEnable);
    }
  }, [sim.ready, sim.toggleNode, nodeIds]);

  // Keyboard listener
  useEffect(() => {
    if (!sim.ready) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let code = 0;
      switch (e.key) {
        case "w":
        case "W":
          code = 17;
          break;
        case "s":
        case "S":
          code = 31;
          break;
        case "ArrowUp":
          code = 72;
          e.preventDefault();
          break;
        case "ArrowDown":
          code = 80;
          e.preventDefault();
          break;
        default:
          return;
      }
      if (nodeIds.keyboard0) sim.setNodeValue(nodeIds.keyboard0, code);
      if (nodeIds.keyboard1) sim.setNodeValue(nodeIds.keyboard1, code);
    };

    const handleKeyUp = () => {
      if (nodeIds.keyboard0) sim.setNodeValue(nodeIds.keyboard0, 0);
      if (nodeIds.keyboard1) sim.setNodeValue(nodeIds.keyboard1, 0);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [sim.ready, sim.setNodeValue, nodeIds]);

  // Auto-run interval — run a complete 14-phase game frame each time.
  // Speed controls how often frames run (higher = slower ball + paddles).
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => {
        for (let i = 0; i < 14; i++) sim.tick();
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
    hasInitialized.current = false;
    sim.reset();
  }, [sim]);

  return {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
  };
}

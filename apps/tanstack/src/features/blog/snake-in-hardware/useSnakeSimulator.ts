
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { SnakeAdvanced } from "./circuits";

export function useSnakeSimulator() {
  const sim = useCircuitSimulator(SnakeAdvanced);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find the actual mangled node ID for "keyboard" from the compiled circuit.
  // The IR generator mangles IDs: e.g. "keyboard" → "SnakeAdvanced_keyboard_<ts>_<rand>"
  // We look up by label to get the real ID that setNodeValue/setInput can find.
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
        ArrowUp: 72,
        ArrowDown: 80,
        ArrowLeft: 75,
        ArrowRight: 77,
      };
      const code = keyMap[e.key];
      if (code !== undefined) {
        e.preventDefault();
        sim.setNodeValue(keyboardNodeId, code);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardNodeId, sim.setNodeValue]);

  // Auto-run interval
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => {
        sim.tick();
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
    sim.tick(); // Propagate reset state to screen
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

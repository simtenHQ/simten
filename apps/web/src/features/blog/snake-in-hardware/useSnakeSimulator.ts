
import { useState, useEffect, useRef, useCallback } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { Snake } from "./circuits";

export function useSnakeSimulator() {
  const sim = useCircuitSimulator(Snake);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pixels, setPixels] = useState<number[]>(new Array(64).fill(0));

  // Refresh framebuffer after every tick by scanning scan_addr 0–63
  // and reading pixel_out. Single sandbox round-trip, clock not advanced.
  useEffect(() => {
    if (!sim.ready) return;
    let cancelled = false;
    sim.scanPort("scan_addr", "__top__.pixel_out", 64).then((result) => {
      if (!cancelled && result) setPixels(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sim.cycleCount, sim.ready, sim.scanPort]);

  // Keyboard handling — single setNode call, no race window with ticks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 2-bit direction encoding: 0=up, 1=right, 2=down, 3=left
      const keyMap: Record<string, number> = {
        ArrowUp: 0,
        ArrowDown: 2,
        ArrowLeft: 3,
        ArrowRight: 1,
      };
      const code = keyMap[e.key];
      if (code !== undefined) {
        e.preventDefault();
        sim.setNode("dir", code);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sim.setNode]);

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
    sim.tick(); // bump cycleCount so the scanPort effect fires
  }, [sim]);

  const sendDirection = useCallback(
    (code: number) => {
      sim.setNode("dir", code);
    },
    [sim.setNode],
  );

  return {
    sim,
    pixels,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
    sendDirection,
  };
}

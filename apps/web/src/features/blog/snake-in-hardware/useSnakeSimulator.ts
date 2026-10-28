import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Snake } from './circuits';

// Harnessed, so `dir` and `scan_addr` are Input nodes the page can drive, as
// a person at the board would, and `pixel_out` is read off its display.
const OPTIONS = { harness: true };

export function useSnakeSimulator() {
  const sim = useSimulation(Snake, OPTIONS);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pixels, setPixels] = useState<number[]>(new Array(64).fill(0));

  // Refresh framebuffer after every tick by scanning scan_addr 0–63
  // and reading pixel_out. Single sandbox round-trip, clock not advanced.
  useEffect(() => {
    if (!state.ready) return;
    let cancelled = false;
    void actions.scan('scan_addr', 'pixel_out.in', 64).then((result) => {
      if (!cancelled && result.length > 0) setPixels(result);
    });
    return () => {
      cancelled = true;
    };
  }, [state.cycle, state.ready, actions]);

  const sendDirection = useCallback(
    (code: number) => {
      void actions.setInput('dir', code);
    },
    [actions],
  );

  // Keyboard handling: one setInput per key, applied before the next tick
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
        sendDirection(code);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendDirection]);

  // Auto-run interval
  useEffect(() => {
    if (isRunning && state.ready) {
      intervalRef.current = setInterval(() => {
        void actions.tick();
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, state.ready, speed, actions]);

  // Reset returns to cycle 0, which changes `state.cycle` and so rescans the screen.
  const handleReset = useCallback(() => {
    setIsRunning(false);
    void actions.reset();
  }, [actions]);

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

import { useSimulation } from '@simten/react';
import { useCallback, useEffect, useState } from 'react';
import { useAutoRun } from '@/lib/auto-run';
import { Snake } from './circuits';

export function useSnakeSimulator() {
  // `dir` and `scan_addr` are input ports the page sets by name, as a person at
  // the board would. The canvas draws `pixel_out` as a display, which `scan`
  // reads. One game step every 60ms until the slider says otherwise.
  const sim = useSimulation(Snake);
  const { state, actions } = sim;
  const { isRunning, setIsRunning, speed, setSpeed } = useAutoRun(sim, 60);
  const [pixels, setPixels] = useState<number[]>(new Array(64).fill(0));

  // Refresh framebuffer after every tick by scanning scan_addr 0–63
  // and reading pixel_out. Single sandbox round-trip, clock not advanced.
  useEffect(() => {
    if (!state.ready) return;
    let cancelled = false;
    void actions.scan('scan_addr', '__top__.pixel_out', 64).then((result) => {
      if (!cancelled && result.length > 0) setPixels(result);
    });
    return () => {
      cancelled = true;
    };
  }, [state.cycle, state.ready, actions]);

  const sendDirection = useCallback(
    (code: number) => {
      void actions.set({ dir: code });
    },
    [actions],
  );

  // Keyboard handling: one set per key, applied before the next tick
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

  // Reset returns to cycle 0, which changes `state.cycle` and so rescans the screen.
  const handleReset = useCallback(() => {
    void actions.pause();
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

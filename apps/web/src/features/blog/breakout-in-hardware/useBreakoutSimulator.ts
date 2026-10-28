import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Breakout } from './circuits';

const PIXELS = 512; // 32x16 combinational raster readout
// ms between game ticks. The ball moves every 4 ticks and the paddle every 2,
// so a smaller value = faster play. ~35ms → ball ≈ 7 cells/s, paddle ≈ 14.
const TICK_MS = 35;
// Harnessed, so `scan_addr`, `keyboard` and `game_en` are input nodes the page
// can drive, and the outputs are read off their displays.
const OPTIONS = { harness: true };

export function useBreakoutSimulator() {
  const sim = useSimulation(Breakout, OPTIONS);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pixels, setPixels] = useState<number[]>(new Array(PIXELS).fill(0));

  // Refresh the screen after every tick: sweep scan_addr 0..511 and read
  // pixel_out combinationally (one sandbox round-trip, clock not advanced),
  // the same read path snake uses.
  useEffect(() => {
    if (!state.ready) return;
    let cancelled = false;
    void actions.scan('scan_addr', 'pixel_out.in', PIXELS).then((result) => {
      if (!cancelled && result.length > 0) setPixels(result);
    });
    return () => {
      cancelled = true;
    };
  }, [state.cycle, state.ready, actions]);

  // Hold the game-clock enable high: in the browser the game advances one step
  // per tick (we throttle the tick rate). On the FPGA this input is pulsed at
  // ~30 Hz instead, while the clock and the wall-fill FSM run at full speed.
  useEffect(() => {
    if (state.ready) void actions.setInput('game_en', 1);
  }, [state.ready, actions]);

  // Paddle input on the top-level `keyboard` bus: 75 = left, 77 = right, 0 = released.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = { ArrowLeft: 75, ArrowRight: 77 };
      const code = keyMap[e.key];
      if (code !== undefined) {
        e.preventDefault();
        void actions.setInput('keyboard', code);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        void actions.setInput('keyboard', 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [actions]);

  // Run: one game step (one clock tick) per interval, like snake. The screen
  // refresh is driven by the cycleCount effect above. If a game step lands the
  // circuit in a wall redraw (the fill FSM, high on `is_filling`, after a death
  // or at power-on), burst through its ~128 clocks in one shot so the wall snaps
  // back full instantly, as it does on the FPGA at MHz. A recursive timeout
  // (not setInterval) keeps the async tick/scan/burst from overlapping.
  useEffect(() => {
    if (!isRunning || !state.ready) return;
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      await actions.tick();
      const status = await actions.scan('scan_addr', 'is_filling.in', 1);
      if (!cancelled && status[0]) await actions.tick(140);
      if (!cancelled) intervalRef.current = setTimeout(loop, TICK_MS);
    };
    loop();
    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, state.ready, actions]);

  const stepFrame = useCallback(() => {
    void actions.tick(4); // one ball-move worth of steps, so Step visibly advances
  }, [actions]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    void actions.reset();
    // Fill the brick wall (128 ticks); the new cycle count refreshes the screen.
    void actions.tick(130);
  }, [actions]);

  const sendDirection = useCallback(
    (code: number) => {
      void actions.setInput('keyboard', code);
    },
    [actions],
  );

  return {
    sim,
    pixels,
    isRunning,
    setIsRunning,
    stepFrame,
    handleReset,
    sendDirection,
  };
}

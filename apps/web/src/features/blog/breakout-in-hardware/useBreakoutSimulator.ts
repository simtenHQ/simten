import { useSimulation } from '@simten/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutoRun } from '@/lib/auto-run';
import { useGameKeys } from '@/lib/game-keys';
import { Breakout } from './circuits';

const PIXELS = 512; // 32x16 combinational raster readout
// ms between game ticks. The ball moves every 4 ticks and the paddle every 2,
// so a smaller value = faster play. ~35ms → ball ≈ 7 cells/s, paddle ≈ 14.
const TICK_MS = 35;
const PADDLE_KEYS: Record<string, number> = { ArrowLeft: 75, ArrowRight: 77 };
export function useBreakoutSimulator() {
  // `scan_addr`, `keyboard` and `game_en` are input ports the page sets by
  // name. The canvas draws each output as a display, which `scan` reads.
  const sim = useSimulation(Breakout);
  const { state, actions } = sim;
  const { isRunning, setIsRunning } = useAutoRun(sim, TICK_MS);
  const [pixels, setPixels] = useState<number[]>(new Array(PIXELS).fill(0));

  // Refresh the screen after every tick: sweep scan_addr 0..511 and read
  // pixel_out combinationally (one sandbox round-trip, clock not advanced),
  // the same read path snake uses.
  useEffect(() => {
    if (!state.ready) return;
    let cancelled = false;
    void actions.scan('scan_addr', '__top__.pixel_out', PIXELS).then((result) => {
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
    if (state.ready) void actions.set({ game_en: 1 });
  }, [state.ready, actions]);

  // Paddle input on the top-level `keyboard` bus: 75 = left, 77 = right, 0 = released.
  // Live while the demo has focus.
  const keys = useMemo(
    () => ({
      down: (key: string) => {
        const code = PADDLE_KEYS[key];
        if (code === undefined) return false;
        void actions.set({ keyboard: code });
        return true;
      },
      up: (key: string) => {
        if (PADDLE_KEYS[key] === undefined) return false;
        void actions.set({ keyboard: 0 });
        return true;
      },
    }),
    [actions],
  );
  const keyboard = useGameKeys(keys);

  // The sandbox runs the game a step at a time. When a step lands in a wall
  // redraw (the fill FSM, high on `is_filling`, after a death or at power-on),
  // burst through its ~128 clocks in one request so the wall snaps back full
  // at once, as it does on the FPGA at MHz. It runs between auto-run frames,
  // in order with them. The effect fires once per rising edge.
  const isFilling = state.outputs.is_filling === 1;
  useEffect(() => {
    if (isRunning && isFilling) void actions.tick(140);
  }, [isRunning, isFilling, actions]);

  const stepFrame = useCallback(() => {
    void actions.tick(4); // one ball-move worth of steps, so Step visibly advances
  }, [actions]);

  const handleReset = useCallback(() => {
    void actions.pause();
    void actions.reset();
    // Fill the brick wall (128 ticks); the new cycle count refreshes the screen.
    void actions.tick(130);
  }, [actions]);

  const sendDirection = useCallback(
    (code: number) => {
      void actions.set({ keyboard: code });
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
    keyboard,
  };
}

import type { PeripheralValue } from '@simten/core/internal';
import { useSimulation } from '@simten/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameKeys } from '@/lib/game-keys';
import { PongSimple } from './circuits';

/** The framebuffer is 16x16, one byte per pixel. */
export const PONG_GRID = 16;

/** One game frame is a 14-phase pipeline: 14 clock cycles. */
const CYCLES_PER_FRAME = 14;

/** The framebuffer: the contents of the `ram` node, which the screen reads. */
function framebuffer(peripherals: ReadonlyMap<string, PeripheralValue>): number[] {
  const pixels = new Array(PONG_GRID * PONG_GRID).fill(0);
  const ram = peripherals.get('ram');
  if (ram instanceof Map) {
    for (let addr = 0; addr < pixels.length; addr++) pixels[addr] = ram.get(addr) ?? 0;
  }
  return pixels;
}

/** The switches that run the game, on from the start. */
const ENABLES = ['phaseEnable', 'updateEnable', 'writeEnable'];

/** Each key's code on its paddle's keyboard input; 0 is released. */
const PADDLE_KEYS: Record<string, number> = {
  w: 17,
  W: 17,
  s: 31,
  S: 31,
  ArrowUp: 72,
  ArrowDown: 80,
};

export function usePongSimulator() {
  const sim = useSimulation(PongSimple);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  // Milliseconds per game frame.
  const [speed, setSpeed] = useState(60);
  const pixels = useMemo(() => framebuffer(state.peripheralState), [state.peripheralState]);

  // Find node IDs for keyboard inputs and switches
  const nodeIds = useMemo(() => {
    const map: Record<string, string> = {};
    if (!state.circuit?.nodes) return map;
    const names = ['keyboard0', 'keyboard1', ...ENABLES];
    for (const node of state.circuit.nodes) {
      for (const name of names) {
        if (node.label === name || node.id === name) {
          map[name] = node.id;
        }
      }
    }
    return map;
  }, [state.circuit]);

  // Turn the enable switches on once the circuit is up. Switches keep their
  // position through a reset, as on a real board, so this runs once per session.
  useEffect(() => {
    if (!state.ready) return;
    for (const name of ENABLES) {
      if (nodeIds[name]) void actions.set({ [nodeIds[name]]: 1 });
    }
  }, [state.ready, actions, nodeIds]);

  // Each paddle gets its own keyboard input node so both can be held at once
  const sendLeftDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard0) void actions.set({ [nodeIds.keyboard0]: code });
    },
    [nodeIds, actions],
  );

  const sendRightDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard1) void actions.set({ [nodeIds.keyboard1]: code });
    },
    [nodeIds, actions],
  );

  // Keyboard, while the demo has focus: W/S drive the left paddle, arrows the right
  const keys = useMemo(() => {
    const paddle = (key: string) => {
      const code = PADDLE_KEYS[key];
      if (code === undefined) return undefined;
      return { send: key.startsWith('Arrow') ? sendRightDirection : sendLeftDirection, code };
    };
    return {
      down: (key: string) => {
        const hit = paddle(key);
        hit?.send(hit.code);
        return hit !== undefined;
      },
      up: (key: string) => {
        const hit = paddle(key);
        hit?.send(0);
        return hit !== undefined;
      },
    };
  }, [sendLeftDirection, sendRightDirection]);
  const keyboard = useGameKeys(keys);

  // Pong has no frame sync, so the page asks for whole 14-cycle frames; a worker-run frame lands mid-draw and tears.
  useEffect(() => {
    if (!isRunning || !state.ready) return;
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void actions.tick(CYCLES_PER_FRAME).finally(() => {
        inFlight = false;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [isRunning, state.ready, speed, actions]);

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
    sendLeftDirection,
    sendRightDirection,
    keyboard,
  };
}

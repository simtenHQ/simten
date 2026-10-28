import type { PeripheralValue } from '@simten/core/internal';
import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PongSimple } from './circuits';

/** The framebuffer is 16x16, one byte per pixel. */
export const PONG_GRID = 16;

/** The framebuffer RAM's contents, read from the peripheral state. */
function framebuffer(peripherals: ReadonlyMap<string, PeripheralValue>): number[] {
  const pixels = new Array(PONG_GRID * PONG_GRID).fill(0);
  for (const [nodeId, contents] of peripherals) {
    if (contents instanceof Map && nodeId.toLowerCase().includes('ram')) {
      for (let addr = 0; addr < pixels.length; addr++) pixels[addr] = contents.get(addr) ?? 0;
      break;
    }
  }
  return pixels;
}

/** The switches that run the game, on from the start. */
const ENABLES = ['phaseEnable', 'updateEnable', 'writeEnable'];

export function usePongSimulator() {
  const sim = useSimulation(PongSimple);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (nodeIds[name]) void actions.setInput(nodeIds[name], 1);
    }
  }, [state.ready, actions, nodeIds]);

  // Each paddle gets its own keyboard input node so both can be held at once
  const sendLeftDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard0) void actions.setInput(nodeIds.keyboard0, code);
    },
    [nodeIds, actions],
  );

  const sendRightDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard1) void actions.setInput(nodeIds.keyboard1, code);
    },
    [nodeIds, actions],
  );

  // Keyboard listener: W/S drive the left paddle, arrows the right
  useEffect(() => {
    if (!state.ready) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w':
        case 'W':
          sendLeftDirection(17);
          break;
        case 's':
        case 'S':
          sendLeftDirection(31);
          break;
        case 'ArrowUp':
          e.preventDefault();
          sendRightDirection(72);
          break;
        case 'ArrowDown':
          e.preventDefault();
          sendRightDirection(80);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w':
        case 'W':
        case 's':
        case 'S':
          sendLeftDirection(0);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          sendRightDirection(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.ready, sendLeftDirection, sendRightDirection]);

  // Auto-run interval: run a complete 14-phase game frame each time.
  // Speed controls how often frames run (higher = slower ball + paddles).
  // One 14-cycle tick per frame is one sandbox round trip and one React
  // update, so React renders only at end-of-frame (no mid-cycle flicker).
  useEffect(() => {
    if (isRunning && state.ready) {
      intervalRef.current = setInterval(() => {
        void actions.tick(14);
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
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
  };
}

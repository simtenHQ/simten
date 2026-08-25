import { useCircuitSimulator } from '@simten/embed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PongSimple } from './circuits';

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
    const names = ['keyboard0', 'keyboard1', 'phaseEnable', 'updateEnable', 'writeEnable'];
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

  // Each paddle gets its own keyboard input node so both can be held at once
  const sendLeftDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard0) sim.setNodeValue(nodeIds.keyboard0, code);
    },
    [nodeIds, sim.setNodeValue],
  );

  const sendRightDirection = useCallback(
    (code: number) => {
      if (nodeIds.keyboard1) sim.setNodeValue(nodeIds.keyboard1, code);
    },
    [nodeIds, sim.setNodeValue],
  );

  // Keyboard listener: W/S drive the left paddle, arrows the right
  useEffect(() => {
    if (!sim.ready) return;

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
  }, [sim.ready, sendLeftDirection, sendRightDirection]);

  // Auto-run interval: run a complete 14-phase game frame each time.
  // Speed controls how often frames run (higher = slower ball + paddles).
  // tickN batches all 14 cycles into one sandbox round-trip and one React
  // update, so React renders only at end-of-frame (no mid-cycle flicker).
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => {
        sim.tickN(14);
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, sim.ready, speed, sim.tickN]);

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
    sendLeftDirection,
    sendRightDirection,
  };
}

import { useSimulation } from '@simten/react/sandbox';
import { useCallback, useEffect, useMemo } from 'react';
import { cyclesPerSecond, useAutoRun } from '@/lib/auto-run';
import { MiniSwitch2Port } from './circuits';

/** One cycle every 50ms until the slider says otherwise. */
const OPTIONS = { speed: cyclesPerSecond(50) };

export function useSwitchSimulator() {
  const sim = useSimulation(MiniSwitch2Port, OPTIONS);
  const { state, actions } = sim;
  const { isRunning, setIsRunning, speed, setSpeed } = useAutoRun(sim);

  // Find key node IDs by label
  const nodeIds = useMemo(() => {
    if (!state.circuit?.nodes) return null;
    const ids: Record<string, string> = {};
    for (const node of state.circuit.nodes) {
      const label = node.label ?? node.id;
      if (
        label === 'always_ready' ||
        label === 'p0_byte' ||
        label === 'p0_valid' ||
        label === 'p1_byte' ||
        label === 'p1_valid'
      ) {
        ids[label] = node.id;
      }
    }
    return ids;
  }, [state.circuit]);

  // Turn the always_ready switch on once the circuit is up. Switches keep
  // their position through a reset, so this runs once per session.
  useEffect(() => {
    if (!state.ready || !nodeIds?.always_ready) return;
    void actions.setInput(nodeIds.always_ready, 1);
  }, [state.ready, nodeIds, actions]);

  const handleReset = useCallback(() => {
    void actions.pause();
    void actions.reset();
  }, [actions]);

  // Inject a packet on a given port by setting byte + valid, then ticking
  const injectByte = useCallback(
    (port: 0 | 1, byte: number) => {
      if (!nodeIds) return;
      const byteNode = port === 0 ? nodeIds.p0_byte : nodeIds.p1_byte;
      const validNode = port === 0 ? nodeIds.p0_valid : nodeIds.p1_valid;
      if (byteNode) void actions.setInput(byteNode, byte);
      if (validNode) void actions.setInput(validNode, 1);
    },
    [nodeIds, actions],
  );

  const clearValid = useCallback(
    (port: 0 | 1) => {
      if (!nodeIds) return;
      const validNode = port === 0 ? nodeIds.p0_valid : nodeIds.p1_valid;
      if (validNode) void actions.setInput(validNode, 0);
    },
    [nodeIds, actions],
  );

  return {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
    injectByte,
    clearValid,
    nodeIds,
  };
}

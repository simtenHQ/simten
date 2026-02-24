/**
 * ClockControls Component (Orchestrator Architecture)
 *
 * UI controls for sequential circuit simulation.
 * NEVER executes simulation - only requests it via store.
 *
 * The orchestrator (simulation/orchestrator.ts) is the ONLY place that runs simulation.
 */

'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SkipForward, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../primitives/button';
import { useUIStore } from '../stores';
import { useSimulationController } from '../simulation/use-simulation-controller';


export function ClockControls() {
  // Get simulation controller API
  const {
    step,
    reset,
    stepBack: controllerStepBack,
    stepForward: controllerStepForward,
    seek,
    cycle,
    history,
    currentHistoryIndex,
    isViewingPast,
    isSequential,
  } = useSimulationController();

  // Testbench (TODO: Re-enable when testbench integration is updated)
  // const testbench = useTestbenchStore((state) => state.testbench);
  // const executionState = useTestbenchStore((state) => state.executionState);

  // UI state
  const setSimulationStatus = useUIStore((state) => state.setSimulationStatus);
  const [clockSpeed, setClockSpeed] = useState(1); // Hz
  const [isRunning, setIsRunning] = useState(false);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle step - execute one simulation step
  const handleStep = useCallback(() => {
    setSimulationStatus('running');

    // Execute one step via controller
    step();

    setTimeout(() => {
      setSimulationStatus('idle');
    }, 50);
  }, [step, setSimulationStatus]);

  // Handle run - continuously request simulation
  const handleRun = useCallback(() => {
    setIsRunning(true);
  }, []);

  // Handle pause
  const handlePause = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    handlePause();

    // Reset via controller
    reset();
  }, [handlePause, reset]);

  // Run loop effect
  useEffect(() => {
    if (!isRunning || !isSequential) {
      return;
    }

    // Start interval for continuous simulation steps
    runIntervalRef.current = setInterval(() => {
      setSimulationStatus('running');

      // Execute step via controller
      step();

      setTimeout(() => {
        setSimulationStatus('idle');
      }, 50);
    }, 1000 / clockSpeed);

    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, clockSpeed, isSequential, step, setSimulationStatus]);

  // Time-travel: Step back
  const handleStepBack = useCallback(() => {
    controllerStepBack();
  }, [controllerStepBack]);

  // Time-travel: Step forward
  const handleStepForward = useCallback(() => {
    controllerStepForward();
  }, [controllerStepForward]);

  // Don't show controls for purely combinational circuits
  if (!isSequential) {
    return null;
  }

  const currentCycle = cycle;
  const historySize = history.length;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {/* Simulation controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStep}
          disabled={isRunning || isViewingPast}
          title="Step (execute one clock cycle)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {isRunning ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePause}
            disabled={isViewingPast}
            title="Pause continuous execution"
          >
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRun}
            disabled={isViewingPast}
            title="Run continuously"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          title="Reset circuit to initial state"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Clock speed control */}
      <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
        <label className="text-xs text-gray-600" htmlFor="clock-speed">
          Speed:
        </label>
        <input
          id="clock-speed"
          type="range"
          min="1"
          max="10"
          value={clockSpeed}
          onChange={(e) => setClockSpeed(Number(e.target.value))}
          className="w-24"
          disabled={isViewingPast}
        />
        <span className="min-w-[40px] text-xs text-gray-600">{clockSpeed} Hz</span>
      </div>

      {/* Cycle counter */}
      <div className="border-l border-gray-200 pl-2">
        <span className="text-xs text-gray-600">
          Cycle: <span className="font-mono font-semibold">{currentCycle}</span>
        </span>
      </div>

      {/* Time-travel controls */}
      <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepBack}
          disabled={currentHistoryIndex <= 0 || isRunning}
          title="Step back (rewind one cycle)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-[80px] text-center text-xs text-gray-600">
          {isViewingPast ? (
            <span className="font-mono text-amber-600">
              {currentHistoryIndex + 1}/{historySize}
            </span>
          ) : (
            <span className="font-mono">
              {historySize}/{historySize}
            </span>
          )}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepForward}
          disabled={!isViewingPast || isRunning}
          title="Step forward (replay one cycle)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Scrubber slider for fast navigation */}
        {historySize > 1 && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="range"
              min="0"
              max={historySize - 1}
              value={currentHistoryIndex}
              onChange={(e) => {
                const targetIndex = Number(e.target.value);
                const targetCycle = history[targetIndex]?.cycleNumber;
                if (targetCycle !== undefined) {
                  seek(targetCycle);
                }
              }}
              className="w-32 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              disabled={isRunning}
              title="Scrub through history"
            />
          </div>
        )}
      </div>
    </div>
  );
}

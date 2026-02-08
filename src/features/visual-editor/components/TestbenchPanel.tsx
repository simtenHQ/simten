/**
 * TestbenchPanel Component
 *
 * Displays testbench execution status, progress, and results.
 *
 * Features:
 * - Shows testbench info (name, circuit ref, max cycles)
 * - Displays current stimulus being applied
 * - Shows progress indicator
 * - Displays assertion results
 * - VCD export button
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  FastForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTestbenchStore } from '../stores/testbench-store';
import { useSimulationController } from '../simulation/use-simulation-controller';
import { simulationController } from '../simulation/simulation-controller';
import { initializeCaptureData, collectPortValues } from '../lib/testbench-runner';
import { useCircuitStore } from '../stores/circuit-store';

export function TestbenchPanel() {
  const testbench = useTestbenchStore((state) => state.testbench);
  const executionState = useTestbenchStore((state) => state.executionState);
  const getCurrentStimulus = useTestbenchStore((state) => state.getCurrentStimulus);
  const exportVCD = useTestbenchStore((state) => state.exportVCD);
  const getCurrentCycle = useTestbenchStore((state) => state.getCurrentCycle);
  const getMaxCycles = useTestbenchStore((state) => state.getMaxCycles);
  const getTestStatus = useTestbenchStore((state) => state.getTestStatus);
  const getProgress = useTestbenchStore((state) => state.getProgress);
  const clearTestbench = useTestbenchStore((state) => state.clearTestbench);

  // Get simulation controller API
  const { step, reset, setInput } = useSimulationController();

  // Get testbench store actions
  const advanceCycle = useTestbenchStore((state) => state.advanceCycle);
  const setCaptureData = useTestbenchStore((state) => state.setCaptureData);

  // Get circuit for capture
  const circuit = useCircuitStore((state) => state.circuit);

  // Initialize capture data when testbench loads (if it has capture config)
  // Keep local ref - don't store in zustand until complete (to avoid Immer freezing)
  const captureDataRef = useRef<ReturnType<typeof initializeCaptureData> | null>(null);
  useEffect(() => {
    if (testbench?.capture && !captureDataRef.current) {
      captureDataRef.current = initializeCaptureData(testbench.capture);
    }
  }, [testbench]);

  // Reset capture data when testbench changes or is cleared
  useEffect(() => {
    if (!testbench) {
      captureDataRef.current = null;
    }
  }, [testbench]);

  // Local run state
  const [isRunning, setIsRunning] = useState(false);
  const [clockSpeed, setClockSpeed] = useState(5); // Hz
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Apply stimulus for current cycle before stepping
  const applyCurrentStimulus = useCallback(() => {
    const stimulus = getCurrentStimulus();
    for (const action of stimulus) {
      // Apply stimulus via simulation controller
      // For testbench inputs, the node ID is tb_input_{portName}
      const nodeId = action.nodeId === '' ? `tb_input_${action.portName}` : action.nodeId;
      const value = typeof action.value === 'boolean' ? (action.value ? 1 : 0) : action.value;
      setInput(nodeId, value);
    }
  }, [getCurrentStimulus, setInput]);

  // Collect capture data after a step
  // Uses simulationController directly to get fresh port values (not stale React state)
  const collectCapture = useCallback(() => {
    if (captureDataRef.current && circuit) {
      const currentCycle = getCurrentCycle();
      // Get fresh port values directly from controller (not from React hook which may be stale)
      const freshPortValues = simulationController.getPortValues();
      const portValuesMap = new Map<string, number | boolean>();
      for (const [key, value] of freshPortValues.entries()) {
        portValuesMap.set(key, value);
      }
      collectPortValues(circuit, captureDataRef.current, currentCycle, portValuesMap);

      // Only store in zustand when we reach max cycles (to avoid Immer freezing during collection)
      const maxCycles = getMaxCycles();
      if (currentCycle + 1 >= maxCycles) {
        setCaptureData(captureDataRef.current);
      }
    }
  }, [circuit, getCurrentCycle, getMaxCycles, setCaptureData]);

  // Handle step - apply stimulus, run simulation, advance testbench cycle, collect capture
  const handleStep = useCallback(() => {
    applyCurrentStimulus();
    step();
    collectCapture();
    advanceCycle();
  }, [applyCurrentStimulus, step, collectCapture, advanceCycle]);

  // Handle run
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

  // Handle reset - reset both simulation controller and testbench store
  const resetExecution = useTestbenchStore((state) => state.resetExecution);
  const handleReset = useCallback(() => {
    handlePause();
    reset();
    resetExecution();
    // Reinitialize capture data (keep local, don't store in zustand yet)
    if (testbench?.capture) {
      captureDataRef.current = initializeCaptureData(testbench.capture);
    }
  }, [handlePause, reset, resetExecution, testbench]);

  // Handle run all (run to completion)
  const handleRunAll = useCallback(() => {
    const maxCycles = getMaxCycles();
    const currentCycle = getCurrentCycle();
    const remaining = maxCycles - currentCycle;

    // Run all remaining cycles quickly
    for (let i = 0; i < remaining; i++) {
      applyCurrentStimulus();
      step();
      collectCapture();
      advanceCycle();
    }
  }, [step, advanceCycle, applyCurrentStimulus, collectCapture, getMaxCycles, getCurrentCycle]);

  // Run loop effect
  useEffect(() => {
    const maxCycles = getMaxCycles();
    const currentCycleNow = getCurrentCycle();

    if (!isRunning) {
      return;
    }

    // Auto-stop when reaching max cycles
    if (currentCycleNow >= maxCycles) {
      setIsRunning(false);
      return;
    }

    runIntervalRef.current = setInterval(() => {
      const currentCycle = getCurrentCycle();
      if (currentCycle >= maxCycles) {
        setIsRunning(false);
        if (runIntervalRef.current) {
          clearInterval(runIntervalRef.current);
          runIntervalRef.current = null;
        }
        return;
      }
      // Use handleStep to apply stimulus, advance testbench cycle, and collect capture
      applyCurrentStimulus();
      step();
      collectCapture();
      advanceCycle();
    }, 1000 / clockSpeed);

    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, clockSpeed, step, advanceCycle, applyCurrentStimulus, collectCapture, getMaxCycles, getCurrentCycle]);

  if (!testbench) {
    return null; // Don't show panel if no testbench loaded
  }

  const currentCycle = getCurrentCycle();
  const maxCycles = getMaxCycles();
  const status = getTestStatus();
  const progress = getProgress();
  const currentStimulus = getCurrentStimulus();
  const isComplete = currentCycle >= maxCycles;

  // Status icon and color
  const statusConfig = {
    idle: { icon: Clock, color: 'text-gray-500', label: 'Ready' },
    running: { icon: Activity, color: 'text-blue-500', label: 'Running' },
    passed: { icon: CheckCircle, color: 'text-green-500', label: 'Passed' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
    timeout: { icon: XCircle, color: 'text-orange-500', label: 'Timeout' },
  };

  const { icon: StatusIcon, color: statusColor, label: statusLabel } = statusConfig[status];

  return (
    <div className="w-80 border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Testbench</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTestbench}
            className="h-6 px-2"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Testbench Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Name:</span>
            <span className="font-medium">{testbench.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Circuit:</span>
            <span className="font-medium">{testbench.circuitRef}</span>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        {/* Run Controls */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700">Controls:</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStep}
              disabled={isRunning || isComplete}
              title="Step one cycle"
              className="flex-1 gap-1"
            >
              <SkipForward className="h-4 w-4" />
              Step
            </Button>

            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                title="Pause"
                className="flex-1 gap-1"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={isComplete}
                title="Run continuously"
                className="flex-1 gap-1"
              >
                <Play className="h-4 w-4" />
                Run
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              title="Reset to cycle 0"
              className="flex-1 gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Run All button */}
          <Button
            variant="default"
            size="sm"
            onClick={handleRunAll}
            disabled={isRunning || isComplete}
            title="Run all remaining cycles"
            className="w-full gap-1"
          >
            <FastForward className="h-4 w-4" />
            Run All ({maxCycles - currentCycle} cycles)
          </Button>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Speed:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={clockSpeed}
              onChange={(e) => setClockSpeed(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-gray-600 min-w-[45px]">{clockSpeed} Hz</span>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Cycle:</span>
            <span className="font-medium">
              {currentCycle} / {maxCycles}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-xs text-gray-500 text-right">{Math.round(progress)}%</div>
        </div>

        <div className="border-t border-gray-200" />

        {/* Current Stimulus */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Current Stimulus:</div>
          {currentStimulus.length > 0 ? (
            <div className="bg-gray-50 rounded p-2 space-y-1">
              {currentStimulus.map((action, idx) => (
                <div key={idx} className="text-xs font-mono">
                  <span className="text-gray-600">{action.portName}</span>
                  <span className="text-gray-400"> = </span>
                  <span className="text-blue-600">
                    {typeof action.value === 'boolean'
                      ? action.value ? '1' : '0'
                      : `0x${action.value.toString(16).toUpperCase()}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">No stimulus at this cycle</div>
          )}
        </div>

        <div className="border-t border-gray-200" />

        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
          </div>

          {/* Assertion Results */}
          {executionState && executionState.assertionResults.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Assertions:</div>
              <div className="text-sm">
                <span className="text-green-600">
                  {executionState.assertionResults.filter((r) => r.passed).length} passed
                </span>
                {executionState.assertionResults.some((r) => !r.passed) && (
                  <>
                    <span className="text-gray-400"> / </span>
                    <span className="text-red-600">
                      {executionState.assertionResults.filter((r) => !r.passed).length} failed
                    </span>
                  </>
                )}
              </div>

              {/* Show failed assertions */}
              {executionState.assertionResults
                .filter((r) => !r.passed)
                .map((result) => (
                  <div
                    key={result.assertionId}
                    className="bg-red-50 border border-red-200 rounded p-2 text-xs"
                  >
                    <div className="font-medium text-red-700">
                      Cycle {result.cycle}: {result.message}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Failure Reason */}
          {executionState?.failureReason && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              {executionState.failureReason}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200" />

        {/* Actions */}
        <div className="space-y-2">
          {/* VCD Export */}
          {testbench.capture && (
            <Button
              onClick={exportVCD}
              disabled={!executionState?.captureData}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              Download VCD
            </Button>
          )}

          {!testbench.capture && (
            <div className="text-xs text-gray-500 italic text-center">
              No VCD capture configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

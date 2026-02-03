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

import React from 'react';
import { Download, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTestbenchStore } from '../stores/testbench-store';

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

  if (!testbench) {
    return null; // Don't show panel if no testbench loaded
  }

  const currentCycle = getCurrentCycle();
  const maxCycles = getMaxCycles();
  const status = getTestStatus();
  const progress = getProgress();
  const currentStimulus = getCurrentStimulus();

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

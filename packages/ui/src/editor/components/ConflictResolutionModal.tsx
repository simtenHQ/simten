/**
 * ConflictResolutionModal Component
 *
 * Modal dialog for resolving conflicts between circuit code and canvas edits.
 * Shows when both the TypeScript circuit code and canvas have been modified simultaneously.
 *
 * User can choose to:
 * - Keep code changes (discard canvas changes)
 * - Keep canvas changes (update code from canvas)
 */

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../primitives/button';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onKeepDSL: () => void;
  onKeepCanvas: () => void;
  onCancel: () => void;
}

export function ConflictResolutionModal({
  isOpen,
  onKeepDSL,
  onKeepCanvas,
  onCancel,
}: ConflictResolutionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Conflict Detected</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 mb-4">
            Both the circuit code and the canvas have been modified since the last sync.
            Please choose which changes to keep:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <h3 className="text-sm font-medium text-blue-900 mb-1">Keep Code Changes</h3>
              <p className="text-xs text-blue-700">
                The canvas will be updated to match the current circuit code.
                Any canvas-only changes will be lost.
              </p>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <h3 className="text-sm font-medium text-green-900 mb-1">Keep Canvas Changes</h3>
              <p className="text-xs text-green-700">
                The circuit code will be regenerated from the current canvas state.
                Any code-only changes will be lost.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onKeepDSL}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Keep Code
          </Button>
          <Button
            onClick={onKeepCanvas}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            Keep Canvas
          </Button>
        </div>
      </div>
    </div>
  );
}

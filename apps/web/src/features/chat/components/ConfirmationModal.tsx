/**
 * ConfirmationModal Component
 *
 * Modal for 'confirm' safety level actions.
 */

'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConfirmationRequest } from '../actions/confirmation-flow';

interface ConfirmationModalProps {
  request: ConfirmationRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  request,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Icon and title */}
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {request.title}
            </h3>
            <p className="mt-2 text-sm text-gray-600">{request.description}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {request.cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{request.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * StaleActionNotice Component
 *
 * Gentle notification when circuit was modified after suggestion.
 */

'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StaleActionNoticeProps {
  onReask: () => void;
}

export function StaleActionNotice({ onReask }: StaleActionNoticeProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm">
      <div className="flex-1 text-yellow-800">
        The circuit was modified. Would you like to re-ask?
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onReask}
        className="gap-2 shrink-0"
      >
        <RefreshCw className="h-4 w-4" />
        Re-ask
      </Button>
    </div>
  );
}

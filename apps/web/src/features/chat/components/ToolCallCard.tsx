/**
 * ToolCallCard Component
 *
 * Renders a tool call inline in the chat: tool name, status, collapsible result.
 */

'use client';

import { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCallInfo } from '../types';

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
}

const TOOL_LABELS: Record<string, string> = {
  get_primitives: 'Browse components',
  get_grammar: 'Get circuit API reference',
  check_circuit: 'Validate code',
  simulate_circuit: 'Simulate circuit',
  show_diff: 'Propose code change',
  set_input: 'Set input',
  run_simulation: 'Run simulation',
  insert_node: 'Insert node',
  generate_harness: 'Generate harness',
  verify_assertion: 'Verify assertions',
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-muted/40 transition-colors"
      >
        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground font-medium truncate flex-1">
          {label}
        </span>
        {toolCall.status === 'running' ? (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
        ) : toolCall.status === 'error' ? (
          <span className="text-red-500 shrink-0">failed</span>
        ) : (
          <Check className="h-3 w-3 text-green-500 shrink-0" />
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-border/30">
          <pre
            className={cn(
              'mt-1.5 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-all',
              'max-h-32 overflow-y-auto text-muted-foreground'
            )}
          >
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
          {toolCall.result && (
            <pre className="mt-1 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-muted-foreground/70">
              {toolCall.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

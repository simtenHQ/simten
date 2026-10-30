import { useEffect, useRef } from 'react';
import { usePeripheral } from '../canvas/values';
import { BaseNode } from './BaseNode';
import type { NodeData } from './NodeData';

interface ConsoleNodeProps {
  data: NodeData;
  selected?: boolean;
}

interface TextOutputNodeProps extends ConsoleNodeProps {
  defaultLabel: string;
  placeholder: string;
}

function TextOutputNode({ data, selected, defaultLabel, placeholder }: TextOutputNodeProps) {
  const textAreaRef = useRef<HTMLPreElement>(null);
  // The text written so far, kept by the session under the node's path.
  const written = usePeripheral(data.path);
  const text = typeof written === 'string' ? written : '';

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [text]);

  const lineCount = text ? text.split('\n').length : 0;
  const charCount = text.length;

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: 'output' as const,
      }))}
      className="min-w-[200px]"
      showPortLabels={data.showPortLabels}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || defaultLabel}
        </div>
        <pre
          ref={textAreaRef}
          className="w-full h-32 overflow-auto rounded border-2 border-gray-700 bg-black text-green-400 font-mono text-xs p-2 whitespace-pre-wrap break-all"
          style={{ minWidth: '180px', maxHeight: '200px' }}
        >
          {text || <span className="text-[var(--embed-text-muted)]">{placeholder}</span>}
        </pre>
        <div className="text-xs text-[var(--embed-text-secondary)]">
          {charCount} chars, {lineCount} lines
        </div>
      </div>
    </BaseNode>
  );
}

export function ConsoleNode(props: ConsoleNodeProps) {
  return <TextOutputNode {...props} defaultLabel="Console" placeholder="// output appears here" />;
}

export function UartTxNode(props: ConsoleNodeProps) {
  return (
    <TextOutputNode {...props} defaultLabel="UART TX" placeholder="// UART output appears here" />
  );
}

import { usePeripheral } from '../canvas/values';
import { BaseNode } from './BaseNode';
import type { NodeData } from './NodeData';

interface NicFifoNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function NicFifoNode({ data, selected }: NicFifoNodeProps) {
  // The FIFO's registers: write and read pointers, receive count, draining flag.
  const registers = usePeripheral(data.path);
  const read = (address: number) => (registers instanceof Map ? (registers.get(address) ?? 0) : 0);
  const txCount = read(0x2000) - read(0x2001);
  const rxCount = read(0x2012);
  const draining = read(0x2004) !== 0;

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: 'output' as const,
      }))}
      className="min-w-[160px]"
      showPortLabels={data.showPortLabels}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'NIC'}
        </div>
        <div className="w-full rounded border border-[var(--embed-border-node)] bg-[var(--embed-bg-tertiary)] p-2 text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--embed-text-secondary)]">TX FIFO:</span>
            <span className="text-blue-400">{txCount} words</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--embed-text-secondary)]">RX FIFO:</span>
            <span className="text-green-400">{rxCount} words</span>
          </div>
          {draining && <div className="text-center text-yellow-400 font-bold">TRANSMITTING</div>}
        </div>
      </div>
    </BaseNode>
  );
}

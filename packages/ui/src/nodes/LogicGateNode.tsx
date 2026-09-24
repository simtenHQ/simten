import { BaseNode, type PortConfig } from './BaseNode';
import { CompositeBadge } from './CompositeBadge';
import type { NodeData } from './NodeData';

const SIMPLE_GATES = new Set(['And', 'Or', 'Not', 'Nand', 'Nor', 'Xor', 'Xnor', 'Buffer']);

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/**
 * What a component says on its face.
 *
 * Slices print the bits they take rather than their name and width. A row of
 * boxes reading `BitSlice(4)` says nothing about which bits each one carries,
 * and the number is the *input* width, so a one-bit slice of a four-bit bus
 * announced itself as 4. `[3:1]` is what Verilog calls the same thing, and it
 * sits under a node name that already says why the slice exists.
 */
function formatComponentLabel(componentRef: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return componentRef;

  if (componentRef === 'BitSlice') {
    const low = num(args.low) ?? 0;
    const high = num(args.high) ?? low;
    return high === low ? `[${low}]` : `[${high}:${low}]`;
  }

  // `Slice` is the importer's shape: an offset and a width rather than a range.
  if (componentRef === 'Slice') {
    const offset = num(args.offset) ?? 0;
    const width = num(args.width) ?? 1;
    const high = offset + width - 1;
    return high === offset ? `[${offset}]` : `[${high}:${offset}]`;
  }

  const width = args.width ?? args.input_count;
  if (width !== undefined) return `${componentRef}(${width})`;
  return componentRef;
}

interface LogicGateNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function LogicGateNode({ data, selected }: LogicGateNodeProps) {
  const value = data.value ?? false;

  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value: value ? 1 : 0,
  }));

  const renderGateSymbol = () => {
    const getSymbol = () => {
      switch (data.componentRef) {
        case 'And':
          return '&';
        case 'Or':
          return '≥1';
        case 'Not':
          return '¬';
        case 'Nand':
          return '⊼';
        case 'Nor':
          return '⊽';
        case 'Xor':
          return '⊕';
        case 'Xnor':
          return '⊙';
        case 'Buffer':
          return '▷';
        case 'DFlipFlop':
          return 'D';
        case 'Register':
          return 'REG';
        case 'RAM':
          return 'RAM';
        default:
          return formatComponentLabel(data.componentRef, data.arguments);
      }
    };

    const symbol = getSymbol();
    const isSimple = SIMPLE_GATES.has(data.componentRef);

    return (
      <div
        className={`flex items-center justify-center rounded-md bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)] ${
          isSimple
            ? 'h-12 w-12 text-2xl font-bold'
            : 'h-auto w-auto px-3 py-2 text-xs font-semibold'
        }`}
      >
        {symbol}
      </div>
    );
  };

  return (
    <BaseNode
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      selected={selected}
      className="min-w-[60px]"
      showPortLabels={data.showPortLabels}
      onPortClick={data.onPortClick}
      glowUnconnected={data.glowUnconnected}
    >
      <div className="relative flex flex-col items-center gap-1">
        {(data.isComposite || data.hasReference) && <CompositeBadge />}
        <div className="text-xs font-medium text-[var(--embed-text-secondary)]">
          {data.label || data.componentRef}
        </div>
        <div className="flex items-center justify-center">{renderGateSymbol()}</div>
        {(data.isComposite || data.hasReference) && (
          <div className="text-[9px] text-[var(--embed-text-muted)] italic">
            double-click to inspect
          </div>
        )}
      </div>
    </BaseNode>
  );
}

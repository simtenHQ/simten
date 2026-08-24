/**
 * NodeData interface for embed node components.
 * Extracted from packages/ui/src/editor/utils/projection.ts.
 * No store dependencies — all interaction via callbacks.
 */
export interface NodeData extends Record<string, unknown> {
  nodeId: string;
  componentRef: string;
  label?: string;
  value?: boolean;
  numericValue?: number;
  width?: number;
  inputCount: number;
  outputCount: number;
  inputNames: string[];
  outputNames: string[];
  isComposite?: boolean;
  /**
   * Primitive with a gate-level reference build in `MADE_OF` — drillable, but
   * what opens is an explanation rather than its actual implementation.
   * Deliberately separate from `isComposite`, which selects the node type.
   */
  hasReference?: boolean;
  arguments?: Record<string, unknown>;
  __pixels?: number[];
  __consoleText?: string;
  __uartText?: string;
  __nicState?: { txCount: number; rxCount: number; draining: boolean };
  onToggle?: () => void;
  onValueChange?: (value: number) => void;
  onLoadMemory?: (data: Map<number, number>) => void;
  showPortLabels?: boolean;
  onPortClick?: (portName: string, portType: 'input' | 'output') => void;
  glowUnconnected?: boolean;
}

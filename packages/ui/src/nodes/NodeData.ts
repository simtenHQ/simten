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

import { type Edge, type EdgeProps, SmoothStepEdge } from '@xyflow/react';
import type { WireData } from './circuit-to-flow';
import { usePortValue } from './values';

const WIRE_COLORS = {
  TRUE: '#22c55e',
  FALSE: '#94a3b8',
  UNDEFINED: '#cbd5e1',
};

/** A wire, coloured by the value on it: green for anything but 0, grey for 0, pale with none. */
export function WireEdge(props: EdgeProps<Edge<WireData>>) {
  const [source, target] = props.data?.keys ?? [];
  const fromSource = usePortValue(source);
  const fromTarget = usePortValue(target);
  const value = fromSource ?? fromTarget;
  const stroke =
    value === undefined
      ? WIRE_COLORS.UNDEFINED
      : value !== 0
        ? WIRE_COLORS.TRUE
        : WIRE_COLORS.FALSE;
  return <SmoothStepEdge {...props} style={{ ...props.style, stroke }} />;
}

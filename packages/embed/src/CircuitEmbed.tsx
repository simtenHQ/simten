/**
 * CircuitEmbed — embeddable circuit viewer with optional info bar.
 *
 * Thin wrapper around CircuitViewer that adds:
 *   - Auto-harness (wraps bare circuits with Switch/Led nodes)
 *   - Info bar (title, subtitle, description, link)
 *
 * For React users: pass a BuiltCircuit object.
 * For web component users: <circuit-embed code="..."> goes through the
 * web component bridge which sandboxes compilation via an iframe.
 */

import { forwardRef, type CSSProperties, type ForwardedRef, type ReactElement } from "react";
import { CircuitViewer, type CircuitViewerHandle, type HarnessedLayout } from "./CircuitViewer";
import type { BuiltCircuit } from "@simten/core/circuit";

export interface CircuitEmbedProps<C extends BuiltCircuit = BuiltCircuit> {
  /** The circuit to display (result of circuit()) */
  circuit: C;
  /**
   * Container height. Optional — when omitted, the embed sizes itself
   * width-responsively using `aspectRatio` (or one inferred from `layout`)
   * with sensible mobile-friendly min/max clamps.
   */
  height?: number | string;
  /**
   * Width-to-height ratio of the embed. Used only when `height` is not set.
   * If omitted and `layout` is passed, the ratio is computed from the
   * layout's bounding box. Otherwise defaults to 1.5 (3:2).
   */
  aspectRatio?: number;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /**
   * Pre-computed node positions. Keys are constrained to the circuit's
   * input names, output names, and node labels at compile time.
   * Pass to bypass the runtime layout engine.
   */
  layout?: HarnessedLayout<C>;
  /** Theme */
  theme?: "light" | "dark";
  /** Title shown in bottom bar */
  title?: string;
  /** Subtitle shown next to title */
  subtitle?: string;
  /** Description shown below title */
  description?: string;
  /** Link target for the card */
  href?: string;
  /** Focus on specific node(s) */
  focus?: string | string[];
  /** Show port labels on nodes */
  showPortLabels?: boolean;
  /** Callback when a port is clicked */
  onPortClick?: (nodeLabel: string, portName: string, portType: "input" | "output") => void;
  /** Highlight unconnected ports */
  glowUnconnected?: boolean;
  /** Auto-run speed (ms between ticks) */
  autoRunSpeed?: number;
  /** Initial values for input ports (set on harness Switch/Input nodes) */
  initialInputs?: Record<string, number | boolean>;
}

export type CircuitEmbedHandle = CircuitViewerHandle;

// Approximate node footprint used when inferring aspect ratio from a layout.
// Layout coords are top-left of each node, so we add ~one node's width/height
// to the bounding box so the rightmost / bottommost nodes aren't clipped.
const NODE_W = 160;
const NODE_H = 90;

function inferAspectFromLayout(layout: Record<string, { x: number; y: number }> | undefined): number {
  if (!layout) return 1.5; // default 3:2 — sane for auto-laid-out circuits
  const positions = Object.values(layout);
  if (positions.length === 0) return 1.5;
  const w = Math.max(...positions.map(p => p.x)) + NODE_W;
  const h = Math.max(...positions.map(p => p.y)) + NODE_H;
  if (w <= 0 || h <= 0) return 1.5;
  return w / h;
}

const CircuitEmbedImpl = forwardRef<CircuitEmbedHandle, CircuitEmbedProps>(
  function CircuitEmbed({
    circuit,
    height,
    aspectRatio,
    showControls = true,
    layout,
    theme,
    title,
    subtitle,
    description,
    href,
    focus,
    showPortLabels,
    onPortClick,
    glowUnconnected,
    autoRunSpeed = 500,
    initialInputs,
  }, ref) {
    const hasInfoBar = title || description;

    // Sizing strategy: if `height` is set, use it (backwards compat).
    // Otherwise size width-responsively via aspect-ratio with mobile clamps.
    const useResponsive = height === undefined;
    const aspect = aspectRatio ?? inferAspectFromLayout(layout as Record<string, { x: number; y: number }> | undefined);
    const responsiveStyle: CSSProperties = {
      width: '100%',
      aspectRatio: String(aspect),
      minHeight: 240,
      maxHeight: '70vh',
    };

    const outerStyle: CSSProperties | undefined = hasInfoBar
      ? undefined
      : useResponsive
        ? responsiveStyle
        : { height };
    const canvasStyle: CSSProperties = hasInfoBar
      ? useResponsive
        ? responsiveStyle
        : { height }
      : { height: '100%' };

    return (
      <div style={outerStyle} className={`flex flex-col ${hasInfoBar ? 'rounded-xl border border-[var(--embed-border)] overflow-hidden bg-[var(--embed-bg-secondary)]' : ''}`}>
        <div style={canvasStyle} className="min-h-0">
          <CircuitViewer
            ref={ref}
            circuit={circuit}
            height="100%"
            showControls={showControls}
            autoHarness
            initialInputs={initialInputs}
            layout={layout}
            theme={theme}
            focus={focus}
            showPortLabels={showPortLabels}
            onPortClick={onPortClick}
            glowUnconnected={glowUnconnected}
            autoRunSpeed={autoRunSpeed}
          />
        </div>
        {hasInfoBar && (
          <div className="border-t border-[var(--embed-border)] px-4 py-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-[var(--embed-text-primary)]">{title}</div>
              {subtitle && <div className="text-xs text-[var(--embed-text-muted)] font-mono mt-0.5">{subtitle}</div>}
              {description && <div className="text-sm text-[var(--embed-text-secondary)] mt-1.5 leading-relaxed">{description}</div>}
            </div>
            {href && (
              <a href={href} className="shrink-0 px-3 py-1.5 rounded border border-[var(--embed-border)] text-xs text-[var(--embed-text-primary)] hover:opacity-80 transition-colors">
                Open →
              </a>
            )}
          </div>
        )}
      </div>
    );
  }
);

/**
 * CircuitEmbed component with generic inference over the circuit type.
 * Cast preserves the generic so `layout` keys are constrained at compile time.
 */
export const CircuitEmbed = CircuitEmbedImpl as <C extends BuiltCircuit>(
  props: CircuitEmbedProps<C> & { ref?: ForwardedRef<CircuitEmbedHandle> },
) => ReactElement;

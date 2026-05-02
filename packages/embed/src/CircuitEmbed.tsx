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

import { forwardRef, type ForwardedRef, type ReactElement } from "react";
import { CircuitViewer, type CircuitViewerHandle } from "./CircuitViewer";
import type { BuiltCircuit } from "@simten/core/circuit";
import type { CircuitLayout } from "@simten/ui/canvas";

export interface CircuitEmbedProps<C extends BuiltCircuit = BuiltCircuit> {
  /** The circuit to display (result of circuit()) */
  circuit: C;
  /** Container height */
  height?: number | string;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /**
   * Pre-computed node positions. Keys are constrained to the circuit's
   * input names, output names, and node labels at compile time.
   * Pass to bypass the runtime layout engine.
   */
  layout?: CircuitLayout<C>;
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

const CircuitEmbedImpl = forwardRef<CircuitEmbedHandle, CircuitEmbedProps>(
  function CircuitEmbed({
    circuit,
    height = 300,
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

    return (
      <div style={hasInfoBar ? undefined : { height }} className={`flex flex-col ${hasInfoBar ? 'rounded-xl border border-[var(--embed-border)] overflow-hidden bg-[var(--embed-bg-secondary)]' : ''}`}>
        <div style={{ height: hasInfoBar ? height : '100%' }} className="min-h-0">
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
              <div className="text-[13px] font-semibold text-[var(--embed-text-primary)]">{title}</div>
              {subtitle && <div className="text-[11px] text-[var(--embed-text-muted)] font-mono mt-0.5">{subtitle}</div>}
              {description && <div className="text-[11px] text-[var(--embed-text-secondary)] mt-1 leading-relaxed">{description}</div>}
            </div>
            {href && (
              <a href={href} className="shrink-0 px-3 py-1.5 rounded border border-[var(--embed-border)] text-[11px] text-[var(--embed-text-primary)] hover:opacity-80 transition-colors">
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

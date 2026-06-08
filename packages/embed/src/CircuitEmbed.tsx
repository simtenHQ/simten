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

import { forwardRef, useState, type CSSProperties, type ForwardedRef, type ReactElement } from "react";
import { CircuitViewer, type CircuitViewerHandle, type HarnessedLayout } from "./CircuitViewer";
import { circuitToSource, type BuiltCircuit } from "@simten/core/circuit";
import type { FlatPortValueMap } from "@simten/core/simulator";
import { encodeSourceForUrl } from "@simten/ui/share";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@simten/ui/primitives/tooltip";
import { useShareCircuit } from "./share-context";

/**
 * Where Fork links open. simten.dev for everything except local dev of the
 * embed itself (where the embed is mounted at localhost). Detected at runtime
 * because the embed runs on third-party origins we don't control at build time.
 */
function simtenHost(): string {
  if (typeof window === "undefined") return "https://simten.dev";
  return window.location.hostname === "localhost"
    ? window.location.origin
    : "https://simten.dev";
}

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
  /**
   * Custom URL for the card's right-side link. When omitted (the common case),
   * a Fork button is rendered that opens the circuit in the simten.dev editor
   * via `/circuit/<lz-encoded-source>`. Pass `href` only to override.
   */
  href?: string;
  /**
   * Optional raw TypeScript source for the Fork button. When provided, the
   * Fork button encodes this verbatim instead of running the BuiltCircuit
   * through the IR-to-source serializer (which drops comments and helpers).
   * The web-component path passes the user's original `code` here.
   */
  forkSource?: string;
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
  /**
   * Called when the embed's internal simulator settles on a new set of
   * port values — once on first settle, then on every subsequent settled
   * change (e.g. when the user toggles a switch on the canvas). Forwarded
   * verbatim to CircuitViewer; see its docs for full firing semantics.
   *
   * Use this to drive sibling UI (truth-table highlights, external value
   * readouts) without giving up the embed's chrome. The callback is
   * ref-stabilized inside the embed, so inline functions are safe.
   */
  onPortValuesChange?: (portValues: FlatPortValueMap) => void;
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

/**
 * The Fork action, rendered in two placements (floating corner when there's no
 * info bar, inline in the info bar otherwise). One component so the onFork /
 * error / tooltip logic lives in a single place. Uses the shared shadcn tooltip
 * (same one ClockControls uses) instead of the native `title` attribute.
 */
function ForkButton({
  onFork,
  forkError,
  forkPending,
  className,
  tooltipSide = "top",
}: {
  onFork: () => void;
  forkError: string | null;
  forkPending: boolean;
  className: string;
  tooltipSide?: "top" | "bottom";
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onFork} className={`cursor-pointer ${className}`}>
            {forkError ? "Fork failed" : forkPending ? "Forking…" : "Fork →"}
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          {forkError ?? "Open and modify this circuit in the Simten editor"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
    forkSource,
    onPortValuesChange,
  }, ref) {
    const hasInfoBar = title || description;
    const [forkError, setForkError] = useState<string | null>(null);
    const [forkPending, setForkPending] = useState(false);
    const shareCircuit = useShareCircuit();

    const onFork = async () => {
      if (forkPending) return;
      try {
        const source = forkSource ?? circuitToSource(circuit);
        // Use the KV shortener when available (simten.dev). Outside simten.dev
        // — embeds on third-party pages — fall back to the inline-encoded URL.
        if (shareCircuit) {
          setForkPending(true);
          const { hash } = await shareCircuit(source);
          window.open(`${simtenHost()}/circuit/s/${hash}`, "_blank", "noopener");
        } else {
          const encoded = encodeSourceForUrl(source);
          window.open(`${simtenHost()}/circuit/${encoded}`, "_blank", "noopener");
        }
      } catch (err) {
        setForkError(err instanceof Error ? err.message : "Couldn't fork this circuit");
        setTimeout(() => setForkError(null), 3000);
      } finally {
        setForkPending(false);
      }
    };

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
      <div style={outerStyle} className={`relative flex flex-col ${hasInfoBar ? 'rounded-xl border border-[var(--embed-border)] overflow-hidden bg-[var(--embed-bg-secondary)]' : ''}`}>
        {!hasInfoBar && !href && (
          <ForkButton
            onFork={onFork}
            forkError={forkError}
            forkPending={forkPending}
            tooltipSide="bottom"
            className="absolute top-2 right-2 z-10 hidden md:flex items-center px-2.5 py-1 rounded border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] text-[11px] text-[var(--embed-text-primary)] hover:opacity-80 transition-colors shadow-sm"
          />
        )}
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
            onPortValuesChange={onPortValuesChange}
          />
        </div>
        {hasInfoBar && (
          <div className="border-t border-[var(--embed-border)] px-4 py-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-[var(--embed-text-primary)]">{title}</div>
              {subtitle && <div className="text-xs text-[var(--embed-text-muted)] font-mono mt-0.5">{subtitle}</div>}
              {description && <div className="text-sm text-[var(--embed-text-secondary)] mt-1.5 leading-relaxed">{description}</div>}
            </div>
            {href ? (
              <a href={href} className="shrink-0 px-3 py-1.5 rounded border border-[var(--embed-border)] text-xs text-[var(--embed-text-primary)] hover:opacity-80 transition-colors">
                Open →
              </a>
            ) : (
              <ForkButton
                onFork={onFork}
                forkError={forkError}
                forkPending={forkPending}
                tooltipSide="top"
                className="hidden md:flex items-center shrink-0 px-3 py-1.5 rounded border border-[var(--embed-border)] text-xs text-[var(--embed-text-primary)] hover:opacity-80 transition-colors"
              />
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

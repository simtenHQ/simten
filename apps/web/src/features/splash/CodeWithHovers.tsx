/**
 * CodeWithHovers — sugar-high–tokenised code rendered as proper React
 * JSX, with VS Code–style hover popups (Radix Tooltip) on a small
 * dictionary of known identifiers.
 *
 * Why proper JSX instead of post-processing HighlightedCode's HTML:
 *   the previous version attached mouseenter/mouseleave handlers to
 *   spans inside HighlightedCode's dangerouslySetInnerHTML output, which
 *   ended up clunky (popups not dismissing reliably when the cursor
 *   crossed gaps, no focus/ESC handling, sometimes sticking). Using
 *   Radix Tooltip directly hands all of that lifecycle to Radix.
 *
 * Tokenisation: sugar-high exposes `tokenize(code)` which returns
 *   Array<[typeId, text]> — we map each token to a styled <span> and
 *   wrap identifiers that match HOVER_DICT in a Radix Tooltip. The
 *   typeId → CSS-var-color map is hardcoded against sugar-high 1.1.0's
 *   TokenTypes ordering (identifier=0, keyword=1, string=2, class=3,
 *   property=4, entity=5, jsxliterals=6, sign=7, comment=8, break=9,
 *   space=10) — see node_modules/sugar-high/lib/index.js if it changes.
 *
 * Theme: same --sh-* CSS variables HighlightedCode uses (set on a
 *   wrapper class string) so light/dark themes pick up the right
 *   GitHub palette automatically.
 */

import { useMemo } from "react";
import { tokenize } from "sugar-high";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type HoverEntry = {
  /** Mono-styled top line — a short signature or type form. */
  signature?: string;
  /** Plain-text description below. One sentence. */
  description: string;
};

// Tooltip dictionary. Signatures match the real types defined in
// packages/core/src/circuit/types.ts so what readers see here lines up
// with what Monaco shows on /circuit when they hover the same word.
// Keep these in sync if the public CircuitConfig API changes.
const HOVER_DICT: Record<string, HoverEntry> = {
  circuit: {
    signature: "circuit(name, config): BuiltCircuit",
    description:
      "Defines a reusable hardware component. The returned BuiltCircuit can be used as a node inside other circuits.",
  },
  inputs: {
    signature: "inputs?: Record<string, PortType>",
    description:
      "Input ports — a map of port names to types (bit, bus(n)). Port names autocomplete in connect.",
  },
  outputs: {
    signature: "outputs?: Record<string, PortType>",
    description: "Output ports — same shape as inputs.",
  },
  nodes: {
    signature: "nodes?: Record<string, BuiltCircuit>",
    description:
      "Sub-components used inside this circuit. Map a local name to a BuiltCircuit, then wire them in connect.",
  },
  connect: {
    signature: "connect?: (arg) => ConnectionDef[]",
    description:
      "Wires sub-nodes and ports together. Receives { inputs, outputs, nodes } and returns connections built via port.to(...).",
  },
  bit: {
    signature: "const bit: PortType",
    description:
      "A single-bit signal type. Use bus(N) for multi-bit, or pass a raw number N as shorthand.",
  },
  Xor: {
    signature: "const Xor: BuiltCircuit",
    description:
      "Built-in XOR gate. Output is 1 when exactly one input is 1.",
  },
  And: {
    signature: "const And: BuiltCircuit",
    description: "Built-in AND gate. Output is 1 when both inputs are 1.",
  },
  Or: {
    signature: "const Or: BuiltCircuit",
    description:
      "Built-in OR gate. Output is 1 when either input is 1.",
  },
  to: {
    signature: "port.to(...targets: PortRef[]): ConnectionDef",
    description:
      "Wires this port to one or more target node ports. Used inside connect.",
  },
};

// sugar-high typeId → CSS variable. Order matches TokenTypes in
// sugar-high/lib/index.js (1.1.0). Whitespace / break tokens have no
// color override (use inherited).
const TYPE_TO_COLOR: Record<number, string | undefined> = {
  0: "var(--sh-identifier)",
  1: "var(--sh-keyword)",
  2: "var(--sh-string)",
  3: "var(--sh-class)",
  4: "var(--sh-property)",
  5: "var(--sh-entity)",
  6: "var(--sh-jsxliterals)",
  7: "var(--sh-sign)",
  8: "var(--sh-comment)",
  9: undefined,
  10: undefined,
};

// GitHub light/dark palette as Tailwind arbitrary CSS properties —
// identical to HighlightedCode so themes match across both renderers.
const SH_THEME_CLASSES = [
  "[--sh-keyword:#d73a49]",
  "[--sh-identifier:#24292e]",
  "[--sh-string:#032f62]",
  "[--sh-class:#005cc5]",
  "[--sh-property:#6f42c1]",
  "[--sh-entity:#6f42c1]",
  "[--sh-jsxliterals:#005cc5]",
  "[--sh-sign:#586069]",
  "[--sh-comment:#6a737d]",
  "dark:[--sh-keyword:#ff7b72]",
  "dark:[--sh-identifier:#c9d1d9]",
  "dark:[--sh-string:#a5d6ff]",
  "dark:[--sh-class:#79c0ff]",
  "dark:[--sh-property:#d2a8ff]",
  "dark:[--sh-entity:#d2a8ff]",
  "dark:[--sh-jsxliterals:#79c0ff]",
  "dark:[--sh-sign:#8b949e]",
  "dark:[--sh-comment:#6a9955]",
].join(" ");

interface CodeWithHoversProps {
  code: string;
  className?: string;
  /**
   * When false, renders the code with full highlighting but without any
   * hover tooltips. Used during the typewriter phase to avoid attaching
   * Radix listeners to spans that are about to be re-rendered.
   */
  enabled?: boolean;
}

export function CodeWithHovers({
  code,
  className,
  enabled = true,
}: CodeWithHoversProps) {
  const tokens = useMemo(() => tokenize(code), [code]);

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <pre className={cn(SH_THEME_CLASSES, className)}>
        <code>
          {tokens.map(([type, text], i) => {
            const color = TYPE_TO_COLOR[type];
            // Hoverable purely on text match — the dictionary is the
            // source of truth, regardless of how sugar-high classified
            // the token (so capitalised gates like `Xor` / `And` which
            // come back as `class`, and methods like `to` which come
            // back as `property`, are all reachable).
            const hoverable = enabled && text in HOVER_DICT;
            const style = color ? { color } : undefined;

            if (!hoverable) {
              return (
                <span key={i} style={style}>
                  {text}
                </span>
              );
            }

            const entry = HOVER_DICT[text]!;
            return (
              <TooltipPrimitive.Root key={i}>
                <TooltipPrimitive.Trigger asChild>
                  <span
                    style={style}
                    className="cursor-help underline decoration-dotted decoration-[var(--sh-comment)] underline-offset-[3px]"
                  >
                    {text}
                  </span>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="bottom"
                    sideOffset={6}
                    className="z-50 max-w-xs border bg-[#f3f3f3] border-[#c8c8c8] text-[#1e1e1e] dark:bg-[#1e1e1e] dark:border-[#454545] dark:text-[#cccccc] px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  >
                    {entry.signature && (
                      <div className="font-mono text-[12px] leading-tight text-[#001080] dark:text-[#9cdcfe]">
                        {entry.signature}
                      </div>
                    )}
                    <div className="mt-1.5 text-[12px] leading-snug">
                      {entry.description}
                    </div>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            );
          })}
        </code>
      </pre>
    </TooltipPrimitive.Provider>
  );
}

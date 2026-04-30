/**
 * HighlightedCode — shared TypeScript syntax-highlighted code block.
 *
 * Uses sugar-high, a ~1KB JS/TS tokenizer. Ships two palettes
 * (GitHub-light and GitHub-dark) via Tailwind arbitrary CSS properties
 * so both themes stay readable.
 */

import type { ReactNode } from "react";
import { highlight } from "sugar-high";

// sugar-high is driven by CSS custom properties (--sh-*). Both palettes
// below are exposed as arbitrary-property Tailwind classes — the `dark:`
// variants kick in under class-based dark mode.
const SH_THEME_CLASSES = [
  // Light mode — GitHub-light
  "[--sh-keyword:#d73a49]",
  "[--sh-identifier:#24292e]",
  "[--sh-string:#032f62]",
  "[--sh-class:#005cc5]",
  "[--sh-property:#6f42c1]",
  "[--sh-entity:#6f42c1]",
  "[--sh-jsxliterals:#005cc5]",
  "[--sh-sign:#586069]",
  "[--sh-comment:#6a737d]",
  // Dark mode — GitHub-dark
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

export interface HighlightedCodeProps {
  code: string;
  className?: string;
  /**
   * Optional JSX appended after the highlighted code inside the <pre>.
   * Used e.g. for a blinking cursor during a typewriter animation.
   */
  trailing?: ReactNode;
}

export function HighlightedCode({ code, className, trailing }: HighlightedCodeProps) {
  const html = highlight(code);
  return (
    <pre className={`${SH_THEME_CLASSES} ${className ?? ""}`}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
      {trailing}
    </pre>
  );
}

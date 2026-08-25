/**
 * Simten logo variants.
 *
 * To swap the active logo, change which one is exported as `Logo` at the bottom.
 * All variants:
 *   - 32×32 viewBox, scalable via the `size` prop
 *   - Use `currentColor` so they inherit foreground via CSS / parent text color
 *   - Single-mark, no text, meant to be paired with the wordmark separately
 *   - Designed to read at 16×16 (favicon scale)
 */

interface LogoProps {
  size?: number;
  className?: string;
}

// ──────────────────────────────────────────────────────────
// A) NAND gate: universal symbol of digital logic.
//    D-shape body with a negation bubble on the output.
//    Reads as "we do digital." Filled body gives it weight.
// ──────────────────────────────────────────────────────────
export function LogoNand({ size = 28, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      {/* D-shape NAND body */}
      <path d="M5 6 L5 26 L15 26 A10 10 0 0 0 15 6 Z" fill="currentColor" />
      {/* Input lines */}
      <line
        x1="2"
        y1="11"
        x2="5"
        y2="11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="21"
        x2="5"
        y2="21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Negation bubble */}
      <circle cx="27" cy="16" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Output line */}
      <line
        x1="29.2"
        y1="16"
        x2="31"
        y2="16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// B) Orthogonal trace: two nodes connected by a right-angle wire.
//    Echoes the visual language of the actual circuits (orthogonal
//    edge routing). Reads as "graph / circuit topology."
// ──────────────────────────────────────────────────────────
export function LogoTrace({ size = 28, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      {/* Orthogonal wire path */}
      <path
        d="M7 8 L7 16 L25 16 L25 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="miter"
        strokeLinecap="square"
        fill="none"
      />
      {/* Source node */}
      <circle cx="7" cy="8" r="3.5" fill="currentColor" />
      {/* Target node */}
      <circle cx="25" cy="24" r="3.5" fill="currentColor" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// C) Square wave: a clock signal. Universal hardware/timing icon.
//    Stark, recognizable, no ambiguity about the domain.
// ──────────────────────────────────────────────────────────
export function LogoSquareWave({ size = 28, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M2 22 L8 22 L8 10 L16 10 L16 22 L24 22 L24 10 L30 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="miter"
        strokeLinecap="butt"
        fill="none"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// D) Hex die: hexagonal chip die outline with a centred port.
//    Hexagons are tech-canonical (Cloudflare, Linear, Hex).
//    The inner dot suggests a CPU core / central node.
// ──────────────────────────────────────────────────────────
export function LogoHex({ size = 28, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <polygon
        points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// E) SIM wordmark: one continuous square-wave trace that forms S, I, M.
//    Single SVG path, never lifts, only horizontal/vertical strokes,
//    only 90° corners. The letters emerge from the path's shape; S is
//    the rectangular zigzag, I is a tall narrow pulse, M is two pulses
//    sharing a valley. All drawn as one wave moving left to right.
//
//    Wider than the icon variants (~2.5:1). Use a larger `size`,
//    for header use try `size={32}` or higher; the SVG will scale.
// ──────────────────────────────────────────────────────────
export function LogoSimWordmark({ size = 32, className }: LogoProps) {
  // viewBox is 80×32 (~2.5:1 wordmark proportions)
  return (
    <svg width={size * 2.5} height={size} viewBox="0 0 80 32" fill="none" className={className}>
      {/* ONE continuous square-wave path traversing left-to-right.
          Reads as S then I then M as the wave rises and falls.
          No serifs, no separate strokes, no curves; every joint is 90°. */}
      <path
        d="
          M 0 28
          L 2 28   L 2 6    L 18 6   L 18 16  L 2 16   L 2 26   L 20 26  L 20 28
          L 26 28  L 26 6   L 32 6   L 32 28
          L 38 28  L 38 6   L 44 6   L 44 14  L 52 14  L 52 6   L 60 6   L 60 28
          L 80 28
        "
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// F) sim10 wordmark: hand-drawn waveform from Excalidraw, themed.
//    The brand "simten" rendered as "sim10" so it reads as both a
//    decimal ten and a binary nod. Sketchy/hand-drawn aesthetic with
//    every stroke doubled (Excalidraw's signature look).
//    Uses currentColor so it follows the host's text color.
//
//    Aspect ratio ~1.37:1 (wider than tall). `size` controls height;
//    width is computed automatically.
// ──────────────────────────────────────────────────────────
export function LogoSim10({ size = 32, className }: LogoProps) {
  // Cropped viewBox: tightens around the actual wave content (which lives at
  // x=10..33.75, y=10..25.69 in the original Excalidraw export). Strips the
  // surrounding padding so the logo doesn't have giant whitespace when placed
  // next to a wordmark. Background rect from the export is dropped; stroke
  // uses currentColor so the mark follows the host's text color (theme-aware).
  return (
    <svg width={size * 1.4} height={size} viewBox="8 8 28 20" fill="none" className={className}>
      <g transform="translate(10 25.694) rotate(0 11.873 -7.845)">
        <path
          d="M0 0 C1.18 -0.01, 2.35 -0.02, 5.8 -0.06 M0 0 C1.61 -0.02, 3.22 -0.03, 5.8 -0.06 M5.8 -0.06 C5.74 -3.55, 5.69 -7.05, 5.55 -15.47 M5.8 -0.06 C5.71 -5.37, 5.63 -10.69, 5.55 -15.47 M5.55 -15.47 C7.29 -15.52, 9.04 -15.56, 10.89 -15.61 M5.55 -15.47 C7.33 -15.52, 9.11 -15.56, 10.89 -15.61 M10.89 -15.61 C11.01 -10.54, 11.14 -5.48, 11.27 -0.05 M10.89 -15.61 C10.98 -11.9, 11.07 -8.18, 11.27 -0.05 M11.27 -0.05 C12.44 -0.1, 13.62 -0.15, 14.43 -0.19 M11.27 -0.05 C12.44 -0.1, 13.6 -0.15, 14.43 -0.19 M14.43 -0.19 C14.5 -5.45, 14.56 -10.71, 14.61 -15.56 M14.43 -0.19 C14.5 -5.98, 14.57 -11.77, 14.61 -15.56 M14.61 -15.56 C15.28 -15.6, 15.95 -15.64, 16.44 -15.67 M14.61 -15.56 C14.99 -15.58, 15.37 -15.6, 16.44 -15.67 M16.44 -15.67 C16.45 -12.31, 16.46 -8.95, 16.48 -0.15 M16.44 -15.67 C16.46 -10.45, 16.47 -5.22, 16.48 -0.15 M16.48 -0.15 C16.84 -0.14, 17.2 -0.12, 18.01 -0.08 M16.48 -0.15 C16.95 -0.13, 17.42 -0.11, 18.01 -0.08 M18.01 -0.08 C18.06 -5.22, 18.11 -10.35, 18.17 -15.61 M18.01 -0.08 C18.07 -5.97, 18.13 -11.85, 18.17 -15.61 M18.17 -15.61 C18.75 -15.64, 19.32 -15.66, 20.13 -15.69 M18.17 -15.61 C18.67 -15.63, 19.18 -15.66, 20.13 -15.69 M20.13 -15.69 C20.17 -12.42, 20.2 -9.15, 20.3 0 M20.13 -15.69 C20.19 -10.25, 20.25 -4.81, 20.3 0 M20.3 0 C21.52 0, 22.73 0, 23.75 0 M20.3 0 C21.27 0, 22.23 0, 23.75 0"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// G) Sim10 favicon mark: square, single-stroke variant of the full wordmark.
//    Same hand-drawn "sim10" path as LogoSim10, but:
//      - Drop Excalidraw's doubled strokes (every line drawn twice in the
//        wordmark; at favicon sizes the duplicates blur into mush, so single
//        renders cleaner without losing the wobble)
//      - Bump strokeWidth from 1 to 2.5 (so it survives 16x16)
//      - Center in a 32x32 square viewBox
//    Used in apps/web/public/favicon.svg, the static file the browser
//    actually fetches. Keep the React variant and the static SVG in sync.
// ──────────────────────────────────────────────────────────
export function LogoSim10Mark({ size = 32, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <g transform="translate(1 26) scale(1.26)">
        <path
          d="M0 0 C1.18 -0.01, 2.35 -0.02, 5.8 -0.06 M5.8 -0.06 C5.74 -3.55, 5.69 -7.05, 5.55 -15.47 M5.55 -15.47 C7.29 -15.52, 9.04 -15.56, 10.89 -15.61 M10.89 -15.61 C11.01 -10.54, 11.14 -5.48, 11.27 -0.05 M11.27 -0.05 C12.44 -0.1, 13.62 -0.15, 14.43 -0.19 M14.43 -0.19 C14.5 -5.45, 14.56 -10.71, 14.61 -15.56 M14.61 -15.56 C15.28 -15.6, 15.95 -15.64, 16.44 -15.67 M16.44 -15.67 C16.45 -12.31, 16.46 -8.95, 16.48 -0.15 M16.48 -0.15 C16.84 -0.14, 17.2 -0.12, 18.01 -0.08 M18.01 -0.08 C18.06 -5.22, 18.11 -10.35, 18.17 -15.61 M18.17 -15.61 C18.75 -15.64, 19.32 -15.66, 20.13 -15.69 M20.13 -15.69 C20.17 -12.42, 20.2 -9.15, 20.3 0 M20.3 0 C21.52 0, 22.73 0, 23.75 0"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// Original: kept for reference / fallback. Friendly mascot face.
// ──────────────────────────────────────────────────────────
export function LogoOriginal({ size = 28, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M4 4 L28 16 L4 28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="13" r="1.5" fill="currentColor" />
      <path
        d="M16 12.5 Q17.5 14 19 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 19 Q15 22 19 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// Active export: swap which variant is `Logo` to preview different marks.
// Options:
//   LogoNand · LogoTrace · LogoSquareWave · LogoHex
//   LogoSimWordmark - 2.5:1 ortho-stroke wordmark (S/I/M)
//   LogoSim10       - hand-drawn waveform "sim10" (~1.37:1, header use)
//   LogoSim10Mark   - square favicon variant of LogoSim10 (mirrored in public/favicon.svg)
//   LogoOriginal    - friendly triangle mascot
// ──────────────────────────────────────────────────────────
export const Logo = LogoSim10;

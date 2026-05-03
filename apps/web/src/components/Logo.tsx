/**
 * Simten logo — variants.
 *
 * To swap the active logo, change which one is exported as `Logo` at the bottom.
 * All variants:
 *   - 32×32 viewBox, scalable via the `size` prop
 *   - Use `currentColor` so they inherit foreground via CSS / parent text color
 *   - Single-mark, no text — meant to be paired with the wordmark separately
 *   - Designed to read at 16×16 (favicon scale)
 */

interface LogoProps {
  size?: number;
  className?: string;
}

// ──────────────────────────────────────────────────────────
// A) NAND gate — universal symbol of digital logic.
//    D-shape body with a negation bubble on the output.
//    Reads as "we do digital." Filled body gives it weight.
// ──────────────────────────────────────────────────────────
export function LogoNand({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
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
      <circle
        cx="27"
        cy="16"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
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
// B) Orthogonal trace — two nodes connected by a right-angle wire.
//    Echoes the visual language of the actual circuits (orthogonal
//    edge routing). Reads as "graph / circuit topology."
// ──────────────────────────────────────────────────────────
export function LogoTrace({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
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
// C) Square wave — a clock signal. Universal hardware/timing icon.
//    Stark, recognizable, no ambiguity about the domain.
// ──────────────────────────────────────────────────────────
export function LogoSquareWave({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
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
// D) Hex die — hexagonal chip die outline with a centred port.
//    Hexagons are tech-canonical (Cloudflare, Linear, Hex).
//    The inner dot suggests a CPU core / central node.
// ──────────────────────────────────────────────────────────
export function LogoHex({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
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
// E) SIM wordmark — one continuous square-wave trace that forms S, I, M.
//    Single SVG path, never lifts, only horizontal/vertical strokes,
//    only 90° corners. The letters emerge from the path's shape — S is
//    the rectangular zigzag, I is a tall narrow pulse, M is two pulses
//    sharing a valley. All drawn as one wave moving left to right.
//
//    Wider than the icon variants (~2.5:1). Use a larger `size` —
//    for header use try `size={32}` or higher; the SVG will scale.
// ──────────────────────────────────────────────────────────
export function LogoSimWordmark({ size = 32, className }: LogoProps) {
  // viewBox is 80×32 (~2.5:1 wordmark proportions)
  return (
    <svg
      width={size * 2.5}
      height={size}
      viewBox="0 0 80 32"
      fill="none"
      className={className}
    >
      {/* ONE continuous square-wave path traversing left-to-right.
          Reads as S then I then M as the wave rises and falls.
          No serifs, no separate strokes, no curves — every joint is 90°. */}
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
// F) sim10 wordmark — hand-drawn waveform from Excalidraw, themed.
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
  // x=10..38.94, y=10..25.32 in the original Excalidraw export). Strips ~10
  // units of padding off each side so the logo doesn't have giant whitespace
  // when placed next to a wordmark.
  return (
    <svg
      width={size * 1.65}
      height={size}
      viewBox="8 8 33 20"
      fill="none"
      className={className}
    >
      <g transform="translate(10 25.32) rotate(0 14.47 -7.41)">
        <path
          d="M0 0 C1.04 0, 2.07 -0.01, 5.1 -0.01 M0 0 C1.42 0, 2.83 -0.01, 5.1 -0.01 M5.1 -0.01 C5.19 -3.43, 5.27 -6.86, 5.48 -15.1 M5.1 -0.01 C5.23 -5.22, 5.36 -10.42, 5.48 -15.1 M5.48 -15.1 C6.69 -15.08, 7.89 -15.06, 9.16 -15.03 M5.48 -15.1 C6.71 -15.08, 7.93 -15.06, 9.16 -15.03 M9.16 -15.03 C9.27 -10.05, 9.39 -5.07, 9.5 0.26 M9.16 -15.03 C9.24 -11.38, 9.33 -7.73, 9.5 0.26 M9.5 0.26 C10.66 0.35, 11.82 0.44, 12.63 0.5 M9.5 0.26 C10.66 0.35, 11.81 0.44, 12.63 0.5 M12.63 0.5 C12.71 -4.89, 12.78 -10.28, 12.85 -15.25 M12.63 0.5 C12.71 -5.43, 12.79 -11.36, 12.85 -15.25 M12.85 -15.25 C14.01 -15.27, 15.16 -15.3, 16.02 -15.32 M12.85 -15.25 C13.51 -15.26, 14.17 -15.28, 16.02 -15.32 M16.02 -15.32 C16.06 -11.94, 16.11 -8.57, 16.24 0.28 M16.02 -15.32 C16.09 -10.07, 16.16 -4.82, 16.24 0.28 M16.24 0.28 C16.96 0.3, 17.68 0.33, 19.3 0.38 M16.24 0.28 C17.18 0.31, 18.12 0.34, 19.3 0.38 M19.3 0.38 C19.27 -4.77, 19.24 -9.91, 19.21 -15.19 M19.3 0.38 C19.27 -5.52, 19.24 -11.42, 19.21 -15.19 M19.21 -15.19 C20.17 -15.13, 21.14 -15.07, 22.47 -14.99 M19.21 -15.19 C20.05 -15.14, 20.9 -15.09, 22.47 -14.99 M22.47 -14.99 C22.55 -11.82, 22.62 -8.65, 22.83 0.22 M22.47 -14.99 C22.6 -9.72, 22.72 -4.45, 22.83 0.22 M22.83 0.22 C24.99 0.21, 27.14 0.21, 28.94 0.21 M22.83 0.22 C24.54 0.22, 26.25 0.21, 28.94 0.21"
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
// Original — kept for reference / fallback. Friendly mascot face.
// ──────────────────────────────────────────────────────────
export function LogoOriginal({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
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
// Active export — swap which variant is `Logo` to preview different marks.
// Options:
//   LogoNand · LogoTrace · LogoSquareWave · LogoHex
//   LogoSimWordmark — 2.5:1 ortho-stroke wordmark (S/I/M)
//   LogoSim10       — hand-drawn waveform "sim10" (~1.37:1)
//   LogoOriginal    — friendly triangle mascot
// ──────────────────────────────────────────────────────────
export const Logo = LogoSim10;

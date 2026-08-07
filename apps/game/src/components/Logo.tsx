/**
 * The Simten mark.
 *
 * Copied verbatim from `apps/web/src/components/Logo.tsx` (`LogoSim10`) so the
 * two apps render an identical brand. Deliberately duplicated rather than
 * shared: `@simten/ui` is a published package, and putting a first-party
 * wordmark in it would make brand art permanent public API for the benefit of
 * two apps we control.
 *
 * If the mark ever changes it has to change in three places — here, `apps/web`,
 * and the static `favicon.svg` in both `public/` directories, which the browser
 * fetches directly and cannot import from React.
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 26, className }: LogoProps) {
  // Cropped viewBox: tightens around the actual wave content so the mark does
  // not carry a margin of empty space when set beside the wordmark. Stroke uses
  // currentColor, so it follows the host's text colour and is theme-aware.
  return (
    <svg
      width={size * 1.4}
      height={size}
      viewBox="8 8 28 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
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

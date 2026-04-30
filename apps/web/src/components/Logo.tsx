export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      {/* Triangle body */}
      <path
        d="M4 4 L28 16 L4 28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Left eye */}
      <circle cx="11" cy="13" r="1.5" fill="currentColor" />
      {/* Right eye — winking */}
      <path
        d="M16 12.5 Q17.5 14 19 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Smirk */}
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

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../primitives/tooltip';

/**
 * Badge shown on composite nodes indicating they can be drilled into.
 * Renders in the top-right corner with a magnifying glass and pulse ring.
 */
export function CompositeBadge() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center cursor-pointer group">
            {/* Pulse ring — slow, subtle */}
            <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
            {/* Solid badge */}
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 group-hover:bg-blue-400 transition-colors shadow-sm shadow-blue-500/30">
              {/* Magnifying glass SVG */}
              <svg
                className="h-3 w-3 text-white"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14" y2="14" />
              </svg>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Double-click to inspect
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

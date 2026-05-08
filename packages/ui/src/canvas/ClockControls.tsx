/**
 * Unified ClockControls — one design, used everywhere.
 *
 * Icon buttons (Step, Play/Pause, Reset) + cycle counter + time-travel.
 * Optional: speed slider, scrubber.
 * Floating style — position via parent container.
 */

"use client";

import type { ComponentType, SVGProps } from "react";
import {
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../primitives/tooltip";
import { Button } from "../primitives/button";

/**
 * Dense icon button used throughout this toolbar. Wraps shadcn `Button`
 * with `ghost` + `icon` variants but tightens the size for the embed bar,
 * and bakes in the Tooltip so each call site is a one-liner. The `label`
 * doubles as `aria-label` and visible tooltip content.
 */
function IconBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="h-7 w-7 text-muted-foreground disabled:opacity-40 [&_svg]:size-3.5"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export interface ClockControlsProps {
  cycle: number;
  historyLength: number;
  historyIndex: number;
  isRunning: boolean;
  isViewingPast: boolean;
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek?: (index: number) => void;
  onSpeedChange?: (speed: number) => void;
  speed?: number;
  maxSpeed?: number;
  showScrubber?: boolean;
  /** Render as a floating pill (inspector/canvas overlay) vs inline bar (editor/embed bottom bar) */
  floating?: boolean;
}

export function ClockControls({
  cycle,
  historyLength,
  historyIndex,
  isRunning,
  isViewingPast,
  onStep,
  onRun,
  onPause,
  onReset,
  onStepBack,
  onStepForward,
  onSeek,
  onSpeedChange,
  speed = 1,
  maxSpeed = 100,
  showScrubber,
  floating,
}: ClockControlsProps) {
  const wrapper = floating
    ? "absolute top-3 left-1/2 -translate-x-1/2 z-10"
    : "";

  return (
    <TooltipProvider>
      <div className={wrapper}>
        <div className="flex items-center gap-1.5 border-t border-border bg-card/95 px-3 py-1.5">
          <IconBtn label="Tick" icon={SkipForward} onClick={onStep} disabled={isRunning || isViewingPast} />
          {isRunning
            ? <IconBtn label="Pause" icon={Pause} onClick={onPause} />
            : <IconBtn label="Run"   icon={Play}  onClick={onRun} disabled={isViewingPast} />}
          <IconBtn label="Reset" icon={RotateCcw} onClick={onReset} />

          {/* Speed slider */}
          {onSpeedChange && (
            <div className="flex items-center gap-2 border-l border-border pl-2 ml-0.5">
              <input
                type="range"
                min="1"
                max={maxSpeed}
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="w-20 h-1 rounded-lg appearance-none cursor-pointer accent-blue-600"
                disabled={isViewingPast}
                aria-label="Simulation speed"
              />
              <span className="min-w-[45px] text-[10px] text-muted-foreground font-mono tabular-nums">
                {speed} t/s
              </span>
            </div>
          )}

          {/* Cycle counter */}
          <div className="border-l border-border pl-1.5 ml-0.5">
            <span className="text-[11px] text-muted-foreground">
              Cycle <span className="font-mono font-semibold text-foreground">{cycle}</span>
            </span>
          </div>

          {/* Time-travel */}
          {historyLength > 1 && (
            <div className="flex items-center gap-0.5 border-l border-border pl-1.5 ml-0.5">
              <IconBtn label="Step back" icon={ChevronLeft} onClick={onStepBack} disabled={historyIndex <= 0 || isRunning} />

              <span className="min-w-[40px] text-center text-[11px] text-muted-foreground">
                {isViewingPast ? (
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {historyIndex + 1}/{historyLength}
                  </span>
                ) : (
                  <span className="font-mono">
                    {historyLength}/{historyLength}
                  </span>
                )}
              </span>

              <IconBtn label="Step forward" icon={ChevronRight} onClick={onStepForward} disabled={!isViewingPast || isRunning} />
            </div>
          )}

          {/* Scrubber */}
          {showScrubber && onSeek && historyLength > 1 && (
            <div className="border-l border-border pl-1.5 ml-0.5">
              <input
                type="range"
                min="0"
                max={historyLength - 1}
                value={historyIndex}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="w-24 h-1 rounded-lg appearance-none cursor-pointer accent-blue-600"
                disabled={isRunning}
                aria-label="Cycle scrubber"
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

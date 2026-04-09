/**
 * Unified ClockControls — one design, used everywhere.
 *
 * Icon buttons (Step, Play/Pause, Reset) + cycle counter + time-travel.
 * Optional: speed slider, scrubber.
 * Floating style — position via parent container.
 */

"use client";

import {
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../primitives/tooltip";

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

  const btn = "rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40";

  return (
    <TooltipProvider>
      <div className={wrapper}>
        <div className="flex items-center gap-1.5 border-t border-border bg-card/95 px-3 py-1.5">
          {/* Step */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onStep} disabled={isRunning || isViewingPast} className={btn}>
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Tick</TooltipContent>
          </Tooltip>

          {/* Play / Pause */}
          {isRunning ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onPause} className={btn}>
                  <Pause className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Pause</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onRun} disabled={isViewingPast} className={btn}>
                  <Play className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Run</TooltipContent>
            </Tooltip>
          )}

          {/* Reset */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onReset} className={btn}>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset</TooltipContent>
          </Tooltip>

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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onStepBack} disabled={historyIndex <= 0 || isRunning} className={btn}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Step back</TooltipContent>
              </Tooltip>

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

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onStepForward} disabled={!isViewingPast || isRunning} className={btn}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Step forward</TooltipContent>
              </Tooltip>
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
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

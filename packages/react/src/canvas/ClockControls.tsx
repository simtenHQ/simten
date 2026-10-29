/**
 * ClockControls: the clock of a simulation.
 *
 *   const sim = useSimulation(Counter);
 *   <ClockControls simulation={sim} />
 *
 * Icon buttons (Tick, Run/Pause, Reset), the cycle counter and time travel,
 * plus an optional speed slider and history scrubber. A combinational circuit
 * has no clock, so for one it renders nothing: render it next to the canvas
 * and it does the right thing for any circuit.
 */

'use client';

import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  History,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { type ComponentType, type ReactElement, type SVGProps, useState } from 'react';
import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../primitives/tooltip';
import type { UseSimulationResult } from '../sandbox/useSimulation';

/**
 * Dense icon button used throughout this toolbar. Wraps shadcn `Button`
 * with `ghost` + `icon` variants but tightens the size for the embed bar,
 * and bakes in the Tooltip so each call site is a one-liner. The `label`
 * doubles as `aria-label` and visible tooltip content.
 */
/** A small ghost icon button: shadcn's ghost/icon button, tightened for this bar. */
const ICON_BUTTON =
  'inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 w-7 text-muted-foreground disabled:opacity-40 [&_svg]:size-3.5';

function IconBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  pulse,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  disabled?: boolean;
  /** Draw attention to this control (first-run "press Run" hint). */
  pulse?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            ICON_BUTTON,
            pulse &&
              'animate-pulse text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500/40',
          )}
        >
          <Icon />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export interface ClockControlsProps {
  /** What `useSimulation` returned. */
  simulation: UseSimulationResult;
  /** Show a speed slider, from 1 to 10,000 cycles a second. @default false */
  showSpeed?: boolean;
  /** Show a slider over the history once there is some. @default false */
  showScrubber?: boolean;
  /** Float as a pill over a canvas instead of an inline bar. */
  floating?: boolean;
  /** Drop the bar's border and background, when the parent draws them. */
  chromeless?: boolean;
  /** Pulse the Run button to say "press this to simulate". */
  pulseRun?: boolean;
}

export function ClockControls({
  simulation,
  showSpeed = false,
  showScrubber = false,
  floating,
  chromeless,
  pulseRun,
}: ClockControlsProps): ReactElement | null {
  const { state, actions } = simulation;
  const { history } = state;
  // The speed the next Run starts at. While running, the slider changes the
  // run's speed directly.
  const [speed, setSpeed] = useState(state.speed);
  if (!state.ready || !state.isSequential) return null;
  return (
    <ClockBar
      cycle={state.cycle}
      historyLength={history.length}
      historyIndex={history.index}
      isRunning={state.isRunning}
      isViewingPast={history.isViewingPast}
      onStep={() => void actions.tick()}
      onRun={() => void actions.run(speed)}
      onPause={() => void actions.pause()}
      onReset={() => void actions.reset()}
      onStepBack={() => void actions.stepBack()}
      onStepForward={() => void actions.stepForward()}
      onSeek={(index) => void actions.seek(index)}
      speed={state.isRunning ? state.speed : speed}
      onSpeedChange={
        showSpeed
          ? (next) => {
              setSpeed(next);
              if (state.isRunning) void actions.run(next);
            }
          : undefined
      }
      showScrubber={showScrubber}
      floating={floating}
      chromeless={chromeless}
      pulseRun={pulseRun}
    />
  );
}

interface ClockBarProps {
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
  speed: number;
  maxSpeed?: number;
  showScrubber?: boolean;
  /** Render as a floating pill (inspector/canvas overlay) vs inline bar (editor/embed bottom bar) */
  floating?: boolean;
  /** Drop the inner border + background when the parent already provides them */
  chromeless?: boolean;
  /** Pulse the Run button to hint "press this to simulate" (editor first-run only). */
  pulseRun?: boolean;
}

/** Top of the speed slider. The engine does a few thousand cycles/s on an
 *  imported netlist and ~16k on a hand-written one, so this is roughly where
 *  asking for more stops buying anything. */
const MAX_SPEED = 10_000;

/** The slider is logarithmic. Linear would be useless here: with a 10k ceiling
 *  on an 80px track, everything under 100 tick/s — which is the whole range the
 *  game and any step-through debugging live in — lands in the first half-pixel.
 *  On a log track each decade gets an equal share. */
const speedToPos = (v: number) => Math.log10(Math.max(1, v));
const posToSpeed = (p: number) => Math.round(10 ** p);

/** The bar itself, from props. */
function ClockBar({
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
  speed,
  maxSpeed = MAX_SPEED,
  showScrubber,
  floating,
  chromeless,
  pulseRun,
}: ClockBarProps) {
  const wrapper = floating ? 'absolute top-3 left-1/2 -translate-x-1/2 z-10' : '';
  const inner = chromeless
    ? 'flex items-center gap-1.5'
    : 'flex items-center gap-1.5 border-t border-border bg-card/95 px-3 py-1.5';

  return (
    <TooltipProvider>
      <div className={wrapper}>
        <div className={inner}>
          <IconBtn
            label="Tick"
            icon={SkipForward}
            onClick={onStep}
            disabled={isRunning || isViewingPast}
          />
          {isRunning ? (
            <IconBtn label="Pause" icon={Pause} onClick={onPause} />
          ) : (
            <IconBtn
              label="Run"
              icon={Play}
              onClick={onRun}
              disabled={isViewingPast}
              pulse={pulseRun && !isViewingPast}
            />
          )}
          <IconBtn label="Reset" icon={RotateCcw} onClick={onReset} />

          {/* Speed slider */}
          {onSpeedChange && (
            <div className="flex items-center gap-2 border-l border-border pl-2 ml-0.5">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
              <input
                type="range"
                min={0}
                max={speedToPos(maxSpeed)}
                step={0.01}
                value={speedToPos(speed)}
                onChange={(e) => onSpeedChange(posToSpeed(Number(e.target.value)))}
                className="w-20 h-1 rounded-lg appearance-none cursor-pointer accent-blue-600"
                disabled={isViewingPast}
                aria-label="Simulation speed"
              />
              <span className="min-w-[55px] text-[10px] text-muted-foreground font-mono tabular-nums">
                {speed} tick/s
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
              <IconBtn
                label="Step back"
                icon={ChevronLeft}
                onClick={onStepBack}
                disabled={historyIndex <= 0 || isRunning}
              />

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

              <IconBtn
                label="Step forward"
                icon={ChevronRight}
                onClick={onStepForward}
                disabled={!isViewingPast || isRunning}
              />
            </div>
          )}

          {/* Scrubber */}
          {showScrubber && onSeek && historyLength > 1 && (
            <div className="flex items-center gap-2 border-l border-border pl-2 ml-0.5">
              <History className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
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

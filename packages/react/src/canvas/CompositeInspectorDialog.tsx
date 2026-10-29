/**
 * CompositeInspectorDialog: a modal window onto the internals of a composite,
 * nested as deep as the user double-clicks.
 *
 * It's a view of the simulation the canvas is showing, not a copy. Structure
 * comes from the component's definition; values come from the main session's
 * port map by dotted path (the simulation is flattened, so an instance `ha1`
 * already has `ha1.*` ports in it). So the inspector shows the same cycle as
 * the canvas behind it and keeps moving while auto-run is on. Nothing in it
 * writes to the circuit: boundary ports are indicators, not switches.
 *
 * The one thing not in the main session is a primitive's gate-level reference
 * build (`MADE_OF`). That runs as a second session in the same sandbox while
 * its frame is on the stack; see `useReferenceSession`.
 */

'use client';

import type { CircuitDefinitions } from '@simten/core/internal';
import React, { useCallback, useEffect, useMemo } from 'react';
import type { NodeData } from '../nodes';
import type { UseSimulationResult } from '../sandbox/useSimulation';
import { ClockControls } from './ClockControls';
import { createDrillDownViewCircuit, scopePortValues } from './drill-down-view';
import { resolveDrillTarget } from './drill-target';
import { FlowCanvas } from './FlowCanvas';
import type { InspectorFrame } from './types';
import { useReferenceSession } from './useReferenceSession';

// ── Inner canvas for a single inspector level ──

interface InspectorCanvasProps {
  frame: InspectorFrame;
  definitions: CircuitDefinitions;
  /** The port map of the session this frame reads, or null before it has one. */
  sessionPorts: ReadonlyMap<string, number> | null;
  onPushLevel: (frame: InspectorFrame) => void;
  theme?: 'light' | 'dark';
}

function InspectorCanvas({
  frame,
  definitions: pageDefinitions,
  sessionPorts,
  onPushLevel,
  theme = 'dark',
}: InspectorCanvasProps) {
  // A reference build brings its own circuits; the page's definitions have
  // never heard of them. Projection and nested drilling must resolve against
  // the frame's definitions, or internal nodes vanish.
  const definitions = frame.definitions ?? pageDefinitions;

  const viewCircuit = useMemo(
    () => createDrillDownViewCircuit(frame.componentDef),
    [frame.componentDef],
  );

  const portValues = useMemo(
    () =>
      sessionPorts ? scopePortValues(sessionPorts, frame.path, viewCircuit, definitions) : null,
    [sessionPorts, frame.path, viewCircuit, definitions],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeData: NodeData) => {
      if (!nodeData.isComposite && !nodeData.hasReference) return;
      const next = resolveDrillTarget(nodeData, definitions, frame.path);
      if (next) onPushLevel(next);
    },
    [definitions, frame.path, onPushLevel],
  );

  // No onToggleNode or onSetNodeValue: the boundary switches and inputs render
  // as indicators, and nothing here writes to the circuit.
  return (
    <FlowCanvas
      circuit={viewCircuit}
      definitions={definitions}
      portValues={portValues}
      peripheralState={null}
      onNodeDoubleClick={handleNodeDoubleClick}
      theme={theme}
      height="100%"
      panOnMobile
    />
  );
}

// ── Breadcrumb navigation ──

interface BreadcrumbProps {
  stack: InspectorFrame[];
  onNavigate: (index: number) => void;
  theme?: 'light' | 'dark';
}

function InspectorBreadcrumb({ stack, onNavigate, theme = 'dark' }: BreadcrumbProps) {
  const topFrame = stack[stack.length - 1];
  const description = topFrame?.componentDef.metadata?.description;
  const dark = theme === 'dark';
  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {stack.map((frame, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className={`${dark ? 'text-gray-500' : 'text-gray-400'} shrink-0`}>&gt;</span>
          )}
          {index < stack.length - 1 ? (
            <button
              type="button"
              onClick={() => onNavigate(index)}
              className={`${
                dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              } hover:underline font-medium shrink-0`}
            >
              {frame.nodeLabel} ({frame.componentName})
            </button>
          ) : (
            <span className={`font-semibold shrink-0 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
              {frame.nodeLabel} ({frame.componentName})
            </span>
          )}
        </React.Fragment>
      ))}
      {description && (
        <>
          <span className={`${dark ? 'text-gray-600' : 'text-gray-300'} shrink-0`}>—</span>
          <span className={`${dark ? 'text-gray-400' : 'text-gray-500'} text-xs italic truncate`}>
            {description}
          </span>
        </>
      )}
    </div>
  );
}

// ── Main dialog component (props-driven) ──

interface CompositeInspectorDialogProps {
  stack: InspectorFrame[];
  definitions: CircuitDefinitions;
  /** The simulation the canvas is showing. Null draws structure with no values. */
  simulation: UseSimulationResult | null;
  theme?: 'light' | 'dark';
  onClose: () => void;
  onPopLevel: () => void;
  onPushLevel: (frame: InspectorFrame) => void;
  onNavigate: (index: number) => void;
}

export function CompositeInspectorDialog({
  stack,
  definitions,
  simulation,
  theme = 'dark',
  onClose,
  onPopLevel,
  onPushLevel,
  onNavigate,
}: CompositeInspectorDialogProps) {
  const isOpen = stack.length > 0;

  // Lock body scroll while the inspector is open. This is a hand-rolled modal
  // (a fixed-position overlay), so the browser doesn't lock scroll for
  // us the way native <dialog> would. Without this, swiping the modal scrolls
  // the page underneath. Tracked for proper Radix Dialog refactor in #84.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Escape steps back a level, or closes from the top level. It listens on the
  // window because nothing in the dialog is guaranteed to have focus.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (stack.length > 1) {
        onPopLevel();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, stack.length, onPopLevel, onClose]);

  const topFrame = isOpen ? stack[stack.length - 1] : null;

  // A stack holds at most one reference build: the builds are made of gates
  // and FullAdders, never of another primitive with a build (made-of.test.ts).
  // Every frame from it up reads its session; the frames below read the main one.
  const referenceFrame = stack.find((frame) => frame.reference) ?? null;
  const mainPorts = simulation?.state.portValues ?? null;
  const reference = useReferenceSession(referenceFrame, mainPorts);
  const sessionPorts = referenceFrame ? reference.ports : mainPorts;

  if (!isOpen || !topFrame) return null;

  // The backdrop, the panel and each level fade in with CSS, which runs once when
  // the element is added to the page. They used to be framer-motion animations,
  // which jumped back at the end of each fade and made the dialog flicker. The
  // canvas unmounts this dialog as soon as it closes, so there is no exit fade.
  return (
    <>
      {/* Backdrop: clicking outside the panel closes it. It's out of the tab
          order because the close button and Escape already cover the keyboard. */}
      <button
        type="button"
        aria-label="Close inspector"
        tabIndex={-1}
        className="fixed inset-0 z-50 cursor-default bg-black/50 animate-in fade-in-0 duration-250"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div
          // A reference build is the widest thing this dialog ever shows —
          // Comparator(8) is an equality tree plus a full subtraction, ~60
          // nodes laid out left-to-right. max-w-5xl shrank that to specks.
          className={`flex h-[88vh] w-full max-w-[1600px] flex-col rounded-lg shadow-xl pointer-events-auto overflow-hidden animate-in fade-in-0 duration-150 ${
            theme === 'dark' ? 'bg-gray-900' : 'bg-white'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between border-b px-4 py-3 ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <InspectorBreadcrumb stack={stack} onNavigate={onNavigate} theme={theme} />
            <button
              type="button"
              onClick={onClose}
              className={`rounded p-1 ${
                theme === 'dark'
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
              aria-label="Close inspector"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Canvas body. A new key per level mounts it fresh, so it fades in. */}
          <div className="relative flex-1 overflow-hidden">
            <div
              key={`${stack.length}-${topFrame.componentName}`}
              className="absolute inset-0 animate-in fade-in-0 duration-200"
            >
              <InspectorCanvas
                frame={topFrame}
                definitions={definitions}
                sessionPorts={sessionPorts}
                onPushLevel={onPushLevel}
                theme={theme}
              />
            </div>
            {/* The main session's clock, since the modal covers the canvas's own controls. */}
            {simulation && <ClockControls simulation={simulation} floating showScrubber />}
            {reference.error && (
              <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded bg-red-950/80 px-3 py-1.5 text-xs text-red-200">
                The reference build didn't run: {reference.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

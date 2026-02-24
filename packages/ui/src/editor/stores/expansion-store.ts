/**
 * Inspector Store
 *
 * Manages a stack of "inspector frames" for drilling into composite components.
 * Double-clicking a composite opens a modal dialog with its own canvas and
 * independent simulation. Nested composites push additional frames onto the stack.
 *
 * Replaces the old expansion store (expand-in-place approach).
 */

import { create } from 'zustand';
import type { Circuit } from '../types/circuit';

export interface InspectorFrame {
  componentName: string;   // e.g. "FullAdder"
  componentDef: Circuit;   // The Circuit definition
  nodeLabel: string;       // e.g. "fa" — display label
}

/** Screen rect of the node that triggered the dialog (for animate-from-origin) */
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InspectorState {
  stack: InspectorFrame[];
  /** Screen rect of the node that was double-clicked to open the dialog */
  originRect: OriginRect | null;
}

interface InspectorActions {
  /** Clear stack and push first frame (called from parent canvas double-click) */
  open(componentName: string, componentDef: Circuit, nodeLabel: string, originRect?: OriginRect): void;
  /** Push a nested composite (called from inside the dialog) */
  pushLevel(componentName: string, componentDef: Circuit, nodeLabel: string): void;
  /** Pop top frame, revealing parent level */
  popLevel(): void;
  /** Clear entire stack (closes dialog) */
  close(): void;
}

export interface InspectorStore extends InspectorState, InspectorActions {}

export const useInspectorStore = create<InspectorStore>((set) => ({
  stack: [],
  originRect: null,

  open: (componentName, componentDef, nodeLabel, originRect) => {
    set({
      stack: [{ componentName, componentDef, nodeLabel }],
      originRect: originRect ?? null,
    });
  },

  pushLevel: (componentName, componentDef, nodeLabel) => {
    set((state) => ({
      stack: [...state.stack, { componentName, componentDef, nodeLabel }],
    }));
  },

  popLevel: () => {
    set((state) => ({
      stack: state.stack.slice(0, -1),
    }));
  },

  close: () => {
    set({ stack: [], originRect: null });
  },
}));

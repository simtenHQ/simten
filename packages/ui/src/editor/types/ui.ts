/**
 * UI State Types
 *
 * Transient UI state for interactions, selections, and temporary operations.
 * This state is ephemeral and not persisted.
 */

// ===========================
// Interaction State
// ===========================

export interface DragOperation {
  type: 'component' | 'connection';
  componentRef?: string; // For palette drags
  active: boolean;
}

export interface SelectionState {
  selectedComponentIds: Set<string>;
  selectedConnectionIds: Set<string>;
}

// ===========================
// Simulation State
// ===========================

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'error';

export interface SimulationState {
  status: SimulationStatus;
  currentStep: number;
  error?: string;
}

// ===========================
// Canvas State
// ===========================

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
}

// ===========================
// UI Store State
// ===========================

export interface UIState {
  drag: DragOperation | null;
  selection: SelectionState;
  simulation: SimulationState;
  canvas: CanvasState;
}

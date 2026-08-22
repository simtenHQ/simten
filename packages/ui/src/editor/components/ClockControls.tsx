/**
 * Editor ClockControls — re-exports the unified canvas ClockControls.
 * The VisualEditor passes all props from the session.
 */

'use client';

export {
  ClockControls,
  type ClockControlsProps,
  DEFAULT_SPEED,
  MAX_SPEED,
} from '../../canvas/ClockControls';

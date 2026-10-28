/**
 * The sandbox protocol now lives in `@simten/sandbox/protocol`. This module
 * re-exports the slot messages `useSandbox` speaks, under their old names,
 * until `useSandbox` is replaced (#417).
 */

export type {
  BehaviorSource,
  CompileIRResult,
  CompileResult,
  PeripheralState,
  ResetResult,
  RestoreResult,
  SandboxRequest,
  SandboxResponse,
  SandboxResult,
  SetNodeResult,
  SimSlot,
  SlotErrorResult as SandboxError,
  SnapshotResult,
  TickResult,
  WorkerRequest,
  WorkerResponse,
} from '@simten/sandbox/protocol';

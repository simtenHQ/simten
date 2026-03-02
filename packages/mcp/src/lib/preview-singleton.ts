/**
 * Shared preview server singleton.
 *
 * Extracted from show.ts so that multiple MCP tools
 * (state, traces, test-results) can access the running preview.
 */

import { join } from 'node:path';

export interface CircuitState {
  cycleCount: number;
  inputs: Record<string, boolean | number>;
  outputs: Record<string, boolean | number>;
  isSequential: boolean;
  circuitName: string | null;
  timestamp: number;
}

export interface TracesPayload {
  circuit: string;
  ticks: number;
  inputs: string[];
  outputs: string[];
  signals: Record<string, Array<{ value: boolean | number; count: number }>>;
  steadyStateAt?: number;
}

export interface TestResultsPayload {
  results: Array<{
    name: string;
    dutName?: string;
    status: 'passed' | 'failed';
    cycles: number;
    failureReason?: string;
    assertionSummary?: {
      total: number;
      passed: number;
      failed: number;
      results: Array<{ cycle: number; passed: boolean; message: string }>;
    };
  }>;
}

export type PreviewServer = {
  port: number;
  updateDSL(dsl: string): void;
  watchFile(filePath: string): void;
  getState(): CircuitState | null;
  pushTraces(data: TracesPayload): void;
  pushTestResults(data: TestResultsPayload): void;
  close(): void;
};

type CreatePreviewServer = (options?: {
  port?: number;
  clientDir?: string;
}) => Promise<PreviewServer>;

// Module-level singleton
let previewServer: PreviewServer | null = null;
let browserOpened = false;

// Register cleanup
let cleanupRegistered = false;
function ensureCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    previewServer?.close();
    previewServer = null;
  };
  process.on('exit', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

export async function getOrCreateServer(): Promise<PreviewServer> {
  if (previewServer) return previewServer;

  // Import the preview server from the bundled dist
  const serverPath = join(import.meta.dirname, '../preview-server/index.js');
  const mod = (await import(serverPath)) as {
    createPreviewServer: CreatePreviewServer;
  };

  const clientDir = join(import.meta.dirname, '../preview-client');

  previewServer = await mod.createPreviewServer({ clientDir });
  ensureCleanup();

  return previewServer;
}

export function getPreviewServer(): PreviewServer | null {
  return previewServer;
}

export function setPreviewServer(server: PreviewServer | null): void {
  previewServer = server;
}

export function getBrowserOpened(): boolean {
  return browserOpened;
}

export function setBrowserOpened(value: boolean): void {
  browserOpened = value;
}

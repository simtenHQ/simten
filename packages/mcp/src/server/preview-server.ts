import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { watchFile as fsWatchFile, unwatchFile, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CircuitState, ChallengeState, TracesPayload, TestResultsPayload } from './types.js';
import { TI_URL } from '../lib/config.js';

export type { CircuitState, ChallengeState, TracesPayload, TestResultsPayload };

export interface PreviewServer {
  port: number;
  updateDSL(dsl: string): void;
  watchFile(filePath: string): void;
  getState(): CircuitState | null;
  getChallengeState(): ChallengeState | null;
  navigateChallenge(challengeId: string, stageId: string): void;
  addChallengeStep(challengeId: string, stageId: string, step: string): void;
  pushTraces(data: TracesPayload): void;
  pushTestResults(data: TestResultsPayload): void;
  close(): void;
}

export async function createPreviewServer(
  options?: { port?: number }
): Promise<PreviewServer> {
  const port = options?.port ?? 0;
  const allowedOrigin = TI_URL;

  let currentDSL: string | null = null;
  let cachedState: CircuitState | null = null;
  let cachedChallengeState: ChallengeState | null = null;
  let cachedTraces: TracesPayload | null = null;
  let cachedTestResults: TestResultsPayload | null = null;
  const sseClients = new Set<ServerResponse>();
  let watchedPath: string | null = null;

  function broadcastSSE(data: unknown) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      res.write(message);
    }
  }

  function sendCORS(res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://localhost`);

    if (req.method === 'OPTIONS') {
      sendCORS(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/api/dsl') {
      sendCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ source: currentDSL }));
      return;
    }

    if (url.pathname === '/api/state') {
      sendCORS(res);
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            cachedState = JSON.parse(body) as CircuitState;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      // GET
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ state: cachedState }));
      return;
    }

    if (url.pathname === '/api/challenge') {
      sendCORS(res);
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            cachedChallengeState = JSON.parse(body) as ChallengeState;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      // GET
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ challenge: cachedChallengeState }));
      return;
    }

    if (url.pathname === '/api/events') {
      sendCORS(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.flushHeaders();

      // Send current state immediately so late-joining clients are caught up
      if (currentDSL) {
        res.write(`data: ${JSON.stringify({ type: 'dsl', source: currentDSL })}\n\n`);
      }
      if (cachedTraces) {
        res.write(`data: ${JSON.stringify({ type: 'traces', data: cachedTraces })}\n\n`);
      }
      if (cachedTestResults) {
        res.write(`data: ${JSON.stringify({ type: 'test-results', data: cachedTestResults })}\n\n`);
      }
      if (cachedChallengeState) {
        res.write(`data: ${JSON.stringify({ type: 'challenge-state', ...cachedChallengeState })}\n\n`);
      }

      sseClients.add(res);

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 30000);

      req.on('close', () => {
        sseClients.delete(res);
        clearInterval(heartbeat);
      });

      return;
    }

    // No static file serving — return 404 for unknown paths
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  const server = createServer(handleRequest);

  const assignedPort = await new Promise<number>((resolvePort, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolvePort(addr.port);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });
    server.on('error', reject);
  });

  function updateDSL(dsl: string) {
    currentDSL = dsl;
    broadcastSSE({ type: 'dsl', source: dsl });
  }

  function watchFile(filePath: string) {
    const absPath = resolve(filePath);

    if (watchedPath === absPath) return;

    if (watchedPath) {
      unwatchFile(watchedPath);
    }

    watchedPath = absPath;

    fsWatchFile(absPath, { interval: 200 }, (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs) return;

      if (curr.size === 0 && !existsSync(absPath)) {
        broadcastSSE({ type: 'file-deleted' });
        return;
      }

      try {
        const content = readFileSync(absPath, 'utf-8');
        updateDSL(content);
      } catch {
        broadcastSSE({ type: 'error', message: `Failed to read ${absPath}` });
      }
    });
  }

  function close() {
    if (watchedPath) {
      unwatchFile(watchedPath);
      watchedPath = null;
    }
    for (const res of sseClients) {
      res.end();
    }
    sseClients.clear();
    server.close();
  }

  function getState(): CircuitState | null {
    return cachedState;
  }

  function getChallengeState(): ChallengeState | null {
    return cachedChallengeState;
  }

  function navigateChallenge(challengeId: string, stageId: string) {
    broadcastSSE({ type: 'challenge-navigate', challengeId, stageId });
  }

  function addChallengeStep(challengeId: string, stageId: string, step: string) {
    broadcastSSE({ type: 'challenge-add-step', challengeId, stageId, step });
  }

  function pushTraces(data: TracesPayload) {
    cachedTraces = data;
    broadcastSSE({ type: 'traces', data });
  }

  function pushTestResults(data: TestResultsPayload) {
    cachedTestResults = data;
    broadcastSSE({ type: 'test-results', data });
  }

  return {
    port: assignedPort,
    updateDSL,
    watchFile,
    getState,
    getChallengeState,
    navigateChallenge,
    addChallengeStep,
    pushTraces,
    pushTestResults,
    close,
  };
}

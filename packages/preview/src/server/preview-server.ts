import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, watchFile as fsWatchFile, unwatchFile, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import type { CircuitState, TracesPayload, TestResultsPayload } from "./types.js";

export interface PreviewServerOptions {
  port?: number; // Default: 0 (auto-assign)
  clientDir?: string; // Path to built client assets
}

export interface PreviewServer {
  port: number;
  updateDSL(dsl: string): void;
  watchFile(filePath: string): void;
  getState(): CircuitState | null;
  pushTraces(data: TracesPayload): void;
  pushTestResults(data: TestResultsPayload): void;
  close(): void;
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export async function createPreviewServer(
  options?: PreviewServerOptions
): Promise<PreviewServer> {
  const port = options?.port ?? 0;
  const clientDir = options?.clientDir ?? join(import.meta.dirname, "../client");

  let currentDSL: string | null = null;
  let cachedState: CircuitState | null = null;
  const sseClients = new Set<ServerResponse>();
  let watchedPath: string | null = null;

  function broadcastSSE(data: unknown) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      res.write(message);
    }
  }

  function sendCORS(res: ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  function serveStatic(res: ServerResponse, urlPath: string) {
    // Normalize path
    let filePath = urlPath === "/" ? "/index.html" : urlPath;

    // Security: prevent directory traversal
    if (filePath.includes("..")) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const fullPath = join(clientDir, filePath);

    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      // SPA fallback: serve index.html for any non-file route
      const indexPath = join(clientDir, "index.html");
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        sendCORS(res);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(content);
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = extname(fullPath);
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const content = readFileSync(fullPath);
    sendCORS(res);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || "/", `http://localhost`);

    if (req.method === "OPTIONS") {
      sendCORS(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/api/dsl") {
      sendCORS(res);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ source: currentDSL }));
      return;
    }

    if (url.pathname === "/api/state") {
      sendCORS(res);
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          try {
            cachedState = JSON.parse(body) as CircuitState;
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }
      // GET
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ state: cachedState }));
      return;
    }

    if (url.pathname === "/api/events") {
      sendCORS(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Send current DSL immediately if available
      if (currentDSL) {
        res.write(`data: ${JSON.stringify({ type: "dsl", source: currentDSL })}\n\n`);
      }

      sseClients.add(res);

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 30000);

      req.on("close", () => {
        sseClients.delete(res);
        clearInterval(heartbeat);
      });

      return;
    }

    // Static file serving
    serveStatic(res, url.pathname);
  }

  const server = createServer(handleRequest);

  const assignedPort = await new Promise<number>((resolvePort, reject) => {
    server.listen(port, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolvePort(addr.port);
      } else {
        reject(new Error("Failed to get server address"));
      }
    });
    server.on("error", reject);
  });

  function updateDSL(dsl: string) {
    currentDSL = dsl;
    broadcastSSE({ type: "dsl", source: dsl });
  }

  function watchFile(filePath: string) {
    const absPath = resolve(filePath);

    // If already watching the same file, skip
    if (watchedPath === absPath) return;

    // Stop watching previous file
    if (watchedPath) {
      unwatchFile(watchedPath);
    }

    watchedPath = absPath;

    // fs.watchFile uses stat polling — reliable on macOS even with atomic saves
    fsWatchFile(absPath, { interval: 200 }, (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs) return;

      if (curr.size === 0 && !existsSync(absPath)) {
        broadcastSSE({ type: "file-deleted" });
        return;
      }

      try {
        const content = readFileSync(absPath, "utf-8");
        updateDSL(content);
      } catch {
        broadcastSSE({ type: "error", message: `Failed to read ${absPath}` });
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

  function pushTraces(data: TracesPayload) {
    broadcastSSE({ type: "traces", data });
  }

  function pushTestResults(data: TestResultsPayload) {
    broadcastSSE({ type: "test-results", data });
  }

  return {
    port: assignedPort,
    updateDSL,
    watchFile,
    getState,
    pushTraces,
    pushTestResults,
    close,
  };
}

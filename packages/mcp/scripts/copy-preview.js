/**
 * Copies built preview assets into the MCP dist directory.
 * Run after tsc: "tsc -b && node scripts/copy-preview.js"
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpDist = join(__dirname, '..', 'dist');
const previewDist = join(__dirname, '..', '..', 'preview', 'dist');

// Copy client assets: preview/dist/client/ → mcp/dist/preview-client/
const clientSrc = join(previewDist, 'client');
const clientDst = join(mcpDist, 'preview-client');

if (existsSync(clientSrc)) {
  mkdirSync(clientDst, { recursive: true });
  cpSync(clientSrc, clientDst, { recursive: true });
  console.log(`Copied preview client → ${clientDst}`);
} else {
  console.warn(`Warning: preview client not found at ${clientSrc}`);
  console.warn('Run "pnpm --filter @turing-incomplete/preview build" first');
}

// Copy server code: preview/dist/server/ → mcp/dist/preview-server/
const serverSrc = join(previewDist, 'server');
const serverDst = join(mcpDist, 'preview-server');

if (existsSync(serverSrc)) {
  mkdirSync(serverDst, { recursive: true });
  cpSync(serverSrc, serverDst, { recursive: true });
  console.log(`Copied preview server → ${serverDst}`);
} else {
  console.warn(`Warning: preview server not found at ${serverSrc}`);
  console.warn('Run "pnpm --filter @turing-incomplete/preview build" first');
}

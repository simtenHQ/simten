/**
 * Standalone local MCP viewer entry.
 *
 * A plain `createRoot` client-only build (no TanStack Start, no SSR, no
 * prerender, no per-build token) that mounts the same EditorWorkspace the
 * deployed `/circuit` route uses, but in `standalone` mode: no Share, no
 * marketing chrome, no router. The MCP serves this bundle from localhost and
 * the editor's `useMCPConnection` reads `#token=&port=` from the URL fragment
 * to connect back to the studio over the same origin.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../src/styles.css';

import { ShareCircuitProvider } from '@simten/embed';
import { SandboxProvider } from '@simten/ui/sandbox';
import EditorShell from '@/components/EditorShell';
import { ThemeProvider } from '@/components/ThemeProvider';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('viewer: #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <SandboxProvider>
        {/* No server in the viewer — the Fork/Share context is a no-op.
            CircuitEmbed guards `null` (see packages/embed/src/share-context.tsx). */}
        <ShareCircuitProvider value={null}>
          <EditorShell standalone />
        </ShareCircuitProvider>
      </SandboxProvider>
    </ThemeProvider>
  </StrictMode>,
);

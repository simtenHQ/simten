/**
 * The embed page: one shared circuit, full-bleed, for another site's iframe.
 *
 * The circuit renders with `useSimulation`, `CircuitCanvas` and `ClockControls` from
 * @simten/react (./circuit.tsx): the source compiles and simulates in the
 * sandbox iframe, never here. Nothing in this frame writes anything: forking
 * or saving happens on simten.dev, behind the "Open in Simten" link.
 */

import './page.css';
import { fetchShare } from './fetch-share';
import { parseEmbedRequest, resolveTheme } from './options';

type MountCircuit = typeof import('./circuit').mountCircuit;

const SITE = import.meta.env.DEV ? 'http://localhost:3001' : 'https://simten.dev';

const root = document.getElementById('embed') as HTMLElement;
const request = parseEmbedRequest(new URL(window.location.href));
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function theme(): 'light' | 'dark' {
  return resolveTheme(request.theme, darkQuery.matches);
}

function showStatus(text: string): void {
  const p = document.createElement('p');
  p.className = 'status';
  p.setAttribute('role', 'status');
  p.textContent = text;
  root.replaceChildren(p);
}

function openLink(id: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'open-in-simten';
  a.href = `${SITE}/circuit/s/${id}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Open in Simten ↗';
  return a;
}

/** Mounts the circuit and keeps its theme in step with the system's. CSS sizes it to the frame. */
function mount(id: string, source: string, mountCircuit: MountCircuit): void {
  const container = document.createElement('div');
  container.className = 'circuit';
  // No Fork button: the page's own "Open in Simten" link, to the same share,
  // is the way out of the frame.
  root.replaceChildren(container, openLink(id));
  const setTheme = mountCircuit(container, {
    source,
    theme: theme(),
    controls: request.controls,
  });
  darkQuery.addEventListener('change', () => {
    document.documentElement.dataset.theme = theme();
    setTheme(theme());
  });
}

async function main(): Promise<void> {
  document.documentElement.dataset.theme = theme();
  const { id } = request;
  if (!id) {
    showStatus('No circuit here. Embed links look like embed.simten.dev/s/<id>.');
    return;
  }
  // The circuit's code (React, the canvas, the simulator) loads while the
  // share is fetched, not after.
  const circuit = import('./circuit').then((m) => m.mountCircuit);
  const share = await fetchShare(id, {
    onRetry: () => showStatus('This circuit is still publishing. Retrying…'),
  });
  if (share.kind === 'not-found') {
    showStatus('Circuit not found. Check the link, or share the circuit again.');
    return;
  }
  if (share.kind === 'error') {
    showStatus(`Couldn't load this circuit: ${share.message}`);
    return;
  }
  mount(id, share.source, await circuit);
}

main().catch(() => showStatus("Couldn't load this circuit. Try reloading."));

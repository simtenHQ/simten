/**
 * The embed page: one shared circuit, full-bleed, for another site's iframe.
 *
 * The circuit renders through `<circuit-embed code="...">` from
 * @simten/embed, the same component and the same sandbox path as a web
 * component on any page: the source compiles and simulates in the sandbox
 * iframe, never here. Nothing in this frame writes anything: forking or
 * saving happens on simten.dev, behind the "Open in Simten" link.
 */

import './page.css';
import { fetchShare } from './fetch-share';
import { parseEmbedRequest, resolveTheme } from './options';

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

/** Mounts the circuit, and keeps its size and theme in step with the frame. */
function mount(id: string, source: string): void {
  const embed = document.createElement('circuit-embed');
  embed.setAttribute('code', source);
  embed.setAttribute('theme', theme());
  embed.setAttribute('height', String(window.innerHeight));
  if (!request.controls) embed.setAttribute('show-controls', 'false');
  // An `href` replaces the embed's Fork button. Fork is hidden in frames
  // narrower than 768px, and there is no info bar to show `href` in, so the
  // page's own "Open in Simten" link, to the same share, stands in for both.
  embed.setAttribute('href', `${SITE}/circuit/s/${id}`);
  root.replaceChildren(embed, openLink(id));

  window.addEventListener('resize', () => {
    embed.setAttribute('height', String(window.innerHeight));
  });
  darkQuery.addEventListener('change', () => {
    document.documentElement.dataset.theme = theme();
    embed.setAttribute('theme', theme());
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
  const component = import('@simten/embed/webcomponent');
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
  await component;
  mount(id, share.source);
}

main().catch(() => showStatus("Couldn't load this circuit. Try reloading."));

/** Ports, origins and the seeded share the e2e run shares between its scripts. */

import { fileURLToPath } from 'node:url';

export const EMBED_PORT = 4701;
export const HOST_PORT = 4702;
export const SANDBOX_PORT = 4703;
export const SITE_PORT = 4704;

/** The embed page: the production build, served by `wrangler dev` with its headers. */
export const EMBED = `http://localhost:${EMBED_PORT}`;
/** Someone else's site, on another origin, that iframes the embed page. */
export const HOST = `http://localhost:${HOST_PORT}`;
export const SANDBOX = `http://localhost:${SANDBOX_PORT}`;
/** simten.dev's headers on a local page, to check it still refuses to be framed. */
export const SITE = `http://localhost:${SITE_PORT}`;

/** Local KV state that `wrangler dev` reads. */
export const STATE_DIR = fileURLToPath(new URL('./.state', import.meta.url));
export const SHARE_ID_FILE = `${STATE_DIR}/share-id`;

/** The seeded share: a switch driving an LED through a NOT gate. */
export const SOURCE = `const Toggle = circuit('Toggle', {
  inputs: { sw: bit },
  outputs: { led: bit },
  nodes: { not1: Not },
  connect: ({ inputs, outputs, nodes: { not1 } }) => [
    inputs.sw.to(not1.in),
    not1.out.to(outputs.led),
  ],
})`;

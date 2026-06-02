const DEFAULT_SIMTEN_URL = 'https://simten.dev';

export const SIMTEN_URL = process.env.SIMTEN_URL || DEFAULT_SIMTEN_URL;

export const DEFAULT_PORT = 19847;

/**
 * Serve the editor from localhost by default (same origin as the studio WS),
 * which is the only configuration that avoids Chrome's Local Network Access
 * block. Setting SIMTEN_URL opts out: the page is loaded from that origin
 * instead (e.g. http://localhost:3001 for dev). Note: pointing SIMTEN_URL at
 * the hosted https://simten.dev re-enters the LNA block and requires the user
 * to grant the local-network permission — it is not an LNA-free path.
 */
export const LOCAL_SERVE = !process.env.SIMTEN_URL;

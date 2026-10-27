/**
 * Where Fork opens a circuit in the simten.dev editor. Only simten.dev itself
 * creates shares; an embed anywhere else creates nothing.
 */

import { encodeSourceForUrl } from '@simten/ui/share';
import type { ShareCircuitFn } from './share-context';

interface ForkTarget {
  /** The source to open. */
  source: string;
  /** The host app's share function: only simten.dev provides one. */
  shareCircuit: ShareCircuitFn | null;
  /** The editor's origin, e.g. https://simten.dev. */
  host: string;
}

export async function forkUrl({ source, shareCircuit, host }: ForkTarget): Promise<string> {
  // On simten.dev: a short link, as the editor's Share makes (#368).
  if (shareCircuit) {
    const { hash } = await shareCircuit(source);
    return `${host}/circuit/s/${hash}`;
  }
  // Any other site: the source travels in the URL.
  return `${host}/circuit/${encodeSourceForUrl(source)}`;
}

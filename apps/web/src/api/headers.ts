/**
 * Site-wide response headers, read from `public/_headers`.
 *
 * Cloudflare applies `_headers` to static assets only, which covers the
 * prerendered pages but not what the worker renders. The worker entry imports
 * the same file and applies its `/*` block to its own responses, so the file
 * stays the one place these headers are written.
 */

/** The `Name: value` lines of the `/*` block in a `_headers` file. */
export function siteWideHeaders(file: string): Array<[string, string]> {
  const headers: Array<[string, string]> = [];
  let inBlock = false;
  for (const line of file.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === '/*';
      continue;
    }
    const colon = line.indexOf(':');
    if (inBlock && colon > 0) {
      headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
    }
  }
  return headers;
}

/** `response` with each header added unless the response already sets it. */
export function withHeaders(response: Response, headers: Array<[string, string]>): Response {
  const missing = headers.filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  const copy = new Response(response.body, response);
  for (const [name, value] of missing) copy.headers.set(name, value);
  return copy;
}

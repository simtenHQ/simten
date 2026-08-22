#!/usr/bin/env tsx
/**
 * Read the Cloudflare Analytics Engine counters.
 *
 * Analytics Engine has no dashboard. The Cloudflare "Web Analytics" page is a
 * different product — a RUM beacon reporting visits and Core Web Vitals — and it
 * never shows these events no matter where you click. The SQL API is the only
 * way to read the dataset, and this wraps it.
 *
 * `apps/web` is the only writer today: `share_create` and `share_read` from
 * `features/share/server.ts`, into the `simten_analytics` dataset bound as
 * ANALYTICS in its wrangler.jsonc. `apps/game` declares no bindings, so nothing
 * from play.simten.dev lands here.
 *
 *   pnpm analytics                summary by event, last 90 days
 *   pnpm analytics --days=30      same over a different window
 *   pnpm analytics --daily        one row per day per event
 *   pnpm analytics --sql="..."    arbitrary query against the dataset
 *
 * Counts use sum(_sample_interval) rather than count(): Analytics Engine samples
 * under load, and count() silently undercounts once sampling starts.
 *
 * Credentials come from the repo `.env` via dotenv-cli, the same pair the deploy
 * scripts use. The token needs Account Analytics: Read.
 */

const DATASET = 'simten_analytics';
const DEFAULT_DAYS = 90;

interface SqlResponse {
  meta?: { name: string; type: string }[];
  data?: Record<string, string | number | null>[];
  rows?: number;
  errors?: { code: number; message: string }[];
}

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function flag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

async function query(sql: string): Promise<SqlResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set.\n' +
        'They live in the repo .env — run via `pnpm analytics`, which loads it with dotenv.',
    );
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: sql },
  );

  const body = await res.text();
  if (!res.ok) {
    // A 403 here is almost always a token missing Account Analytics: Read
    // rather than a bad query — the deploy token doesn't carry it by default.
    throw new Error(`SQL API ${res.status}: ${body}`);
  }

  let parsed: SqlResponse;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Unparseable response: ${body}`);
  }
  if (parsed.errors?.length) {
    throw new Error(parsed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  }
  return parsed;
}

/** Print `data` as a padded table, taking column order from the response meta. */
function table(result: SqlResponse): void {
  const rows = result.data ?? [];
  if (rows.length === 0) {
    console.log('No rows in this window.');
    return;
  }

  const columns = result.meta?.map((m) => m.name) ?? Object.keys(rows[0]);
  const width = (col: string) =>
    Math.max(col.length, ...rows.map((r) => String(r[col] ?? '').length));
  const widths = Object.fromEntries(columns.map((c) => [c, width(c)]));

  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[columns[i]]))
      .join('  ')
      .trimEnd();

  console.log(line(columns));
  console.log(line(columns.map((c) => '-'.repeat(widths[c]))));
  for (const row of rows) {
    console.log(line(columns.map((c) => String(row[c] ?? ''))));
  }
}

// Wrapped rather than top-level await: the root package.json has no
// `"type": "module"`, so tsx emits CJS here and top-level await won't compile.
async function main(): Promise<void> {
  const days = Number(arg('days') ?? DEFAULT_DAYS);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`--days must be a positive number, got ${arg('days')}`);
  }

  const window = `timestamp > NOW() - INTERVAL '${days}' DAY`;

  const sql =
    arg('sql') ??
    (flag('daily')
      ? `SELECT toDate(timestamp) AS day, blob1 AS event, sum(_sample_interval) AS n
         FROM ${DATASET} WHERE ${window}
         GROUP BY day, event ORDER BY day DESC, event`
      : `SELECT blob1 AS event, sum(_sample_interval) AS n
         FROM ${DATASET} WHERE ${window}
         GROUP BY event ORDER BY n DESC`);

  if (!arg('sql')) console.log(`${DATASET} — last ${days} days\n`);

  table(await query(sql));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Privacy Policy page.
 *
 * Source of truth: /PRIVACY.md at the repository root. When that file
 * changes, mirror the changes here. The prose is duplicated rather than
 * MDX-imported to keep this route SSR-friendly and dependency-free.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: 'Privacy Policy | Simten' },
      {
        name: 'description',
        content:
          "What Simten collects, what it doesn't, and why. Plain language; no third-party analytics or accounts.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-foreground">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective: 2026-05-28</p>
      </header>

      <Prose>
        <H2>TL;DR</H2>
        <p>
          Simten is a developer tool. We don&apos;t have accounts, don&apos;t collect your email,
          don&apos;t run third-party analytics, and don&apos;t sell anything. The only personal data
          that touches our servers is what every web service necessarily sees (your IP address, in
          Cloudflare&apos;s access logs) and circuit source you explicitly choose to share via the
          &ldquo;Share&rdquo; button. Everything else stays on your machine.
        </p>
        <p>This document explains the details so you don&apos;t have to take that on faith.</p>

        <H2>What we collect</H2>
        <p>
          <strong>Cloudflare access logs (IP address, user agent, URL).</strong> Standard web-server
          logs. Retained by Cloudflare per their default retention; we don&apos;t export, aggregate,
          or sell them. We use them only to debug outages and abuse.
        </p>
        <p>
          <strong>Cloudflare Analytics Engine, share events only.</strong> When you create or load a
          shared circuit, we increment two counters in Cloudflare&apos;s first-party analytics
          product: <code>share_create</code> (with the hash and source byte length) and{' '}
          <code>share_read</code> (with the hash). No IP, no user agent, no personal data is logged
          here — we use it to size capacity and spot abuse patterns. There is no tracker on any
          page, no Google Analytics, no PostHog, no Sentry, no Plausible. We considered them and
          chose not to ship them.
        </p>
        <p>
          <strong>Shared circuit source (Cloudflare KV).</strong> If you press the
          &ldquo;Share&rdquo; button in the editor, the circuit source code is stored verbatim in
          Cloudflare KV under a content hash, so anyone with the link can load it. Source ≤ 100 KB.
          TTL is 2 years and refreshes on every read (active links don&apos;t expire). Sharing is
          rate-limited (30 shares per IP per 60 seconds).
        </p>

        <H2>What we don&apos;t collect</H2>
        <ul>
          <li>No accounts, logins, emails, OAuth, or user records.</li>
          <li>No cookies.</li>
          <li>
            No third-party analytics, tracking pixels, advertising scripts, or session replay.
          </li>
          <li>
            No telemetry from the MCP server (<code>@simten/mcp</code>) — it runs entirely on your
            machine and does not phone home.
          </li>
          <li>
            No telemetry from the embed library (<code>@simten/embed</code> /{' '}
            <code>&lt;CircuitEmbed /&gt;</code>) — it does not call back to simten.dev when loaded
            on third-party sites.
          </li>
          <li>
            No telemetry from the FPGA pipeline (<code>apps/synth</code>, <code>apps/verifier</code>
            ) beyond Cloudflare&apos;s standard logs; circuit source and Verilog passed through
            these services are processed and returned, not persisted.
          </li>
        </ul>

        <H2>What&apos;s stored on your device</H2>
        <p>
          Browser <code>localStorage</code> only:
        </p>
        <ul>
          <li>
            <code>theme</code> — light/dark preference.
          </li>
          <li>
            <code>simten:mcp-connection</code> — the connection token + port for reconnecting to
            your local MCP server. Local-only; never leaves your machine.
          </li>
          <li>
            <code>simten-ts-code</code> (and similar editor keys) — your current editor buffer, so
            it survives page reload.
          </li>
        </ul>
        <p>No cookies of any kind.</p>

        <H2>Third parties that may see your IP</H2>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosts simten.dev and serves every request. See{' '}
            <ExternalLink href="https://www.cloudflare.com/privacypolicy/">
              Cloudflare&apos;s privacy policy
            </ExternalLink>
            .
          </li>
          <li>
            <strong>
              jsDelivr (<code>cdn.jsdelivr.net</code>)
            </strong>{' '}
            — the editor loads the TypeScript compiler from jsDelivr for in-browser type checking.
            Loaded only when you open the editor. See{' '}
            <ExternalLink href="https://www.jsdelivr.com/privacy-policy-jsdelivr-net">
              jsDelivr&apos;s privacy policy
            </ExternalLink>
            .
          </li>
          <li>
            <strong>esm.sh</strong> — the in-browser sandbox loads any npm packages your circuit
            imports from esm.sh. Loaded only if your circuit has <code>import</code> statements. See{' '}
            <ExternalLink href="https://esm.sh">esm.sh</ExternalLink>.
          </li>
        </ul>
        <p>
          We don&apos;t load Google Fonts, Google Analytics, or any other Google service. Fonts are
          self-hosted.
        </p>

        <H2>LLM data flow</H2>
        <p>
          The chat panel in the editor is a passive view over a connection to your{' '}
          <strong>local Claude Code</strong> (or other MCP client) instance. Your messages and
          circuit code go from the panel to your local MCP client, which decides what to send to its
          configured LLM provider (Anthropic, OpenRouter, etc.) under credentials <em>you</em>{' '}
          control. Simten has no servers in this loop, no shared API key, and no access to that
          traffic.
        </p>

        <H2>Data retention</H2>
        <ul>
          <li>
            Cloudflare access logs: per Cloudflare&apos;s defaults (typically days, not months).
          </li>
          <li>
            Cloudflare Analytics Engine share counters: indefinite, but contain no personal data.
          </li>
          <li>
            Shared circuits in KV: 2 years, refreshed on every read. Email{' '}
            <a
              href="mailto:privacy@simten.dev"
              className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            >
              privacy@simten.dev
            </a>{' '}
            to request deletion of a specific hash.
          </li>
        </ul>

        <H2>Your rights (GDPR / CCPA)</H2>
        <p>
          Because we collect no personal identifiers tied to you, most data-subject requests
          don&apos;t apply meaningfully. The exception is shared circuits — if you shared a circuit
          and want it deleted, email{' '}
          <a
            href="mailto:privacy@simten.dev"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            privacy@simten.dev
          </a>{' '}
          with the hash (the part after <code>/circuit/s/</code> in the URL) and we&apos;ll delete
          the KV entry.
        </p>
        <p>
          If you believe we&apos;re holding data about you that we haven&apos;t disclosed here,
          email us and we&apos;ll investigate.
        </p>

        <H2>Children</H2>
        <p>
          The service is not directed at children under 13. We don&apos;t knowingly collect data
          from them.
        </p>

        <H2>Changes</H2>
        <p>
          We&apos;ll update the &ldquo;Effective&rdquo; date at the top when this changes. Material
          changes to data practices will also be noted in the repository changelog.
        </p>

        <H2>Contact</H2>
        <p>
          <a
            href="mailto:privacy@simten.dev"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            privacy@simten.dev
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          For source of truth: this content lives at{' '}
          <ExternalLink href="https://github.com/simtenHQ/simten/blob/main/PRIVACY.md">
            PRIVACY.md
          </ExternalLink>{' '}
          in the simten repository.
        </p>
      </Prose>
    </article>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 leading-relaxed text-foreground/90">{children}</div>;
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-xl font-semibold tracking-tight text-foreground">{children}</h2>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground underline underline-offset-2 hover:text-foreground/80"
    >
      {children}
    </a>
  );
}

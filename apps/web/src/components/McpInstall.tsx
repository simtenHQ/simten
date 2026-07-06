import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Single source of truth for how each agent CLI registers the Simten MCP
// server. Add a new client by appending one entry — the tab UI and both the
// docs page and any other embed pick it up automatically.
//
// Verified against each tool's official MCP docs (July 2026):
//   Claude Code  — `claude mcp add <name> <cmd>`
//   Codex CLI    — `codex mcp add <name> -- <cmd>`  (note the `--` separator)
//   Gemini CLI   — `gemini mcp add <name> <cmd>`
//   Cursor & co. — no register-via-CLI; a `mcpServers` JSON block, which is
//                  the same shape Windsurf, VS Code, Claude Desktop and Zed use.
type Client = {
  id: string;
  label: string;
  /** Shell one-liner, when the client has one. */
  command?: string;
  /** Config-file snippet, for clients configured by hand. */
  config?: { path: string; lang: string; body: string };
  /** Optional footnote rendered under the snippet. */
  note?: string;
};

const CLIENTS: Client[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude mcp add simten npx @simten/mcp',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    command: 'codex mcp add simten -- npx @simten/mcp',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    command: 'gemini mcp add simten npx @simten/mcp',
  },
  {
    id: 'other',
    label: 'Cursor & others',
    config: {
      path: '~/.cursor/mcp.json',
      lang: 'json',
      body: `{
  "mcpServers": {
    "simten": {
      "command": "npx",
      "args": ["@simten/mcp"]
    }
  }
}`,
    },
    note: 'Same block works for Windsurf, VS Code, Claude Desktop, and Zed — drop it in that client’s MCP config.',
  },
];

const STORAGE_KEY = 'simten:mcp-client';

export function McpInstall() {
  const [activeId, setActiveId] = useState(CLIENTS[0].id);
  const [copied, setCopied] = useState(false);

  // Remember the reader's client across the site, like npm/pnpm/yarn tabs do.
  // Read after mount so server-rendered markup stays deterministic.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CLIENTS.some((c) => c.id === saved)) setActiveId(saved);
  }, []);

  const select = (id: string) => {
    setActiveId(id);
    setCopied(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // private mode / storage disabled — selection just won't persist
    }
  };

  const active = CLIENTS.find((c) => c.id === activeId) ?? CLIENTS[0];
  const snippet = active.command ?? active.config?.body ?? '';

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap border-b border-border bg-muted/40">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => select(c.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              c.id === activeId
                ? 'text-foreground border-b-2 border-foreground -mb-px'
                : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {active.config && (
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
            {active.config.path}
          </div>
        )}
        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2.5 pr-10 font-mono text-[13px] leading-relaxed text-foreground/90">
            {active.command ? (
              <>
                <span className="select-none text-muted-foreground/60">$ </span>
                {active.command}
              </>
            ) : (
              active.config?.body
            )}
          </pre>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy to clipboard"
            className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        {active.note && (
          <p className="mt-2 text-xs text-muted-foreground">{active.note}</p>
        )}
      </div>
    </div>
  );
}

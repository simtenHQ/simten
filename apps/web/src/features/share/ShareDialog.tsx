/**
 * ShareDialog: the editor's Share button. Opening it saves the circuit as a
 * share link (as the button always did) and copies the link; the Embed tab
 * turns the same link into an `<iframe>` snippet for embed.simten.dev, with a
 * live preview of exactly what the snippet will show.
 */

'use client';

import { Button } from '@simten/react/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@simten/react/primitives/dialog';
import { Check, Copy, Loader2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { extractCircuitName } from '@/lib/extract-circuit-name';
import {
  EMBED_SIZES,
  type EmbedSize,
  type EmbedTheme,
  embedSnippet,
  embedUrl,
} from './embed-snippet';

type Tab = 'link' | 'embed';

type ShareState =
  | { kind: 'sharing' }
  | { kind: 'ready'; hash: string; name: string | null }
  | { kind: 'error'; message: string };

const linkFor = (hash: string) => `${window.location.origin}/circuit/s/${hash}`;

async function createShare(source: string): Promise<{ hash: string }> {
  // Dynamic import keeps the `cloudflare:workers`-backed server fn out of
  // the standalone client-only viewer build's module graph.
  const { shareCircuit } = await import('@/features/share/server');
  return shareCircuit({ data: { source } });
}

/** Creates the share once per opening, for whatever source the editor holds then. */
function useShareOnOpen(open: boolean, getSource: () => string): ShareState {
  const [state, setState] = useState<ShareState>({ kind: 'sharing' });
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const source = getSource();
    if (!source.trim()) {
      setState({ kind: 'error', message: 'Nothing to share' });
      return;
    }
    setState({ kind: 'sharing' });
    createShare(source).then(
      ({ hash }) => {
        if (cancelled) return;
        setState({ kind: 'ready', hash, name: extractCircuitName(source) });
        // The button used to copy the link straight away; keep that, so one
        // click and a paste still works for anyone who only wants the link.
        navigator.clipboard.writeText(linkFor(hash)).catch(() => undefined);
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Sharing failed';
        if (!cancelled) setState({ kind: 'error', message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, getSource]);
  return state;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'blocked'>('idle');
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setStatus('copied'),
      () => setStatus('blocked'),
    );
    setTimeout(() => setStatus('idle'), 2000);
  }, [text]);
  return (
    <Button onClick={copy} size="sm" className="gap-2 shrink-0">
      {status === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {status === 'copied' ? 'Copied' : status === 'blocked' ? 'Clipboard blocked' : label}
    </Button>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function LinkPanel({ hash }: { hash: string }) {
  const url = linkFor(hash);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label="Share link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 font-mono text-xs"
      />
      <CopyButton text={url} label="Copy link" />
    </div>
  );
}

const SIZES = Object.keys(EMBED_SIZES) as EmbedSize[];
const THEMES: readonly EmbedTheme[] = ['auto', 'light', 'dark'];

function EmbedPanel({ hash, name }: { hash: string; name: string | null }) {
  const [size, setSize] = useState<EmbedSize>('4:3');
  const [theme, setTheme] = useState<EmbedTheme>('auto');
  const [controls, setControls] = useState(true);
  const snippet = embedSnippet({ hash, name, size, theme, controls });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Choice label="Size" value={size} options={SIZES} onChange={setSize} />
        <Choice label="Theme" value={theme} options={THEMES} onChange={setTheme} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={controls}
            onChange={(e) => setControls(e.target.checked)}
          />
          Clock controls
        </label>
      </div>
      <div className="flex items-start gap-2">
        <textarea
          readOnly
          value={snippet}
          rows={3}
          aria-label="Embed snippet"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 resize-none rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] leading-relaxed"
        />
        <CopyButton text={snippet} label="Copy" />
      </div>
      <div className="max-h-[45vh] overflow-auto rounded border border-border">
        <iframe
          src={embedUrl({ hash, theme, controls })}
          style={{ width: '100%', border: 0, ...EMBED_SIZES[size] }}
          title={`${name ?? 'Circuit'} preview`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The bare link works too, on sites that embed by URL. Anyone can view an embedded circuit;
        editing happens on simten.dev.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded px-3 py-1 text-sm ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  getSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getSource: () => string;
}) {
  const [tab, setTab] = useState<Tab>('link');
  const share = useShareOnOpen(open, getSource);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Anyone with the link can open this circuit. Links don&apos;t expire.
          </DialogDescription>
        </DialogHeader>
        <div role="tablist" className="flex gap-1">
          <TabButton active={tab === 'link'} onClick={() => setTab('link')}>
            Link
          </TabButton>
          <TabButton active={tab === 'embed'} onClick={() => setTab('embed')}>
            Embed
          </TabButton>
        </div>
        {share.kind === 'sharing' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Creating link…
          </div>
        )}
        {share.kind === 'error' && <p className="text-sm text-destructive">{share.message}</p>}
        {share.kind === 'ready' &&
          (tab === 'link' ? (
            <LinkPanel hash={share.hash} />
          ) : (
            <EmbedPanel hash={share.hash} name={share.name} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

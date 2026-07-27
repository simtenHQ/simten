/**
 * VerilogImportSheet — paste Verilog, get editable simten source.
 *
 * Posts to /api/verilog-import (the synth container's `import` yosys target +
 * @simten/core's importer) and hands the generated source back via onImport.
 * The importer covers a subset of cells (see issue #237); unsupported cells come
 * back as a friendly message instead of a crash.
 */

'use client';

import { FileInput, Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/** Pull module names out of Verilog source; the last one is the default top. */
function detectModules(src: string): string[] {
  const names: string[] = [];
  const re = /\bmodule\s+([A-Za-z_]\w*)/g;
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    names.push(m[1]);
    m = re.exec(src);
  }
  return names;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; unsupported?: boolean };

const PLACEHOLDER = `module adder8(input [7:0] a, input [7:0] b, output [7:0] y);
  assign y = a + b;
endmodule`;

export function VerilogImportSheet({ onImport }: { onImport: (source: string) => void }) {
  const [open, setOpen] = useState(false);
  const [verilog, setVerilog] = useState('');
  const [top, setTop] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // Stop auto-filling `top` once the user hand-edits it.
  const topEdited = useRef(false);

  const onVerilogChange = useCallback((value: string) => {
    setVerilog(value);
    if (!topEdited.current) {
      const mods = detectModules(value);
      setTop(mods.length ? mods[mods.length - 1] : '');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!verilog.trim()) return;
    if (!top.trim()) {
      setStatus({ kind: 'error', message: 'Enter the top module name' });
      return;
    }
    setStatus({ kind: 'loading' });
    try {
      const resp = await fetch('/api/verilog-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verilog, top }),
      });
      const data = (await resp.json()) as {
        success: boolean;
        source?: string;
        error?: string;
        unsupported?: boolean;
      };
      if (!resp.ok || !data.success || !data.source) {
        setStatus({
          kind: 'error',
          message: data.error ?? `Import failed (HTTP ${resp.status})`,
          unsupported: data.unsupported,
        });
        return;
      }
      onImport(data.source);
      setVerilog('');
      topEdited.current = false;
      setStatus({ kind: 'idle' });
      setOpen(false);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
    }
  }, [verilog, top, onImport]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Import a Verilog module as editable simten source"
        >
          <FileInput className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Import Verilog</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-6 sm:max-w-xl">
        <SheetHeader className="p-0">
          <SheetTitle>Import Verilog</SheetTitle>
        </SheetHeader>

        <p className="text-xs text-muted-foreground">
          Paste a Verilog module. It's synthesized to a generic netlist and lifted into editable
          simten source. Behavioral RTL works best; a subset of cells is supported.
        </p>

        <textarea
          value={verilog}
          onChange={(e) => onVerilogChange(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="min-h-[220px] w-full flex-1 resize-none rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Top module</span>
          <input
            value={top}
            onChange={(e) => {
              topEdited.current = true;
              setTop(e.target.value);
            }}
            placeholder="top"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {status.kind === 'error' && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
            {status.message}
            {status.unsupported && (
              <p className="mt-1 text-muted-foreground">
                This design uses a cell the importer doesn't handle yet (e.g. a register with reset
                or clock-enable). Try a simpler module for now.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            onClick={handleImport}
            size="sm"
            disabled={status.kind === 'loading' || !verilog.trim()}
            className="gap-2"
          >
            {status.kind === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status.kind === 'loading' ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

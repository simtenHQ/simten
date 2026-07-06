/**
 * UART capture via serialport.
 *
 * Auto-discovers /dev/cu.usbserial-* (macOS) or /dev/ttyUSB* (Linux) and reads
 * bytes until the regex matches, the timeout fires, or the port closes.
 */

import { readdirSync } from 'node:fs';
import { SerialPort } from 'serialport';

export interface OpenAndCaptureOpts {
  baud: number;
  timeoutMs: number;
  matchRegex?: RegExp;
  /** Explicit device path override. If unset, auto-discover. */
  device?: string;
  /** Retry count on initial open (handles USB re-enum after flash). */
  openRetries?: number;
  /** Backoff between retries in ms. */
  openBackoffMs?: number;
}

export interface CaptureResult {
  device: string;
  bytes: number[];
  str: string;
  captured_ms: number;
  partial: boolean;
  matchIndex?: number;
}

export function discoverUsbSerial(): string | null {
  let devEntries: string[] = [];
  try {
    devEntries = readdirSync('/dev');
  } catch {
    return null;
  }
  // Prefer /dev/cu.usbserial-* on macOS (non-blocking outgoing).
  const cu = devEntries.find((e) => e.startsWith('cu.usbserial-'));
  if (cu) return `/dev/${cu}`;
  // Linux /dev/ttyUSB*.
  const tty = devEntries.find((e) => /^ttyUSB\d+$/.test(e));
  if (tty) return `/dev/${tty}`;
  // Last resort: macOS tty.usbserial-*.
  const ttyUsb = devEntries.find((e) => e.startsWith('tty.usbserial-'));
  if (ttyUsb) return `/dev/${ttyUsb}`;
  return null;
}

async function openWithRetry(
  path: string,
  baud: number,
  retries: number,
  backoffMs: number,
): Promise<SerialPort> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await new Promise<SerialPort>((res, rej) => {
        const port = new SerialPort({ path, baudRate: baud, autoOpen: false });
        port.open((err) => (err ? rej(err) : res(port)));
      });
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

export async function openAndCapture(opts: OpenAndCaptureOpts): Promise<CaptureResult> {
  const device = opts.device ?? discoverUsbSerial();
  if (!device) {
    const err = new Error(
      'no serial device found (looked for /dev/cu.usbserial-*, /dev/ttyUSB*, /dev/tty.usbserial-*)',
    );
    (err as NodeJS.ErrnoException).code = 'ENOENT';
    throw err;
  }

  const retries = opts.openRetries ?? 3;
  const backoff = opts.openBackoffMs ?? 200;
  const port = await openWithRetry(device, opts.baud, retries, backoff);

  const started = Date.now();
  const bytes: number[] = [];
  let matchIndex: number | undefined;
  let decoded = '';

  return await new Promise<CaptureResult>((resolve) => {
    const done = (partial: boolean) => {
      const elapsed = Date.now() - started;
      if (port.isOpen) port.close(() => {});
      resolve({ device, bytes, str: decoded, captured_ms: elapsed, partial, matchIndex });
    };

    const timer = setTimeout(() => done(true), opts.timeoutMs);

    port.on('data', (chunk: Buffer) => {
      for (const b of chunk) bytes.push(b);
      // Best-effort UTF-8 decode of the cumulative buffer.
      decoded = Buffer.from(bytes).toString('utf8');
      if (opts.matchRegex) {
        const m = decoded.match(opts.matchRegex);
        if (m && m.index !== undefined) {
          matchIndex = m.index;
          clearTimeout(timer);
          done(false);
        }
      }
    });

    port.on('error', () => {
      clearTimeout(timer);
      done(true);
    });

    port.on('close', () => {
      clearTimeout(timer);
      // If closed without match, treat as partial unless we already resolved.
      done(opts.matchRegex ? matchIndex === undefined : false);
    });
  });
}

/**
 * Flash a bitstream over Wi-Fi through the ULX3S's onboard ESP32.
 *
 * Expects the ESP32 to run MicroPython with emard's esp32ecp5 tools
 * (https://github.com/emard/esp32ecp5). Its uftpd treats an upload to the
 * special name "fpga" as a JTAG stream into the ECP5's SRAM, clocked at
 * 20 MHz by the ESP32's hardware SPI. That is far faster than the onboard
 * FT231X, which bit-bangs JTAG at ~450 kbit/s, so a compressed bitstream
 * lands in ~1.5-2s instead of 5-8s.
 *
 * Only the handful of FTP commands uftpd needs are implemented, over a
 * passive-mode data connection, so this pulls in no FTP dependency.
 */

import { connect, type Socket } from 'node:net';

const FTP_PORT = 21;
const DEFAULT_TIMEOUT_MS = 30_000;

interface WifiFlashOptions {
  /** ESP32 hostname or IP, optionally with :port. */
  host: string;
  timeoutMs?: number;
}

interface Reply {
  code: number;
  text: string;
}

/** Reads complete FTP replies (including multi-line "ddd-" ones) off a socket. */
class ReplyReader {
  private buf = '';
  private queue: Reply[] = [];
  private waiters: Array<{ resolve: (r: Reply) => void; reject: (e: Error) => void }> = [];
  private failed?: Error;

  constructor(socket: Socket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      this.buf += chunk;
      this.drain();
    });
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new Error('FTP control connection closed')));
  }

  next(): Promise<Reply> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  private drain(): void {
    for (;;) {
      const reply = this.parseOne();
      if (!reply) return;
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(reply);
      else this.queue.push(reply);
    }
  }

  private parseOne(): Reply | undefined {
    const lines = this.buf.split('\r\n');
    if (lines.length < 2) return undefined;
    const first = lines[0];
    const code = first.slice(0, 3);
    // Single-line reply, or the closing line of a multi-line one: "ddd text".
    // The last element is an unterminated partial line, so it can't close a reply.
    const endLine =
      first[3] === '-' ? lines.findIndex((l, i) => i > 0 && l.startsWith(`${code} `)) : 0;
    if (endLine < 0 || endLine >= lines.length - 1) return undefined;
    const consumed = lines.slice(0, endLine + 1);
    this.buf = lines.slice(endLine + 1).join('\r\n');
    return { code: Number.parseInt(code, 10), text: consumed.join('\n') };
  }

  private fail(e: Error): void {
    if (this.failed) return;
    this.failed = e;
    for (const w of this.waiters.splice(0)) w.reject(e);
  }
}

function splitHost(host: string): { hostname: string; port: number } {
  const m = /^(.*):(\d+)$/.exec(host);
  return m
    ? { hostname: m[1], port: Number.parseInt(m[2], 10) }
    : { hostname: host, port: FTP_PORT };
}

function openSocket(hostname: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect({ host: hostname, port }, () => {
      s.off('error', reject);
      resolve(s);
    });
    s.once('error', reject);
  });
}

async function expect(reader: ReplyReader, codes: number[], what: string): Promise<Reply> {
  const reply = await reader.next();
  if (!codes.includes(reply.code)) {
    throw new Error(`${what}: unexpected FTP reply ${reply.text}`);
  }
  return reply;
}

/** Parse "227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)". */
export function parsePasv(text: string): { hostname: string; port: number } {
  const m = /(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/.exec(text);
  if (!m) throw new Error(`could not parse PASV reply: ${text}`);
  const n = m.slice(1).map((s) => Number.parseInt(s, 10));
  return { hostname: n.slice(0, 4).join('.'), port: n[4] * 256 + n[5] };
}

/** Upload `bitstream` to the ESP32's "fpga" target. Resolves once the FPGA is configured. */
export async function flashOverWifi(bitstream: Buffer, opts: WifiFlashOptions): Promise<void> {
  const { hostname, port } = splitHost(opts.host);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const control = await openSocket(hostname, port);
  const timer = setTimeout(
    () => control.destroy(new Error(`Wi-Fi flash timed out after ${timeoutMs} ms`)),
    timeoutMs,
  );
  const reader = new ReplyReader(control);
  const send = (line: string) => control.write(`${line}\r\n`);

  try {
    await expect(reader, [220], 'connect');
    send('USER anonymous');
    const user = await expect(reader, [230, 331], 'USER');
    if (user.code === 331) {
      send('PASS anonymous');
      await expect(reader, [230], 'PASS');
    }
    send('TYPE I');
    await expect(reader, [200], 'TYPE');
    send('PASV');
    const pasv = parsePasv((await expect(reader, [227], 'PASV')).text);
    // uftpd may advertise its own address; the host we dialled is the reliable one.
    const data = await openSocket(hostname, pasv.port);
    send('STOR fpga');
    await expect(reader, [125, 150], 'STOR');
    await new Promise<void>((resolve, reject) => {
      data.once('error', reject);
      data.end(bitstream, () => resolve());
    });
    // uftpd replies 226 only once the bitstream has been streamed in and
    // ecp5.prog_close() reports success (550 otherwise), so this is the
    // "configured" signal.
    await expect(reader, [226], 'program FPGA');
    send('QUIT');
  } finally {
    clearTimeout(timer);
    control.destroy();
  }
}

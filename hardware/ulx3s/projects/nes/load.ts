/**
 * Loads an NROM game onto the NES running on the board, over USB serial.
 *
 *   tsx projects/nes/load.ts game.nes [--device=/dev/cu.usbserial-...]
 *
 * Sends "SIMN", a flags byte (bit 0: vertical mirroring), 32 KB of PRG and
 * 8 KB of CHR at 1 Mbaud; nes_top.v holds the NES in reset meanwhile and
 * starts it when the last byte is in.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SerialPort } from 'serialport';
import { discoverUsbSerial } from '../../lib/serial.js';
import { cartFromINes } from './index.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) throw new Error('usage: load.ts game.nes [--device=...]');
const device = args.find((a) => a.startsWith('--device='))?.slice('--device='.length);
const path = device ?? discoverUsbSerial();
if (!path) throw new Error('no USB serial device found; is the board plugged in?');

const cart = cartFromINes(new Uint8Array(readFileSync(resolve(file))));
const payload = Buffer.concat([
  Buffer.from('SIMN'),
  Buffer.from([cart.vertical ? 1 : 0]),
  cart.prg,
  cart.chr,
]);

const port = new SerialPort({ path, baudRate: 1_000_000, autoOpen: false });
await new Promise<void>((ok, fail) => port.open((e) => (e ? fail(e) : ok())));
const started = Date.now();
await new Promise<void>((ok, fail) => port.write(payload, (e) => (e ? fail(e) : ok())));
await new Promise<void>((ok, fail) => port.drain((e) => (e ? fail(e) : ok())));
await new Promise<void>((ok) => port.close(() => ok()));
console.log(
  `loaded ${file} (${payload.length} bytes, ${cart.vertical ? 'vertical' : 'horizontal'} mirroring) in ${Date.now() - started} ms via ${path}`,
);

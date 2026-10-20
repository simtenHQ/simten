import { type AddressInfo, createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { flashOverWifi, parsePasv } from './wifi-flash.js';

/**
 * Minimal stand-in for emard's uftpd: anonymous login, passive mode, and
 * "STOR fpga" answered with 226 (or 550 when `fail` is set) once the upload ends.
 */
function fakeUftpd(opts: { fail?: boolean } = {}) {
  const received: Buffer[] = [];
  const commands: string[] = [];
  let dataSocket: Promise<Socket> | undefined;
  const data = createServer();
  const control = createServer((cl) => {
    cl.write('220 Hello, this is the ULX3S.\r\n');
    let buf = '';
    cl.on('data', async (chunk) => {
      buf += chunk.toString('utf8');
      let i = buf.indexOf('\r\n');
      while (i >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        commands.push(line);
        const [cmd] = line.split(' ');
        if (cmd === 'USER') cl.write('331 Password required\r\n');
        else if (cmd === 'PASS') cl.write('230-Welcome\r\n230 Logged in.\r\n');
        else if (cmd === 'TYPE') cl.write('200 OK\r\n');
        else if (cmd === 'PASV') {
          const port = (data.address() as AddressInfo).port;
          dataSocket = new Promise((res) => data.once('connection', res));
          // Advertise a bogus address, as uftpd may; the client must dial the control host.
          cl.write(`227 Entering Passive Mode (10,9,8,7,${port >> 8},${port & 255}).\r\n`);
        } else if (cmd === 'STOR') {
          cl.write('150 Opened data connection.\r\n');
          const ds = await dataSocket;
          ds?.on('data', (b: Buffer) => received.push(b));
          ds?.on('end', () => cl.write(opts.fail ? '550 Fail\r\n' : '226 Done.\r\n'));
        } else if (cmd === 'QUIT') cl.end('221 Bye!\r\n');
        i = buf.indexOf('\r\n');
      }
    });
  });
  return { control, data, received, commands };
}

const servers: Server[] = [];
async function listen(s: Server): Promise<number> {
  servers.push(s);
  await new Promise<void>((res) => s.listen(0, '127.0.0.1', res));
  return (s.address() as AddressInfo).port;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((res) => s.close(res))));
});

describe('parsePasv', () => {
  it('decodes host and port', () => {
    expect(parsePasv('227 Entering Passive Mode (192,168,0,62,7,232).')).toEqual({
      hostname: '192.168.0.62',
      port: 2024,
    });
  });

  it('rejects a malformed reply', () => {
    expect(() => parsePasv('227 nope')).toThrow(/PASV/);
  });
});

describe('flashOverWifi', () => {
  it('uploads the bitstream to the "fpga" target and resolves on 226', async () => {
    const fake = fakeUftpd();
    await listen(fake.data);
    const port = await listen(fake.control);
    const bitstream = Buffer.from(Array.from({ length: 100_000 }, (_, i) => i & 0xff));

    await flashOverWifi(bitstream, { host: `127.0.0.1:${port}` });

    expect(Buffer.concat(fake.received).equals(bitstream)).toBe(true);
    expect(fake.commands).toContain('STOR fpga');
    expect(fake.commands).toContain('TYPE I');
  });

  it('rejects when the ESP32 reports the FPGA did not configure', async () => {
    const fake = fakeUftpd({ fail: true });
    await listen(fake.data);
    const port = await listen(fake.control);

    await expect(
      flashOverWifi(Buffer.from([1, 2, 3]), { host: `127.0.0.1:${port}` }),
    ).rejects.toThrow(/550/);
  });

  it('rejects when nothing is listening', async () => {
    const s = createServer();
    const port = await listen(s);
    await new Promise((res) => s.close(res));
    servers.pop();

    await expect(flashOverWifi(Buffer.from([1]), { host: `127.0.0.1:${port}` })).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});

import { describe, it, expect } from 'vitest';
import { computeVerilogHash } from './ecpbram.js';

describe('computeVerilogHash', () => {
  it('returns identical hashes when firmware-init bytes differ but the range is zeroed', () => {
    const base = 'module foo;\n  initial begin\n    __FIRMWARE__\n  end\nendmodule\n';
    const marker = '__FIRMWARE__';
    const start = base.indexOf(marker);
    const end = start + marker.length;

    const withA = base.slice(0, start) + 'xxxxxxxxxxxx' + base.slice(end);
    const withB = base.slice(0, start) + 'yyyyyyyyyyyy' + base.slice(end);

    const hashA = computeVerilogHash(withA, { start, end });
    const hashB = computeVerilogHash(withB, { start, end });
    expect(hashA).toBe(hashB);
  });

  it('returns different hashes when non-firmware bytes differ', () => {
    const a = 'module foo;\n  wire x;\nendmodule\n';
    const b = 'module foo;\n  wire y;\nendmodule\n';
    expect(computeVerilogHash(a)).not.toBe(computeVerilogHash(b));
  });

  it('is stable without a firmware range', () => {
    const v = 'module foo; endmodule';
    expect(computeVerilogHash(v)).toBe(computeVerilogHash(v));
  });

  it('produces a 16-hex-char key', () => {
    const h = computeVerilogHash('anything');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
});

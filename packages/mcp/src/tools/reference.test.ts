import { describe, expect, it } from 'vitest';
import { type ToolCall, toolsOf } from '../__tests__/tools.js';
import { registerReferenceTools } from './reference.js';

function captureTools(): Map<string, ToolCall> {
  return toolsOf(registerReferenceTools);
}

describe('reference tools', () => {
  it('registers get_grammar, list_components, and get_verify_api', () => {
    expect([...captureTools().keys()].sort()).toEqual([
      'get_grammar',
      'get_verify_api',
      'list_components',
    ]);
  });

  it('list_components returns the catalog with real part names + ctor options', async () => {
    const res = await captureTools().get('list_components')!();
    const text = res.content[0].text;
    // This is exactly the ~10KB that can't fit in the 2KB instructions cap —
    // so it must be reachable on demand instead.
    expect(text.length).toBeGreaterThan(1000);
    for (const part of ['Register', 'Adder', 'Mux']) expect(text).toContain(part);
  });

  it('get_grammar returns the circuit-builder API', async () => {
    const res = await captureTools().get('get_grammar')!();
    expect(res.content[0].text).toContain('circuit(');
  });

  it('get_verify_api returns the testbench/simulate() reference that was truncating off verify_circuit', async () => {
    const text = (await captureTools().get('get_verify_api')!()).content[0].text;
    for (const token of [
      'simulate(',
      's.set(',
      's.tick(',
      's.get(',
      'verify.run()',
      'declareOracle',
    ]) {
      expect(text).toContain(token);
    }
  });
});

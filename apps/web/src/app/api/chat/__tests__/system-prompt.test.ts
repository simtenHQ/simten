import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt';

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt('', '');

  it('contains primitive component names', () => {
    expect(prompt).toContain('Adder');
    expect(prompt).toContain('Register');
  });

  it('contains grammar syntax', () => {
    expect(prompt).toContain('circuit');
    expect(prompt).toContain('connect');
  });

  it('references simulate_circuit tool', () => {
    expect(prompt).toContain('simulate_circuit');
  });

  it('references run_testbench tool', () => {
    expect(prompt).toContain('run_testbench');
  });

  it('contains testbench workflow guidance', () => {
    expect(prompt).toContain('testbench');
    expect(prompt).toContain('Verify');
  });

  it('contains testbench syntax reference', () => {
    expect(prompt).toContain('stimulus');
    expect(prompt).toContain('assert');
    expect(prompt).toContain('use circuit');
  });
});

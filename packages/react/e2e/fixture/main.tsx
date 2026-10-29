/**
 * Three `<CircuitEmbed>`s, one of which swaps its circuit, and a
 * `SimulationView` of source text that doesn't compile.
 */

import '../../src/styles/embed.css';
import { bit, circuit } from '@simten/core';
import { And, Led, Not, Switch, Xor } from '@simten/core/std';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitEmbed, SimulationView } from '../../src/embed';
import { useSimulation } from '../../src/sandbox';

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

// No ports, so no harness: a switch and a lamp.
const Simple = circuit('Simple', {
  nodes: { a: Switch, light: Led },
  connect: ({ nodes: { a, light } }) => [a.out.to(light.in)],
});

const Toggle = circuit('Toggle', {
  inputs: { sw: bit },
  outputs: { led: bit },
  nodes: { not1: Not },
  connect: ({ inputs, outputs, nodes: { not1 } }) => [
    inputs.sw.to(not1.in),
    not1.out.to(outputs.led),
  ],
});

function Swappable() {
  const [simple, setSimple] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setSimple(true)}>
        Swap circuit
      </button>
      <CircuitEmbed circuit={simple ? Simple : HalfAdder} height={250} title="Half Adder Test" />
    </>
  );
}

function BrokenSource() {
  const source = useMemo(() => ({ source: 'this is invalid code' }), []);
  const simulation = useSimulation(source, { harness: true, debounceMs: 0 });
  return <SimulationView simulation={simulation} height={200} />;
}

function App() {
  return (
    <>
      <section id="test-basic">
        <Swappable />
      </section>
      <section id="test-error">
        <BrokenSource />
      </section>
      <section id="test-isolation">
        <CircuitEmbed circuit={Toggle} height={200} />
      </section>
    </>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

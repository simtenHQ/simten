/**
 * The components on a page with no `SandboxProvider`: a canvas whose circuit
 * swaps, a counter with clock controls, source text that doesn't compile, a
 * canvas of a NOT gate, and a colour display drawing a test pattern. They
 * share the page-wide sandbox.
 */

import '../../src/styles/embed.css';
import { bit, bus, circuit, reg } from '@simten/core';
import { And, Constant, Led, Not, PaletteDisplay, Register, Switch, Xor } from '@simten/core/std';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas, ClockControls, useSimulation } from '../../src';

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

// No ports, so it is drawn as it is: a switch and a lamp.
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

const Inc = circuit('Inc', {
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => ({ y: (a + 1) & 0xff }),
});

const Counter = circuit('Counter', {
  inputs: { en: bit },
  outputs: { count: bus(8) },
  nodes: { reg: Register(), one: Inc },
  connect: ({ inputs, outputs, nodes: { reg, one } }) => [
    inputs.en.to(reg.we),
    reg.q.to(one.a, outputs.count),
    one.y.to(reg.data),
  ],
});

function Swappable() {
  const [simple, setSimple] = useState(false);
  const simulation = useSimulation(simple ? Simple : HalfAdder);
  return (
    <>
      <button type="button" onClick={() => setSimple(true)}>
        Swap circuit
      </button>
      <CircuitCanvas simulation={simulation} height={250} />
    </>
  );
}

function Counting() {
  const simulation = useSimulation(Counter, { initialInputs: { en: 1 } });
  return (
    <>
      <CircuitCanvas simulation={simulation} height={250} />
      <ClockControls simulation={simulation} />
      <output>count {simulation.state.outputs.count}</output>
    </>
  );
}

function BrokenSource() {
  const source = useMemo(() => ({ source: 'this is invalid code' }), []);
  return <CircuitCanvas simulation={useSimulation(source)} height={200} />;
}

function Gate() {
  const simulation = useSimulation(Toggle);
  return (
    <>
      <CircuitCanvas simulation={simulation} height={200} />
      {/* Nothing: a NOT gate has no clock. */}
      <ClockControls simulation={simulation} />
    </>
  );
}

/** Raster position: x then y, one pixel per clock, wrapping at the end of a 256x240 frame. */
const Beam = circuit('Beam', {
  outputs: { x: bus(8), y: bus(8) },
  state: { at: reg(16) },
  eval: ({ at }) => ({ x: at & 0xff, y: at >> 8 }),
  onTick: ({ at }) => ({ at: at + 1 >= 256 * 240 ? 0 : at + 1 }),
});

/** 64 colour bars, four pixels wide. */
const BarColor = circuit('BarColor', {
  inputs: { x: bus(8) },
  outputs: { color: bus(6) },
  eval: ({ x }) => ({ color: x >> 2 }),
});

const ColourBars = circuit('ColourBars', {
  nodes: { beam: Beam, bar: BarColor, tv: PaletteDisplay(), on: Constant({ value: 1 }) },
  connect: ({ nodes: { beam, bar, tv, on } }) => [
    beam.x.to(bar.x, tv.x),
    beam.y.to(tv.y),
    bar.color.to(tv.color),
    on.out.to(tv.we),
  ],
});

function Bars() {
  const simulation = useSimulation(ColourBars);
  return (
    <>
      <button type="button" onClick={() => simulation.actions.tick(256 * 240)}>
        Draw frame
      </button>
      <output>cycle {simulation.state.cycle}</output>
      <CircuitCanvas simulation={simulation} height={700} />
    </>
  );
}

function App() {
  return (
    <>
      <section id="test-basic">
        <Swappable />
      </section>
      <section id="test-clock">
        <Counting />
      </section>
      <section id="test-error">
        <BrokenSource />
      </section>
      <section id="test-isolation">
        <Gate />
      </section>
      <section id="test-palette">
        <Bars />
      </section>
    </>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

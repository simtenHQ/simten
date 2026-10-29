/**
 * A recorded run as a Value Change Dump (IEEE 1364 §18), the format GTKWave
 * and every Verilog simulator read. One time unit is one clock cycle.
 */

/** One signal of the recording: its name, width, and value at each cycle from `first`. */
interface VcdSignal {
  name: string;
  width: number;
  values: readonly number[];
}

/** VCD identifiers: printable ASCII from `!` to `~`, then two characters, and so on. */
function identifier(index: number): string {
  let id = '';
  let n = index;
  do {
    id += String.fromCharCode(33 + (n % 94));
    n = Math.floor(n / 94) - 1;
  } while (n >= 0);
  return id;
}

/** A name VCD readers accept: no whitespace. */
const vcdName = (name: string) => name.replace(/\s+/g, '_') || 'signal';

function valueChange(width: number, value: number, id: string): string {
  if (width === 1) return `${value & 1}${id}`;
  return `b${(value >>> 0).toString(2)} ${id}`;
}

/** The VCD text for `signals`, recorded from cycle `first` on. */
export function toVcd(module: string, first: number, signals: readonly VcdSignal[]): string {
  const ids = signals.map((_, i) => identifier(i));
  const lines = [
    '$version Simten $end',
    '$timescale 1ns $end',
    `$scope module ${vcdName(module)} $end`,
    ...signals.map((s, i) => `$var wire ${s.width} ${ids[i]} ${vcdName(s.name)} $end`),
    '$upscope $end',
    '$enddefinitions $end',
  ];
  const count = Math.max(0, ...signals.map((s) => s.values.length));
  const last: (number | undefined)[] = signals.map(() => undefined);
  for (let t = 0; t < count; t++) {
    const changes: string[] = [];
    signals.forEach((s, i) => {
      const value = s.values[t];
      if (value === undefined || value === last[i]) return;
      last[i] = value;
      changes.push(valueChange(s.width, value, ids[i]));
    });
    if (t === 0) lines.push(`#${first}`, '$dumpvars', ...changes, '$end');
    else if (changes.length > 0) lines.push(`#${first + t}`, ...changes);
  }
  // Where the last cycle ends, so a viewer draws it full width.
  if (count > 0) lines.push(`#${first + count}`);
  return `${lines.join('\n')}\n`;
}

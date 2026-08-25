import type { FlatPortValueMap } from '@simten/core/simulator';
import { CircuitEmbed } from '@simten/embed';
import { useState } from 'react';
import { computeActiveRow, TruthTable } from '@/components/TruthTable';
import { HalfAdder } from '../circuits';

const HA_COLUMNS = [
  { name: 'a', group: 'input' as const },
  { name: 'b', group: 'input' as const },
  { name: 'sum', group: 'output' as const },
  { name: 'carry', group: 'output' as const },
];

const HA_ROWS: Array<Array<number | string>> = [
  [0, 0, 0, 0],
  [0, 1, 1, 0],
  [1, 0, 1, 0],
  [1, 1, 0, 1],
];

export function HalfAdderSection() {
  // Live port values from the embed's internal simulator, captured via
  // its onPortValuesChange callback. Stays null until the sim is ready
  // and first settles; the table renders un-highlighted in that window
  // (one paint, then the embed fires with the initial steady state).
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);

  const activeRow = computeActiveRow(portValues, HA_COLUMNS, HA_ROWS);

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The half adder</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The smallest possible adder takes two bits and produces two bits: a <strong>sum</strong>{' '}
          and a <strong>carry</strong>. With two single-bit inputs there are four cases, and the sum
          is 1 when exactly one input is 1 (that&rsquo;s XOR), and the carry is 1 only when both
          inputs are 1 (that&rsquo;s AND).
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Toggle the two switches. The first LED is the sum bit, the second is the carry. The
          highlighted row in the truth table follows whichever combination you&rsquo;ve set.
        </p>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <CircuitEmbed
            circuit={HalfAdder}
            title="Half adder"
            description="Two switches → XOR for the sum, AND for the carry."
            onPortValuesChange={setPortValues}
          />
        </div>
        <div className="shrink-0">
          <TruthTable
            title="Half adder truth table"
            columns={HA_COLUMNS}
            rows={HA_ROWS}
            highlightRow={activeRow}
          />
        </div>
      </div>
    </section>
  );
}

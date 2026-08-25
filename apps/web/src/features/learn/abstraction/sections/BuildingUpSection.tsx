import { CircuitEmbed } from '@simten/embed';
import { ABSTRACTION_CIRCUITS } from '../circuits';

export function BuildingUpSection() {
  const flat = ABSTRACTION_CIRCUITS.flatFullAdder;
  const composed = ABSTRACTION_CIRCUITS.composedFullAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Building up: full adders from half adders
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A full adder adds three bits: <code>a</code>, <code>b</code>, and a carry-in. Built
          directly from gates, it&rsquo;s five: two XORs, two ANDs, and one OR. Built from{' '}
          <code>HalfAdder</code> blocks, it&rsquo;s two half adders feeding into an OR, the same
          five gates inside, but the structure now has a name at every level.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <CircuitEmbed
          circuit={flat.circuit}
          showControls={false}
          title={flat.name}
          description={flat.description}
        />
        <CircuitEmbed
          circuit={composed.circuit}
          showControls={false}
          title={composed.name}
          description={composed.description}
        />
      </div>
    </section>
  );
}

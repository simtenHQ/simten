import { CircuitEmbed } from '@simten/react/embed';
import { BLOG_CIRCUITS } from '../circuits';

export function ALUSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The ALU</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A CPU needs more than addition. It also needs AND, OR and XOR. The{' '}
          <strong className="text-gray-900 dark:text-white">arithmetic logic unit</strong> (ALU)
          works out <em>all</em> of them at once and uses a{' '}
          <strong className="text-gray-900 dark:text-white">multiplexer</strong> to pass on the one
          the current instruction asked for.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Here is one bit of an ALU: a full adder and an AND, an OR and an XOR gate, all fed the
          same inputs. The two <strong>op</strong> switches choose the output: 00&nbsp;is ADD,
          01&nbsp;AND, 10&nbsp;OR and 11&nbsp;XOR.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Put eight of these side by side, with the carry running between the adders, and you have
          most of the 6502&rsquo;s ALU. The real one can also shift and do decimal arithmetic. When
          the CPU decodes an instruction, part of what it decides is which <strong>op</strong> to
          send the ALU.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.alu1bit.circuit}
          title="1-Bit ALU Slice"
          description="op: 00=ADD 01=AND 10=OR 11=XOR"
        />
      </div>
    </section>
  );
}

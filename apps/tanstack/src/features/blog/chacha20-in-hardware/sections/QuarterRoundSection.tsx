
import { CircuitEmbed } from "@turing-incomplete/embed";
import { CHACHA20_CIRCUITS } from "../circuits";

export function QuarterRoundSection() {
  const entry = CHACHA20_CIRCUITS.quarterRound;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full Quarter-Round
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Now we chain four ARX steps together, each feeding into the next.
          The quarter-round takes four 32-bit words (a, b, c, d) and
          thoroughly mixes them:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`a += b;  d ^= a;  d <<<= 16;
c += d;  b ^= c;  b <<<= 12;
a += b;  d ^= a;  d <<<= 8;
c += d;  b ^= c;  b <<<= 7;`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Notice how each step feeds the next &mdash; step 1 modifies{" "}
          <code>a</code> and <code>d</code>, step 2 uses the new{" "}
          <code>d</code> to modify <code>c</code> and <code>b</code>,
          and so on. By the end, every input bit has influenced every
          output bit.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit below is loaded with the{" "}
          <a
            href="https://www.rfc-editor.org/rfc/rfc7539#section-2.1.1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            RFC 7539 test vector
          </a>
          . Change any input and the four output hex displays update
          instantly &mdash; this entire circuit is pure combinational logic,
          computed in a single propagation with zero clock cycles.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={500}
          showControls={false}
          title={entry.name}
          description={entry.description}
        />
      </div>

      <div className="mt-8 rounded-lg border border-green-800/50 bg-green-950/20 p-4">
        <p className="text-sm text-green-400 font-medium">
          Verified against RFC 7539 &sect;2.1.1
        </p>
        <p className="text-xs text-green-400/70 mt-1 font-mono">
          In: a=0x11111111 b=0x01020304 c=0x9b8d6f43 d=0x01234567
        </p>
        <p className="text-xs text-green-400/70 font-mono">
          Out: a=0xea2a92f4 b=0xcb1cf8ce c=0x4581472e d=0x5881c4bb
        </p>
      </div>
    </section>
  );
}

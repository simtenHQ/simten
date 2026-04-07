
import { CircuitEmbed } from "@turing-incomplete/embed";
import { AES_CIRCUITS } from "../circuits";

export function MixColumnsSection() {
  const entry = AES_CIRCUITS.mixColumnDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        MixColumns: The Diffusion Layer
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong>MixColumns</strong> treats each 4-byte column of the AES
          state matrix as a polynomial over GF(2<sup>8</sup>) and multiplies
          it by a fixed matrix. Each output byte mixes all four input bytes:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`r0 = 2·s0 ⊕ 3·s1 ⊕ s2   ⊕ s3
r1 = s0   ⊕ 2·s1 ⊕ 3·s2 ⊕ s3
r2 = s0   ⊕ s1   ⊕ 2·s2 ⊕ 3·s3
r3 = 3·s0 ⊕ s1   ⊕ s2   ⊕ 2·s3`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Where <code>2·x</code> is XTime(x) and <code>3·x</code> is
          XTime(x)&nbsp;⊕&nbsp;x. That&rsquo;s it — four XTime operations
          and twelve XOR gates per column. Four columns = sixteen XTimes and
          forty-eight XORs for the full MixColumns step.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The goal of this matrix is total diffusion: every output byte depends
          on every input byte. Change one input bit, and all four outputs change.
          That&rsquo;s what makes AES cryptographically strong after just a few
          rounds — SubBytes provides non-linearity, MixColumns ensures that
          non-linearity spreads everywhere.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit below is verified against FIPS 197, Appendix B. The
          inputs are pre-loaded with the official test vector — you can change
          them to explore other values:
        </p>
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-900/10 p-4">
          <div className="text-xs text-emerald-400 font-semibold mb-2 font-mono">
            FIPS 197 Test Vector
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <div className="text-gray-500 text-xs mb-1">Input column</div>
              <div className="text-gray-600 dark:text-gray-300">s0 = 0xdb (219)</div>
              <div className="text-gray-600 dark:text-gray-300">s1 = 0x13 (19)</div>
              <div className="text-gray-600 dark:text-gray-300">s2 = 0x53 (83)</div>
              <div className="text-gray-600 dark:text-gray-300">s3 = 0x45 (69)</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Expected output</div>
              <div className="text-emerald-400">r0 = 0x8e (142)</div>
              <div className="text-emerald-400">r1 = 0x4d (77)</div>
              <div className="text-emerald-400">r2 = 0xa1 (161)</div>
              <div className="text-emerald-400">r3 = 0xbc (188)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={420}
          showControls={false}
          displayCode={entry.displayCode}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}

/**
 * The welcome: what Simten is, with its mark. It is the opening card of the
 * page tour (see OnboardingTour), which is the only place a newcomer meets it.
 */

export const INTRO_TITLE = 'TypeScript meets hardware';

/** Simten's mark, heading the welcome wherever it appears. */
export function IntroLogo({ className = 'mb-3' }: { className?: string }) {
  return <img src="/favicon.svg" alt="" width={40} height={40} className={className} />;
}

/** What this is, in a few lines: the body of the tour's opening card. */
export function IntroCopy({
  className = 'space-y-3 text-sm text-muted-foreground',
  ending = 'Good luck.',
}: {
  className?: string;
  /** The closing line. */
  ending?: string;
}) {
  return (
    <div className={className}>
      <p>Build a computer from logic gates, one layer of abstraction at a time.</p>
      <p>You do this by writing TypeScript. The circuit draws itself as you type.</p>
      <p>
        Take it as far as you like:{' '}
        <a
          href="https://simten.dev/blog/snake-in-hardware"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          games
        </a>
        ,{' '}
        <a
          href="https://simten.dev/blog/how-tpus-work"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          accelerators
        </a>
        ,{' '}
        <a
          href="https://simten.dev/blog/rv32i-cpu"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          CPUs that run C
        </a>
        . Then export to Verilog and flash your designs to real silicon on FPGAs.
      </p>
      <p>{ending}</p>
    </div>
  );
}

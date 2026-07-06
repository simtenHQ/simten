import { useEffect, useState } from 'react';

const CYCLING_PHRASES = [
  'a half adder',
  'a RISC-V CPU',
  'Snake in hardware',
  'a packet sniffer',
  'a 4-bit ALU',
];

function useCyclingTypewriter(phrases: string[], typeSpeed = 60, deleteSpeed = 30, pauseMs = 1800) {
  const [displayed, setDisplayed] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    const target = phrases[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayed.length < target.length) {
        timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), typeSpeed);
      } else {
        timeout = setTimeout(() => setPhase('pausing'), pauseMs);
      }
    } else if (phase === 'pausing') {
      timeout = setTimeout(() => setPhase('deleting'), 0);
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), deleteSpeed);
      } else {
        setPhraseIndex((i) => (i + 1) % phrases.length);
        setPhase('typing');
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, phase, phraseIndex, phrases, typeSpeed, deleteSpeed, pauseMs]);

  return displayed;
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleCopy}
      className="inline-flex items-center gap-3 bg-muted rounded-lg border border-border px-4 py-3 group max-w-full overflow-x-auto cursor-pointer hover:border-foreground/30 transition-colors"
    >
      <code className="font-mono text-[13px] text-foreground/80 whitespace-nowrap">
        <span className="text-muted-foreground select-none">$ </span>
        {command}
      </code>
      <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0">
        {copied ? (
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </span>
    </div>
  );
}

/**
 * Claude AI CTA section — "Ask Claude to build..." with cycling typewriter
 * and MCP install command. Reusable across landing page sections.
 */
export function ClaudeCTA() {
  const cyclingText = useCyclingTypewriter(CYCLING_PHRASES);

  return (
    <div className="text-center">
      <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">
        <div>Ask Claude to build...</div>
        <div className="text-green-400 font-mono mt-1">
          {cyclingText}
          <span className="inline-block w-[2px] h-[1em] bg-green-400 ml-0.5 align-middle animate-pulse" />
        </div>
      </h3>
      <CopyCommand command="claude mcp add simten npx @simten/mcp" />
    </div>
  );
}

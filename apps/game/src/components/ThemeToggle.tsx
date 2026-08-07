import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'auto';
  }

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored;
  }

  // Must match THEME_INIT_SCRIPT's fallback in `__root.tsx`. That script runs
  // before paint and settles on 'dark'; defaulting to 'auto' here made a
  // first-time visitor load dark and then flip to light a frame later.
  return 'dark';
}

/** Applies the mode and reports the appearance it resolved to. */
function applyThemeMode(mode: ThemeMode): 'light' | 'dark' {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;

  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(resolved);

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }

  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('auto');
  // Starts 'dark' to match the root element's server-rendered class, so the
  // first paint draws the waveform the page is actually showing.
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const initialMode = getInitialMode();
    setMode(initialMode);
    setResolved(applyThemeMode(initialMode));
  }, []);

  useEffect(() => {
    if (mode !== 'auto') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyThemeMode('auto'));

    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [mode]);

  /**
   * Flip to the opposite of what is on screen.
   *
   * This used to cycle light → dark → auto → light, which meant one press in
   * three did nothing visible: `auto` resolves to the system preference, so on
   * a dark-preferring machine `dark → auto` looks identical and the toggle
   * appeared to need two clicks. Choosing from `resolved` rather than `mode`
   * guarantees every press changes the thing the button is depicting.
   *
   * `auto` is still honoured when it is already stored — the media listener
   * above keeps following the system — but the toggle only ever writes an
   * explicit choice, because that is the only thing it can show.
   */
  function toggleMode() {
    const nextMode: ThemeMode = resolved === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    setResolved(applyThemeMode(nextMode));
    window.localStorage.setItem('theme', nextMode);
  }

  const label = `Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`;

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent"
    >
      {/*
        The same signal mark simten.dev uses: a line held low for dark, a pulse
        held high for light. Drawn from the *resolved* appearance rather than
        the mode, so it always depicts what you are looking at — `auto` has no
        third waveform, and the mode is on the tooltip where it belongs.
      */}
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 20 14"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden="true"
      >
        {resolved === 'dark' ? (
          <polyline points="1,12 19,12" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <polyline
            points="1,12 4,12 4,2 16,2 16,12 19,12"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </button>
  );
}

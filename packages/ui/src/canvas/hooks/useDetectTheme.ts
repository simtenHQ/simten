import { useState, useEffect } from 'react';

/**
 * Reactive theme detection from the `dark` class on `<html>`.
 * Falls back to `"light"` during SSR / when document is unavailable.
 */
export function useDetectTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light',
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(el.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

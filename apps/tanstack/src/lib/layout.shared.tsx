import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Turing Incomplete',
    },
    links: [],
    themeSwitch: { enabled: false },
  };
}

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Simten',
    },
    links: [],
    themeSwitch: { enabled: false },
  };
}

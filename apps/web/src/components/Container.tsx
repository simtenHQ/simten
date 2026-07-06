/**
 * Shared horizontal-constraint container for landing-page / docs sections.
 *
 * The pattern: full-width sections own their own background and vertical
 * rhythm; <Container> goes inside each section to constrain the *content*
 * to a comfortable read width. Same component used everywhere so content
 * edges line up vertically across sections — the visual "single
 * container" effect you see on cursor.com / vercel.com / linear.com is
 * actually consistent use of one component, not one literal wrapper.
 *
 * Variants:
 *   - `default` (max-w-7xl) — most landing-page content
 *   - `bleed` — escape hatch for sections that handle their own layout
 *               (e.g. full-bleed media, custom multi-column grids)
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const containerVariants = cva('mx-auto w-full', {
  variants: {
    size: {
      default: 'max-w-[1360px] px-4 sm:px-6 lg:px-8',
      bleed: 'max-w-none px-0',
    },
  },
  defaultVariants: { size: 'default' },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

export function Container({ className, size, ...props }: ContainerProps) {
  return <div className={cn(containerVariants({ size }), className)} {...props} />;
}

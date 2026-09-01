/**
 * The title block that opens a landing-page section.
 *
 * Exists because the three splash sections each hand-wrote the same
 * `text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]` string,
 * and one of them silently drifted to `text-2xl sm:text-3xl`. A duplicated
 * class string has nowhere to change, so divergence is invisible until
 * somebody eyeballs two headings side by side.
 *
 * Variants follow the `cva` pattern <Container> already uses:
 *   - `stacked` (default): title over description, capped at a read width.
 *   - `split`: title left, description right, for wider editorial blocks.
 *
 * `as` exists because the document outline is not a styling decision. A
 * section under an <h1> wants <h2> regardless of how big the text looks.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const sectionHeadingVariants = cva('', {
  variants: {
    layout: {
      stacked: 'max-w-2xl mb-10 lg:mb-12',
      split: 'flex flex-col md:flex-row md:gap-12 lg:gap-16 mb-8 md:mb-12',
    },
  },
  defaultVariants: { layout: 'stacked' },
});

type SectionHeadingProps = VariantProps<typeof sectionHeadingVariants> & {
  /** Heading level. Style is fixed; only the tag changes. */
  as?: 'h2' | 'h3';
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Rendered below the description. Pass the bare link; spacing is ours. */
  cta?: ReactNode;
  className?: string;
};

export function SectionHeading({
  as: Heading = 'h2',
  layout,
  eyebrow,
  title,
  description,
  cta,
  className,
}: SectionHeadingProps) {
  const split = layout === 'split';

  return (
    <div className={cn(sectionHeadingVariants({ layout }), className)}>
      <div className={split ? 'md:flex-1' : undefined}>
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            {eyebrow}
          </div>
        ) : null}
        <Heading
          className={cn(
            'text-3xl sm:text-4xl font-semibold text-foreground tracking-tight leading-[1.1]',
            split && 'max-w-[18ch]',
          )}
        >
          {title}
        </Heading>
      </div>

      {(description || cta) && (
        <div className={split ? 'md:flex-1 mt-4 md:mt-0' : undefined}>
          {description ? (
            <p
              className={cn(
                'leading-snug',
                split
                  ? 'text-lg text-foreground/75'
                  : 'mt-4 text-base lg:text-lg text-muted-foreground',
              )}
            >
              {description}
            </p>
          ) : null}
          {cta ? <div className="mt-4">{cta}</div> : null}
        </div>
      )}
    </div>
  );
}

type SectionProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Vertical rhythm for landing-page sections.
 *
 * Symmetric padding rather than a top margin, which is what cursor.com and
 * linear.com do: ~64px each side, so two adjacent sections give the ~128px
 * gap those sites use. Padding rather than margin means a section owns its
 * own spacing, so it can be reordered without a neighbour having to give up
 * an `mt-0` override, and a background colour covers the gap instead of
 * leaving a stripe above it.
 */
export function Section({ children, className = '' }: SectionProps) {
  return <section className={`py-16 md:py-20 ${className}`}>{children}</section>;
}

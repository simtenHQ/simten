import type { ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  cta?: ReactNode;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  cta,
  className = '',
}: SectionHeadingProps) {
  return (
    <div className={`flex flex-col md:flex-row md:gap-12 lg:gap-16 mb-8 md:mb-12 ${className}`}>
      <div className="md:flex-1">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-3">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight leading-[1.1] max-w-[18ch]">
          {title}
        </h3>
      </div>
      {(description || cta) && (
        <div className="md:flex-1 mt-4 md:mt-0">
          {description ? (
            <p className="text-lg text-foreground/75 leading-snug">{description}</p>
          ) : null}
          {cta ? <div className="mt-5">{cta}</div> : null}
        </div>
      )}
    </div>
  );
}

type SectionProps = {
  children: ReactNode;
  className?: string;
};

export function Section({ children, className = '' }: SectionProps) {
  return <section className={`mt-28 md:mt-36 ${className}`}>{children}</section>;
}

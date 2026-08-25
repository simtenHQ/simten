import { Link } from '@tanstack/react-router';
import { SiteHeader } from '@/components/SiteHeader';

export function MobileEditorNotice() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-sm">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path strokeLinecap="round" d="M8 20h8M12 16v4" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">The editor needs a desktop</h1>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            Building circuits relies on hover, drag, and a wide canvas, so it isn&apos;t comfortable
            on a small touchscreen yet. Please open this page on a laptop or desktop browser.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Back to home
            </Link>
            <div className="mt-2 text-xs text-muted-foreground">
              Or browse on mobile:{' '}
              <Link
                to="/docs/$"
                params={{ _splat: '' }}
                className="text-foreground underline-offset-2 hover:underline"
              >
                docs
              </Link>
              {' · '}
              <Link to="/blog" className="text-foreground underline-offset-2 hover:underline">
                blog
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

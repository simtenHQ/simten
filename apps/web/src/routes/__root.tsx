import { ShareCircuitProvider } from '@simten/embed';
import { SandboxProvider } from '@simten/ui/sandbox';
import { createRootRoute, HeadContent, Outlet, Scripts, useMatches } from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { shareCircuit } from '@/features/share/server';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { SiteNavLinks } from '../components/SiteNavLinks';
import { ThemeProvider } from '../components/ThemeProvider';

import appCss from '../styles.css?url';

// Bridge the TanStack Start server fn to the CircuitEmbed Fork button via
// context. Every Fork click goes through KV → short `/circuit/s/<hash>` URLs.
const shareCircuitFn = (source: string) => shareCircuit({ data: { source } });

// Tool routes render their own SiteHeader with custom right-slot content
// (the editor and the RV32I debugger pass tool controls instead of nav
// links). They also have no SiteFooter; tool pages stay focused. Routes
// opt out by setting `staticData: { skipDefaultChrome: true }`. We avoid a
// central route-ID list here because the literal $-placeholder strings
// (`/circuit_/$encoded`, etc.) would ship in the minified bundle and
// crawlers occasionally try to fetch them as URLs.

const SITE_URL = 'https://simten.dev';
const SITE_NAME = 'Simten';
const DEFAULT_TITLE = 'Simten | Hardware design in TypeScript';
const DEFAULT_DESCRIPTION =
  'Write hardware in TypeScript. Test it with npm. Run it on an FPGA. From single gates to RISC-V CPUs, simulated live in your browser.';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: DEFAULT_TITLE },
      { name: 'description', content: DEFAULT_DESCRIPTION },
      // Open Graph
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: DEFAULT_TITLE },
      { property: 'og:description', content: DEFAULT_DESCRIPTION },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: SITE_URL },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: DEFAULT_TITLE },
      { name: 'twitter:description', content: DEFAULT_DESCRIPTION },
      { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // `favicon.ico` first: it is the path crawlers try by convention, and
      // Google Search stopped showing a favicon here after the .ico was
      // removed in favour of an SVG alone. Browsers that prefer the SVG still
      // take it from the next line.
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
      { rel: 'manifest', href: '/manifest.json' },
      // Note: rel="canonical" is set per-route via pageHead() in lib/seo.ts,
      // not here. Two canonical tags would force Google to pick one at random.
      // Geist + Geist Mono are self-hosted; see /public/fonts and the
      // @font-face rules in styles.css. Preload both so they're fetched in
      // parallel with the HTML rather than discovered after CSS parses.
      {
        rel: 'preload',
        href: '/fonts/Geist-Variable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/GeistMono-Variable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const matches = useMatches();
  const skipDefaultChrome = matches.some(
    (m) =>
      (m.staticData as { skipDefaultChrome?: boolean } | undefined)?.skipDefaultChrome === true,
  );

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <RootProvider search={{ preload: false }}>
          <ThemeProvider defaultTheme="dark">
            <SandboxProvider>
              <ShareCircuitProvider value={shareCircuitFn}>
                {!skipDefaultChrome && <SiteHeader right={<SiteNavLinks />} />}
                <Outlet />
                {!skipDefaultChrome && <SiteFooter />}
              </ShareCircuitProvider>
            </SandboxProvider>
          </ThemeProvider>
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}

import { SandboxProvider } from '@simten/ui/sandbox';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, HeadContent, Scripts, useMatches } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import Header from '../components/Header';

import appCss from '../styles.css?url';

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

/**
 * The share preview is title, description and card, and the card carries no
 * words — so these two do all the work, and they are written to do different
 * jobs. The title is the hook and explains nothing. The description is the
 * reveal: this is not only a game, it is a real HDL you can put to work.
 *
 * "Hardware" rather than "a computer" on purpose. The campaign ends at a full
 * adder today and grows towards FPGA and accelerator work, so a noun that caps
 * the ceiling at one CPU would need rewriting the moment it stops being true.
 *
 * No level count either. It dates the moment a level is added, and nobody
 * searches for it.
 *
 * The claim is deliberately about the platform, not the player's solutions:
 * Simten synthesizes to Verilog, but the game has no export button, so "the
 * gates you wire here run on an FPGA" would be a promise that fails checking.
 */
const TITLE = 'Simten — build hardware. Bit by bit.';
const DESCRIPTION =
  'A puzzle campaign built on Simten, a TypeScript HDL that simulates in the browser and synthesizes to Verilog.';
const SITE_URL = 'https://play.simten.dev';
/**
 * Absolute, because scrapers do not resolve relative URLs. Byte-identical to
 * apps/web's card, so the two links read as one product rather than two. The
 * card carries no words at all — WhatsApp and iMessage render it as a small
 * thumbnail, where any tagline small enough to fit the layout is unreadable.
 * Source in `scripts/og-card.html`.
 */
const OG_IMAGE = `${SITE_URL}/og-default.png`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      // The campaign is meant to be passed around, and a link with no preview
      // card is a much weaker share than one with a title and an image.
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      // Describes the image, which is the wordmark and nothing else. Repeating
      // the description here would make a screen reader say it twice.
      { property: 'og:image:alt', content: 'Simten' },
      { property: 'og:site_name', content: 'Simten' },
      // `summary_large_image` rather than `summary`: with a 1200x630 card the
      // small variant crops it to a square thumbnail beside the text.
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  shellComponent: RootDocument,
});

/**
 * The level page is a tool screen — full viewport, its own top bar, no site
 * nav. It opts out with `staticData: { skipDefaultChrome: true }`, the same
 * mechanism apps/web uses for /circuit.
 */
function Chrome({ children }: { children: React.ReactNode }) {
  const matches = useMatches();
  const skip = matches.some(
    (m) => (m.staticData as { skipDefaultChrome?: boolean } | undefined)?.skipDefaultChrome,
  );
  if (skip) return <>{children}</>;
  return (
    <>
      <Header />
      {children}
    </>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // Dark by default, matching simten.dev/circuit.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {/* Player source compiles and runs in the sandbox iframe, never here. */}
        <SandboxProvider>
          <Chrome>{children}</Chrome>
        </SandboxProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

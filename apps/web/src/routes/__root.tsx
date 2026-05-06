import { HeadContent, Scripts, createRootRoute, useMatches } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '../components/ThemeProvider'
import { SiteHeader } from '../components/SiteHeader'
import { SiteNavLinks } from '../components/SiteNavLinks'
import { SiteFooter } from '../components/SiteFooter'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { SandboxProvider } from '@simten/ui/sandbox'

import appCss from '../styles.css?url'

// Tool routes render their own SiteHeader with custom right-slot content
// (the editor and the RV32I debugger pass tool controls instead of nav
// links). They also have no SiteFooter — tool pages stay focused.
const ROUTES_WITHOUT_DEFAULT_CHROME = new Set(['/editor', '/learn/rv32i-cpu'])

const SITE_URL = 'https://simten.dev'
const SITE_NAME = 'Simten'
const DEFAULT_TITLE = 'Simten — Hardware simulation in TypeScript'
const DEFAULT_DESCRIPTION =
  'Build and simulate digital circuits in TypeScript. From single gates to full RISC-V CPUs — all running live in the browser.'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`

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
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      // Note: rel="canonical" is set per-route via pageHead() in lib/seo.ts —
      // not here. Two canonical tags would force Google to pick one at random.
      // Geist + Geist Mono are self-hosted — see /public/fonts and the
      // @font-face rules in styles.css. Preload both so they're fetched in
      // parallel with the HTML rather than discovered after CSS parses.
      { rel: 'preload', href: '/fonts/Geist-Variable.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { rel: 'preload', href: '/fonts/GeistMono-Variable.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const matches = useMatches()
  const skipDefaultChrome = matches.some((m) => ROUTES_WITHOUT_DEFAULT_CHROME.has(m.routeId))

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <RootProvider search={{ preload: false }}>
          <ThemeProvider defaultTheme="dark">
            <SandboxProvider>
              {!skipDefaultChrome && <SiteHeader right={<SiteNavLinks />} />}
              <Outlet />
              {!skipDefaultChrome && <SiteFooter />}
            </SandboxProvider>
          </ThemeProvider>
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}

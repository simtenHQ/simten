import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '../components/ThemeProvider'
import { ThemeToggle } from '../components/ThemeToggle'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { SandboxProvider } from '@simten/ui/sandbox'

import appCss from '../styles.css?url'

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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <RootProvider search={{ preload: false }}>
          <ThemeProvider defaultTheme="dark">
            <SandboxProvider>
              <Outlet />
              <div className="fixed bottom-4 left-4 z-50">
                <ThemeToggle />
              </div>
            </SandboxProvider>
          </ThemeProvider>
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}

import { SandboxProvider } from '@simten/ui/sandbox';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, HeadContent, Scripts, useMatches } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import Header from '../components/Header';

import appCss from '../styles.css?url';

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Simten — build a computer',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
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

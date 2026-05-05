import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router'

export const Route = createFileRoute('/blog')({
  component: BlogLayout,
})

function BlogLayout() {
  const matches = useMatches()
  const isIndex = matches[matches.length - 1]?.pathname === '/blog' ||
                  matches[matches.length - 1]?.pathname === '/blog/'

  if (isIndex) {
    // Blog index has its own layout
    return <Outlet />
  }

  // Individual blog posts get the shared narrow content wrapper. Site nav now
  // lives in __root.tsx via SiteHeader, so no banner is needed here.
  return (
    <div className="bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <Outlet />
      </main>
    </div>
  )
}

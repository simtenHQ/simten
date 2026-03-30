import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router'
import { BlogBanner } from '@/features/blog/components/BlogBanner'

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

  // Individual blog posts get the shared wrapper + banner
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <BlogBanner />
        <Outlet />
      </main>
    </div>
  )
}

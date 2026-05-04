import { createFileRoute, Link } from '@tanstack/react-router'
import { posts, type PostCategory } from '@/features/blog/posts'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/blog/')({
  head: () =>
    pageHead({
      title: 'Blog',
      description:
        'Deep dives on hardware: AES, ChaCha20, RISC-V CPUs, network switches, TPUs. Every post backed by a live, simulated circuit.',
      path: '/blog',
    }),
  component: BlogIndex,
})

const CATEGORY_COLORS: Record<PostCategory, string> = {
  game: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-800/50',
  cpu: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-800/50',
  accelerator: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/50 dark:text-violet-400 dark:border-violet-800/50',
  networking: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-800/50',
  architecture: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-400 dark:border-cyan-800/50',
  interactive: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/50 dark:text-pink-400 dark:border-pink-800/50',
}

const CATEGORY_LABELS: Record<PostCategory, string> = {
  game: 'Game',
  cpu: 'CPU',
  accelerator: 'Accelerator',
  networking: 'Networking',
  architecture: 'Architecture',
  interactive: 'Interactive',
}

function BlogIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          &larr; Home
        </Link>
        <h1 className="text-3xl font-bold mt-6 mb-2">Blog</h1>
        <p className="text-muted-foreground text-sm mb-12">
          Articles about hardware design, simulation, and the tools we're building.
        </p>
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}` as string}
              className="block group rounded-lg border border-border hover:border-foreground/20 bg-card hover:bg-accent transition-all px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground group-hover:text-foreground transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[post.category]}`}>
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">{post.nodes}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

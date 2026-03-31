import { createFileRoute, Link } from '@tanstack/react-router'
import { posts, type PostCategory } from '@/features/blog/posts'

export const Route = createFileRoute('/blog/')({
  head: () => ({
    meta: [{ title: 'Blog | Turing Incomplete' }],
  }),
  component: BlogIndex,
})

const CATEGORY_COLORS: Record<PostCategory, string> = {
  game: 'bg-green-900/50 text-green-400 border-green-800/50',
  cpu: 'bg-blue-900/50 text-blue-400 border-blue-800/50',
  accelerator: 'bg-violet-900/50 text-violet-400 border-violet-800/50',
  networking: 'bg-amber-900/50 text-amber-400 border-amber-800/50',
  architecture: 'bg-cyan-900/50 text-cyan-400 border-cyan-800/50',
  interactive: 'bg-pink-900/50 text-pink-400 border-pink-800/50',
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
    <div className="min-h-screen bg-[#010409] text-gray-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="text-gray-600 hover:text-gray-600 dark:text-gray-300 transition-colors text-sm"
        >
          &larr; Home
        </Link>
        <h1 className="text-3xl font-bold mt-6 mb-2">Blog</h1>
        <p className="text-gray-500 text-sm mb-12">
          Articles about hardware design, simulation, and the tools we're building.
        </p>
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}` as string}
              className="block group rounded-lg border border-[#21262d] hover:border-[#30363d] bg-[#0d1117] hover:bg-[#161b22] transition-all px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-200 group-hover:text-gray-900 dark:text-white transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1.5 leading-relaxed">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[post.category]}`}>
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-600 font-mono">{post.nodes}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-500 dark:text-gray-400 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

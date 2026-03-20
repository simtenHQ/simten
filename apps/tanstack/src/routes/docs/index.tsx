import { createFileRoute, Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import readmeMd from '../../../../../docs/README.md?raw'
import dslRefMd from '../../../../../docs/dsl-reference.md?raw'
import componentModelMd from '../../../../../docs/component-model.md?raw'
import architectureMd from '../../../../../docs/architecture.md?raw'
import examplesMd from '../../../../../docs/examples.md?raw'

export const Route = createFileRoute('/docs/')({
  head: () => ({
    meta: [{ title: 'Docs | Turing Incomplete' }],
  }),
  component: DocsPage,
})

const sections = [
  { id: 'overview', title: 'Overview', content: readmeMd },
  { id: 'dsl-reference', title: 'DSL Reference', content: dslRefMd },
  { id: 'component-model', title: 'Component Model', content: componentModelMd },
  { id: 'architecture', title: 'Architecture', content: architectureMd },
  { id: 'examples', title: 'Examples', content: examplesMd },
]

function DocsPage() {
  return (
    <div className="min-h-screen bg-[#010409] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16 flex gap-12">
        {/* Sidebar */}
        <nav className="hidden md:block w-48 shrink-0 sticky top-16 self-start">
          <Link
            to="/"
            className="text-gray-600 hover:text-gray-300 transition-colors text-sm"
          >
            &larr; Home
          </Link>
          <h2 className="text-sm font-semibold text-gray-400 mt-6 mb-3 uppercase tracking-wider">
            Docs
          </h2>
          <ul className="space-y-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-gray-500 hover:text-gray-200 transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1 space-y-16">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-8">
              <div className="docs-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {s.content}
                </ReactMarkdown>
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ClientOnly } from '@/components/ClientOnly'

const EditorShell = lazy(() => import('@/components/EditorShell'))

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'System Simulator - Visual Editor' }],
  }),
  component: HomePage,
})

function HomePage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-gray-950" />}>
      <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
        <EditorShell />
      </Suspense>
    </ClientOnly>
  )
}

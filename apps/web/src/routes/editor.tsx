import { createFileRoute } from '@tanstack/react-router'
import EditorShell from '@/components/EditorShell'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/editor')({
  head: () =>
    pageHead({
      title: 'Editor',
      description:
        'Build, simulate, and debug digital circuits live in your browser. From single gates to multi-cycle pipelines — all in TypeScript.',
      path: '/editor',
    }),
  component: EditorShell,
})

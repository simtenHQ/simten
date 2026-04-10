import { createFileRoute } from '@tanstack/react-router'
import EditorShell from '@/components/EditorShell'

export const Route = createFileRoute('/editor')({
  head: () => ({
    meta: [{ title: 'Editor | Simten' }],
  }),
  component: EditorShell,
})

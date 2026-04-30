import { EditorWorkspace } from '@/features/visual-editor'
import { useCircuitTheme } from '@/hooks/useCircuitTheme'

export default function EditorShell() {
  const theme = useCircuitTheme()
  return <EditorWorkspace theme={theme} />
}

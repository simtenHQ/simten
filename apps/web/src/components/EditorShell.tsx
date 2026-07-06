import { DesktopOnly } from '@/components/DesktopOnly';
import { MobileEditorNotice } from '@/components/MobileEditorNotice';
import { EditorWorkspace } from '@/features/visual-editor';
import { useCircuitTheme } from '@/hooks/useCircuitTheme';

interface EditorShellProps {
  initialSource?: string;
  /** Running as the standalone local MCP viewer (no server, no router). */
  standalone?: boolean;
}

export default function EditorShell({ initialSource, standalone }: EditorShellProps = {}) {
  const theme = useCircuitTheme();
  const editor = (
    <EditorWorkspace theme={theme} initialSource={initialSource} standalone={standalone} />
  );
  // The standalone local MCP viewer is a desktop dev tool and has no router, so
  // skip the mobile gate — its MobileEditorNotice renders router <Link>s, which
  // DesktopOnly mounts (CSS-hidden) even on desktop and would crash here.
  if (standalone) return editor;
  return <DesktopOnly fallback={<MobileEditorNotice />}>{editor}</DesktopOnly>;
}

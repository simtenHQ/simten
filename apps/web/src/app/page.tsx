"use client";

import { VisualEditor } from "@/features/visual-editor";
import { useCircuitTheme } from "@/app/hooks/useCircuitTheme";

export default function Home() {
  const theme = useCircuitTheme();
  return <VisualEditor theme={theme} />;
}

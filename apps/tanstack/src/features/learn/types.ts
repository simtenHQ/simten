export interface LessonSection {
  id: string;
  heading?: string;
  body: string[];
  dsl: string;
  focus?: string | string[];
  /** Number of ticks to auto-run when this section becomes active */
  ticks?: number;
  nodePositions?: Record<string, { x: number; y: number }>;
}

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  sections: LessonSection[];
}

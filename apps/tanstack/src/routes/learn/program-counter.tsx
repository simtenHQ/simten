import { createFileRoute } from "@tanstack/react-router";
import { ScrollyLesson } from "@/features/learn/ScrollyLesson";
import { PROGRAM_COUNTER_LESSON } from "@/features/learn/lessons/program-counter";

export const Route = createFileRoute("/learn/program-counter")({
  head: () => ({
    meta: [{ title: `${PROGRAM_COUNTER_LESSON.title} | Turing Incomplete` }],
  }),
  component: () => <ScrollyLesson lesson={PROGRAM_COUNTER_LESSON} />,
});

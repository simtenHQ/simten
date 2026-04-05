"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { Link } from "@tanstack/react-router";
import { ComponentEmbed } from "@turing-incomplete/embed";
import type { Lesson, LessonSection } from "./types";

interface ScrollyLessonProps {
  lesson: Lesson;
}

function estimateReadTime(sections: LessonSection[]): number {
  const totalWords = sections
    .flatMap((s) => s.body)
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(totalWords / 200));
}

export function ScrollyLesson({ lesson }: ScrollyLessonProps) {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeSection = lesson.sections[activeSectionIndex];

  // IntersectionObserver: section whose top is closest to 40% of viewport
  // height becomes active.
  const sectionTopsRef = useRef<Map<number, number>>(new Map());

  const pickActiveSection = useCallback(() => {
    const threshold = window.innerHeight * 0.4;
    let bestIndex = 0;
    let bestDistance = Infinity;

    sectionTopsRef.current.forEach((top, index) => {
      const distance = Math.abs(top - threshold);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    setActiveSectionIndex(bestIndex);
  }, []);

  // Track section bounding rects on scroll and on mount.
  const updateSectionTops = useCallback(() => {
    if (!scrollContainerRef.current) return;

    sectionTopsRef.current.clear();
    sectionRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Position relative to the viewport (not the container)
      sectionTopsRef.current.set(index, rect.top);
    });

    pickActiveSection();
  }, [pickActiveSection]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateSectionTops, { passive: true });
    window.addEventListener("resize", updateSectionTops, { passive: true });

    // Initial measurement
    updateSectionTops();

    return () => {
      container.removeEventListener("scroll", updateSectionTops);
      window.removeEventListener("resize", updateSectionTops);
    };
  }, [updateSectionTops]);

  const readMinutes = estimateReadTime(lesson.sections);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-gray-100">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-gray-900 px-4 py-2">
        <Link
          to="/learn"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; Learn
        </Link>
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-sm font-semibold text-gray-200">
          {lesson.title}
        </span>
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-xs text-gray-600">{readMinutes} min read</span>

        {/* Section progress dots */}
        <div className="flex items-center gap-1 ml-2">
          {lesson.sections.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = sectionRefs.current[i];
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activeSectionIndex
                  ? "w-4 bg-blue-500"
                  : "w-1.5 bg-gray-700 hover:bg-gray-500"
              }`}
              aria-label={`Go to section ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: scrollable narrative (40%) */}
        <div
          ref={scrollContainerRef}
          className="w-[40%] overflow-y-auto border-r border-gray-800"
        >
          <div className="px-8 pt-12">
            {lesson.sections.map((section, index) => {
              const isActive = index === activeSectionIndex;
              return (
                <div
                  key={section.id}
                  ref={(el) => {
                    sectionRefs.current[index] = el;
                  }}
                  className={`mb-16 border-l-2 pl-6 transition-all duration-300 ${
                    isActive
                      ? "border-blue-500"
                      : "border-transparent"
                  }`}
                >
                  {section.heading && (
                    <h2
                      className={`mb-4 text-xl font-bold transition-colors duration-300 ${
                        isActive ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {section.heading}
                    </h2>
                  )}
                  <div className="space-y-3">
                    {section.body.map((paragraph, pIndex) => (
                      <p
                        key={pIndex}
                        className={`text-sm leading-relaxed transition-colors duration-300 ${
                          isActive ? "text-gray-300" : "text-gray-500"
                        }`}
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Extra padding so last section can scroll to active position */}
          <div style={{ height: "50vh" }} />
        </div>

        {/* Right: sticky circuit panel (60%) */}
        <div className="flex-1 overflow-hidden">
          <ComponentEmbed
            code={activeSection.dsl}
            height="100%"
            showControls
            nodePositions={activeSection.nodePositions}
            focus={activeSection.focus}
            showPortLabels
            autoRunSpeed={activeSection.ticks ? 600 : 500}
          />
        </div>
      </div>
    </div>
  );
}

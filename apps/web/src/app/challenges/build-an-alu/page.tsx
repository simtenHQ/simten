"use client";

import { useState, useCallback } from "react";
import { ALU_STEPS } from "./steps";
import { ChallengeWorkbench } from "./components/ChallengeWorkbench";

export default function ALUChallengePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = ALU_STEPS[currentStep];

  const handleNavigate = useCallback((stepId: string) => {
    const index = ALU_STEPS.findIndex((s) => s.id === stepId);
    if (index >= 0) setCurrentStep(index);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <section className="py-12 md:py-16">
          <div className="max-w-3xl">
            <a
              href="/challenges"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← All Challenges
            </a>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Build an ALU from Scratch
            </h1>
            <p className="mt-4 text-lg text-gray-400 leading-relaxed">
              Start with a single AND gate. End with the arithmetic heart of a
              CPU. Seven steps, zero magic — just logic gates all the way down.
            </p>
          </div>
        </section>

        {/* Step progress bar */}
        <div className="mb-8">
          <div className="flex gap-1 mb-2">
            {ALU_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < currentStep
                    ? "bg-green-500"
                    : i === currentStep
                    ? "bg-blue-500"
                    : "bg-gray-800"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {ALU_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(i)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  i === currentStep
                    ? "bg-blue-600 text-white"
                    : i < currentStep
                    ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                <span className="text-xs opacity-60 mr-1.5">
                  {i < currentStep ? "✓" : i + 1}
                </span>
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Current step */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Step {currentStep + 1}: {step.title}
            </h2>
            <p className="text-gray-300 leading-relaxed max-w-3xl">
              {step.concept}
            </p>
          </div>

          <ChallengeWorkbench step={step} challengeId="build-an-alu" onNavigate={handleNavigate} />

          {/* Step navigation footer */}
          <div className="flex justify-between pt-8 border-t border-gray-800">
            <button
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() =>
                setCurrentStep((s) =>
                  Math.min(ALU_STEPS.length - 1, s + 1)
                )
              }
              disabled={currentStep === ALU_STEPS.length - 1}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next Step →
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Turing Incomplete
          </a>
        </footer>
      </main>
    </div>
  );
}

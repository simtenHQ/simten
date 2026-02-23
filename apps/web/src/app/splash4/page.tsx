"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { CircuitSection } from "./CircuitSection";
import { SECTIONS } from "./sections";

export default function Splash4Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });

  // Parallax transforms for background layers
  const bgY1 = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const bgY2 = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <div ref={containerRef} className="bg-gray-950 text-white">
      {/* Fixed nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">Turing Incomplete</div>
          <Link
            href="/"
            className="px-5 py-2 bg-green-500 text-black rounded-lg text-sm font-semibold hover:bg-green-400 transition-colors"
          >
            Open Editor
          </Link>
        </div>
      </nav>

      {/* Parallax background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Grid layer 1 - slower */}
        <motion.div
          className="absolute inset-0 opacity-[0.03]"
          style={{ y: bgY1 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, #10b981 1px, transparent 1px),
                linear-gradient(to bottom, #10b981 1px, transparent 1px)
              `,
              backgroundSize: "80px 80px",
            }}
          />
        </motion.div>
        {/* Grid layer 2 - faster */}
        <motion.div
          className="absolute inset-0 opacity-[0.02]"
          style={{ y: bgY2 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, #10b981 1px, transparent 1px),
                linear-gradient(to bottom, #10b981 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </motion.div>
      </div>

      {/* Hero section */}
      <section className="min-h-screen flex items-center justify-center relative px-6">
        <div className="text-center max-w-3xl">
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Learn how computers
            <br />
            <span className="text-green-400">really work</span>
          </motion.h1>
          <motion.p
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Build a CPU from scratch, starting with a single logic gate.
            <br />
            No prior knowledge required.
          </motion.p>
          <motion.div
            className="flex items-center justify-center gap-4 text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <span>Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Circuit sections */}
      {SECTIONS.map((section, index) => (
        <CircuitSection
          key={section.id}
          section={section}
          index={index}
          isLast={index === SECTIONS.length - 1}
        />
      ))}

      {/* Final CTA */}
      <section className="min-h-[70vh] flex items-center justify-center px-6 relative">
        <div className="text-center max-w-2xl">
          <motion.h2
            className="text-4xl md:text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to build?
          </motion.h2>
          <motion.p
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            The same simulator powers a full visual editor.
            <br />
            Design circuits with code or drag-and-drop.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/"
              className="inline-block px-8 py-4 bg-green-500 text-black rounded-xl text-lg font-bold hover:bg-green-400 transition-colors"
            >
              Start Building
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          Built for learning. Inspired by Nand2Tetris.
        </div>
      </footer>
    </div>
  );
}

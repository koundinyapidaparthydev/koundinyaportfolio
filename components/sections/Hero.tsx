"use client";

/**
 * Hero.tsx — Obsidian Aurora edition.
 *
 * Layout: two-column on desktop (text left, cyber-circle photo right),
 *         single column on mobile (photo centred above text).
 *
 * Features:
 *  • Aurora-hued particle field (indigo / violet / cyan mix)
 *  • Rotating conic-gradient border ring around profile photo
 *  • Animated scan-line overlay + vignette on the photo
 *  • Framer Motion staggered letter reveal for the heading
 *  • Typewriter effect via useTypewriter for the role subtitle
 *  • "Open to work" badge, two CTA buttons with data-magnetic, scroll caret
 */

import { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTypewriter } from "@/hooks/useTypewriter";
import type { PersonalInfo } from "@/types/resume";
import {
  RESUME_DOWNLOAD_FILENAME,
  RESUME_PDF_API_PATH,
} from "@/lib/resumeDownload";

// ─── Particle data ────────────────────────────────────────────────────────────
// 50 particles generated deterministically so SSR and CSR produce identical
// output (avoids hydration mismatches from Math.random() on each render).

const PARTICLE_COUNT = 50;

interface Particle {
  id: number;
  left: string;
  top: string;
  size: string;
  duration: string;
  delay: string;
  xDrift: string;
  hue: number;
}

function buildParticles(): Particle[] {
  // Seeded pseudo-random via a simple LCG so values are stable across renders
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffff_ffff;
    return (seed >>> 0) / 0xffff_ffff;
  };
  const hues = [245, 265, 185]; // indigo, violet, cyan

  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: `${(rng() * 100).toFixed(2)}%`,
    top: `${(rng() * 100).toFixed(2)}%`,
    size: `${(rng() * 3 + 1).toFixed(1)}px`,
    duration: `${(rng() * 10 + 8).toFixed(1)}s`,
    delay: `${(rng() * 8).toFixed(1)}s`,
    xDrift: `${((rng() - 0.5) * 60).toFixed(1)}px`,
    hue: hues[i % 3],
  }));
}

const PARTICLES = buildParticles();

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const letterVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

// Shared fade-up initial / animate props (used directly, not as Variants,
// so we avoid Framer Motion v12 function-variant type restrictions)
const fadeUpInitial = { opacity: 0, y: 20 };
function fadeUpAnimate(delay: number) {
  return { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const, delay } };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParticleField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="hero-particle"
          style={
            {
              left: p.left,
              top: p.top,
              "--size": p.size,
              "--duration": p.duration,
              "--delay": p.delay,
              "--x-drift": p.xDrift,
              "--hue": p.hue,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
function OpenToWorkBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-chip mb-8 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Open to work
    </motion.div>
  );
}

/** Cyber-circle photo frame: rotating aurora border + scan-line overlay */
function CyberCirclePhoto() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.85, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex-shrink-0 lg:mx-0"
    >
      {/* Diffuse glow halo */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(99,102,241,0.6), rgba(124,58,237,0.6), rgba(6,182,212,0.5), rgba(99,102,241,0.6))",
        }}
      />

      {/* Photo frame */}
      <div className="relative" style={{ width: 300, height: 300 }}>
        {/* Rotating aurora gradient border */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #6366f1, #7c3aed, #06b6d4, #a78bfa, #06b6d4, #6366f1)",
          }}
        />

        {/* Photo container — stationary, 3 px inside border */}
        <div
          className="absolute overflow-hidden rounded-full bg-[#0a0a0a]"
          style={{ inset: "3px" }}
        >
          <Image
            src="/kp-photo.png"
            alt="Koundinya Pidaparthy"
            width={294}
            height={294}
            priority
            className="h-full w-full rounded-full object-cover object-top"
          />

          {/* Scan-line grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(99,102,241,0.045) 3px, rgba(99,102,241,0.045) 4px)",
            }}
          />

          {/* Moving scan beam */}
          <div
            aria-hidden="true"
            className="cyber-scan-beam pointer-events-none absolute inset-x-0 h-1/3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(99,102,241,0.18) 50%, transparent)",
            }}
          />

          {/* Vignette */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle, transparent 42%, rgba(10,10,10,0.62) 100%)",
            }}
          />
        </div>
      </div>

      {/* Orbiting dot 1 — indigo */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute"
        style={{ inset: "-12px" }}
        aria-hidden="true"
      >
        <div
          className="absolute h-3 w-3 rounded-full bg-indigo-400"
          style={{
            top: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            boxShadow: "0 0 12px 2px rgba(99,102,241,0.85)",
          }}
        />
      </motion.div>

      {/* Orbiting dot 2 — cyan, counter-clockwise */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute"
        style={{ inset: "-8px" }}
        aria-hidden="true"
      >
        <div
          className="absolute h-2 w-2 rounded-full bg-cyan-400"
          style={{
            bottom: "8%",
            right: "14%",
            boxShadow: "0 0 10px 2px rgba(6,182,212,0.85)",
          }}
        />
      </motion.div>

      {/* Orbiting dot 3 — violet, slow */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute"
        style={{ inset: "-16px" }}
        aria-hidden="true"
      >
        <div
          className="absolute h-2 w-2 rounded-full bg-violet-400"
          style={{
            top: "45%",
            left: "2%",
            boxShadow: "0 0 10px 2px rgba(124,58,237,0.8)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ROLES = [
  "Full-Stack Engineer",
  "AI Systems Builder",
  "MCP Server Architect",
  "AWS Cloud Engineer",
];

interface HeroProps {
  personalInfo: PersonalInfo;
}

export default function Hero({ personalInfo }: HeroProps) {
  const { name, summary } = personalInfo;
  const role = useTypewriter(ROLES);
  const sectionRef = useRef<HTMLElement>(null);

  // Split name into individual characters for the staggered reveal
  const letters = name.split("");

  // Truncate summary to a single readable line (first sentence or ≤120 chars)
  const bio = (() => {
    const firstSentence = summary.split(/\.\s/)[0];
    return firstSentence.length > 120
      ? firstSentence.slice(0, 117) + "…"
      : firstSentence;
  })();

  const scrollToProjects = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <style>{`
        .hero-particle {
          position: absolute;
          width: var(--size, 2px);
          height: var(--size, 2px);
          border-radius: 9999px;
          background: hsl(var(--hue, 245) 80% 70% / 0.55);
          animation: heroFloat var(--duration, 10s) ease-in-out var(--delay, 0s) infinite;
          will-change: transform, opacity;
        }

        @keyframes heroFloat {
          0%   { transform: translateY(0)     translateX(0)                          ; opacity: 0.2; }
          25%  { transform: translateY(-30px) translateX(calc(var(--x-drift) * 0.4)) ; opacity: 0.8; }
          50%  { transform: translateY(-60px) translateX(var(--x-drift))              ; opacity: 0.5; }
          75%  { transform: translateY(-30px) translateX(calc(var(--x-drift) * 0.6)) ; opacity: 0.9; }
          100% { transform: translateY(0)     translateX(0)                          ; opacity: 0.2; }
        }
      `}</style>

      <section
        ref={sectionRef}
        id="hero"
        className="relative flex min-h-screen overflow-hidden px-6 py-28 text-slate-900 dark:text-white"
      >
        <ParticleField />

        {/* Subtle indigo glow behind text column */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 65%)",
          }}
        />

        {/* ── Two-column content ── */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-20 my-auto">

          {/* Left: text */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            {/* Frosted dark panel behind the hero copy so it stays crisp over the bright day sky */}
            <div className="rounded-3xl bg-slate-950/30 p-6 backdrop-blur-lg ring-1 ring-white/10 lg:p-8">
              <OpenToWorkBadge />

              {/* Staggered letter reveal heading */}
              <motion.h1
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mb-6 font-bold tracking-tight"
                style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.1 }}
                aria-label={name}
              >
                {letters.map((char, i) => (
                  <motion.span
                    key={i}
                    variants={letterVariants}
                    className="inline-block"
                    style={char === " " ? { width: "0.3em" } : undefined}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.h1>

              {/* Typewriter subtitle */}
              <motion.div
                initial={fadeUpInitial}
                animate={fadeUpAnimate(0.4)}
                className="mb-6 flex items-center gap-2 text-xl text-slate-300 sm:text-2xl"
                aria-live="polite"
                aria-label={`Role: ${role}`}
              >
                <span className="font-mono text-indigo-400">&gt;</span>
                <span className="font-mono">
                  {role}
                  <span
                    className="ml-0.5 inline-block w-[2px] animate-pulse bg-indigo-400 align-middle"
                    style={{ height: "1.1em" }}
                  />
                </span>
              </motion.div>

              {/* Bio */}
              <motion.p
                initial={fadeUpInitial}
                animate={fadeUpAnimate(0.6)}
                className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
              >
                {bio}
              </motion.p>
            </div>

            {/* CTAs */}
            <motion.div
              initial={fadeUpInitial}
              animate={fadeUpAnimate(0.8)}
              className="flex flex-wrap items-center justify-center gap-4 lg:justify-start"
            >
              <button
                onClick={scrollToProjects}
                data-magnetic
                className="glass-btn-primary group relative overflow-hidden px-7 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span className="relative z-10">View my work</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-500 group-hover:translate-x-full"
                />
              </button>

              <a
                href={RESUME_PDF_API_PATH}
                download={RESUME_DOWNLOAD_FILENAME}
                data-magnetic
                className="glass-btn flex items-center gap-2 px-7 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download resume
              </a>
            </motion.div>
          </div>

          {/* Right: photo */}
          <div className="flex-shrink-0">
            <CyberCirclePhoto />
          </div>
        </div>

        {/* Scroll caret */}
        <motion.div
          initial={fadeUpInitial}
          animate={fadeUpAnimate(1.1)}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <button
            onClick={scrollToProjects}
            aria-label="Scroll down"
            className="flex flex-col items-center gap-1 text-slate-500 transition-colors hover:text-slate-300"
          >
            <span className="text-xs tracking-widest uppercase">scroll</span>
            <svg
              className="h-5 w-5 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </motion.div>
      </section>
    </>
  );
}

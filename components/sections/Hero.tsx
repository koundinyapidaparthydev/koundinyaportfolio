"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { PersonalInfo } from "@/types/resume";
import {
  RESUME_DOWNLOAD_FILENAME,
  RESUME_PDF_API_PATH,
} from "@/lib/resumeDownload";
import kpPhoto from "@/public/kp-photo.png";

interface HeroProps {
  personalInfo: PersonalInfo;
}

const fadeUpInitial = { opacity: 0, y: 20 };
const fadeUpAnimate = (delay = 0) => ({
  opacity: 1,
  y: 0,
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

export default function Hero({ personalInfo }: HeroProps) {
  const { name } = personalInfo;

  const scrollToProjects = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center px-6 py-28 text-white"
    >
      {/* Subtle dark scrim so text stays readable over the bright WebGL sky */}
      <div
        className="pointer-events-none absolute inset-0 sky-scrim"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col-reverse items-center gap-14 lg:flex-row lg:items-center lg:gap-20">
        {/* Left: text */}
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <motion.h1
            initial={fadeUpInitial}
            animate={fadeUpAnimate(0)}
            className="heading-gradient text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            {name}
          </motion.h1>

          <motion.p
            initial={fadeUpInitial}
            animate={fadeUpAnimate(0.1)}
            className="accent-gradient mt-4 text-xl font-semibold sm:text-2xl"
          >
            Software Engineer & AI Systems Builder
          </motion.p>

          <motion.p
            initial={fadeUpInitial}
            animate={fadeUpAnimate(0.2)}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200 text-shadow-hero"
          >
            Full-stack engineer with 5+ years shipping React, Next.js, Node.js
            and AI-powered products.
          </motion.p>

          <motion.div
            initial={fadeUpInitial}
            animate={fadeUpAnimate(0.3)}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <button onClick={scrollToProjects} className="btn-primary">
              View projects
            </button>
            <a
              href={RESUME_PDF_API_PATH}
              download={RESUME_DOWNLOAD_FILENAME}
              className="btn-secondary"
            >
              Download resume
            </a>
          </motion.div>
        </div>

        {/* Right: circular profile photo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex-shrink-0"
        >
          <div className="relative h-64 w-64 overflow-hidden rounded-full border-2 border-slate-700/50 bg-slate-900 shadow-2xl sm:h-80 sm:w-80 lg:h-96 lg:w-96">
            <Image
              src={kpPhoto}
              alt={name}
              fill
              priority
              className="object-cover object-top"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

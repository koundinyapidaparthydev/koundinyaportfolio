"use client";

/**
 * FadeInSection — wraps any section and fades + slides it up when it
 * enters the viewport. Uses Framer Motion useInView with `once: true`
 * so the animation only fires once per page load.
 */

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** amount of the element that must be in view before animating (0–1) */
  threshold?: number;
}

export function FadeInSection({
  children,
  className,
  delay = 0,
  threshold = 0.1,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

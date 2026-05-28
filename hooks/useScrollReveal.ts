"use client";

import { useState, useCallback } from "react";

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

/**
 * useScrollReveal – attaches an IntersectionObserver to reveal elements on scroll.
 * Returns a ref callback and a boolean `isVisible`.
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { threshold = 0.15, rootMargin = "0px" } = options;
  const [isVisible, setIsVisible] = useState(false);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold, rootMargin }
      );
      observer.observe(node);
    },
    [threshold, rootMargin]
  );

  return { ref, isVisible };
}

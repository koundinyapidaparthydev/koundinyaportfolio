/**
 * useTypewriter — cycles through an array of strings with a typewriter effect.
 *
 * @param phrases   Array of strings to cycle through
 * @param typeSpeed Milliseconds between each character typed   (default 80)
 * @param deleteSpeed Milliseconds between each character deleted (default 40)
 * @param pauseAfterType  Ms to pause after the full phrase is typed (default 1800)
 * @param pauseAfterDelete Ms to pause after the phrase is fully deleted (default 400)
 */

import { useEffect, useRef, useState } from "react";

interface UseTypewriterOptions {
  typeSpeed?: number;
  deleteSpeed?: number;
  pauseAfterType?: number;
  pauseAfterDelete?: number;
}

export function useTypewriter(
  phrases: string[],
  {
    typeSpeed = 60,
    deleteSpeed = 30,
    pauseAfterType = 5000,
    pauseAfterDelete = 600,
  }: UseTypewriterOptions = {}
): string {
  const [displayText, setDisplayText] = useState(phrases[0] ?? "");
  const phraseIndex = useRef(0);
  const charIndex = useRef(phrases[0]?.length ?? 0);
  const isDeleting = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phrases.length === 0) return;

    function tick() {
      const currentPhrase = phrases[phraseIndex.current];

      if (isDeleting.current) {
        // Remove one character
        charIndex.current -= 1;
        setDisplayText(currentPhrase.slice(0, charIndex.current));

        if (charIndex.current === 0) {
          // Finished deleting — move to next phrase
          isDeleting.current = false;
          phraseIndex.current = (phraseIndex.current + 1) % phrases.length;
          timeoutRef.current = setTimeout(tick, pauseAfterDelete);
        } else {
          timeoutRef.current = setTimeout(tick, deleteSpeed);
        }
      } else {
        // Add one character
        charIndex.current += 1;
        setDisplayText(currentPhrase.slice(0, charIndex.current));

        if (charIndex.current === currentPhrase.length) {
          // Finished typing — start deleting after pause
          isDeleting.current = true;
          timeoutRef.current = setTimeout(tick, pauseAfterType);
        } else {
          timeoutRef.current = setTimeout(tick, typeSpeed);
        }
      }
    }

    timeoutRef.current = setTimeout(tick, pauseAfterDelete);

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return displayText;
}

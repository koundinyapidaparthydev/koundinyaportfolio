"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom magnetic cursor — a lerp-smoothed ring + dot that follows the mouse.
 * Scales up over interactive elements (buttons, links, [data-magnetic]).
 * Hidden on touch devices and on small screens (md breakpoint).
 */
export function MagneticCursor() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // Real mouse target
  const target = useRef({ x: -200, y: -200 });
  // Lerp-smoothed current position
  const current = useRef({ x: -200, y: -200 });
  // Whether cursor is over an interactive element
  const hoveringRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Abort on touch devices — don't hide the native cursor unnecessarily
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;

    let rafId: number;

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };

      // Check if hovering an interactive element
      const el = e.target as Element;
      hoveringRef.current =
        el.closest("button, a, [data-magnetic], input, textarea, select") !== null;

      if (!visible) setVisible(true);
    };

    const lerp = () => {
      const FACTOR = 0.14;
      current.current.x += (target.current.x - current.current.x) * FACTOR;
      current.current.y += (target.current.y - current.current.y) * FACTOR;

      const x = current.current.x;
      const y = current.current.y;

      if (outerRef.current) {
        const size = hoveringRef.current ? 54 : 36;
        const offset = size / 2;
        outerRef.current.style.transform = `translate(${x - offset}px, ${y - offset}px)`;
        outerRef.current.style.width = `${size}px`;
        outerRef.current.style.height = `${size}px`;
      }
      if (innerRef.current) {
        innerRef.current.style.transform = `translate(${x - 3}px, ${y - 3}px)`;
      }

      rafId = requestAnimationFrame(lerp);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(lerp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only refs + stable setter used inside — no stale closure

  return (
    <>
      {/* Outer ring */}
      <div
        ref={outerRef}
        aria-hidden="true"
        style={{
          opacity: visible ? 1 : 0,
          width: 36,
          height: 36,
          // CSS transition handles the size change smoothly; transform is set by rAF (no transition)
          transition: "width 0.18s ease, height 0.18s ease, opacity 0.4s ease",
        }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full border border-indigo-400/70 mix-blend-difference hidden md:block"
      />
      {/* Inner dot */}
      <div
        ref={innerRef}
        aria-hidden="true"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-1.5 w-1.5 rounded-full bg-white mix-blend-difference hidden md:block"
      />
    </>
  );
}

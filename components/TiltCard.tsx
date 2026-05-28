"use client";

import { useRef, type ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt angle in degrees (default 5) */
  maxTilt?: number;
}

/**
 * Wraps children in a div that applies a subtle 3-D perspective tilt on
 * mouse move and spring-resets on mouse leave. Disabled on mobile.
 */
export function TiltCard({ children, className = "", maxTilt = 5 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.transform = `perspective(900px) rotateY(${(x * maxTilt).toFixed(2)}deg) rotateX(${(-y * maxTilt).toFixed(2)}deg)`;
    el.style.transition = "transform 0.08s linear";
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
    el.style.transition = "transform 0.5s ease";
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

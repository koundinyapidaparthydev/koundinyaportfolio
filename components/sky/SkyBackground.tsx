"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";

const SkyScene = dynamic(() => import("./SkyScene"), { ssr: false });

function webglAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface ErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/** if the WebGL scene crashes, keep the CSS gradient fallback instead */
class SkyErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Fixed full-viewport sky background. Sits at z-0 under all page content
 * (the navbar is z-50). The CSS gradient behind the canvas doubles as the
 * no-WebGL / no-JS fallback and flashes intentionally while the scene loads.
 */
export default function SkyBackground() {
  // start "failed" optimistically so SSR and first client render agree;
  // then flip to the real capability check after mount
  const [failed, setFailed] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setFailed(!webglAvailable());
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="sky-fallback absolute inset-0" />
      {!failed && (
        <SkyErrorBoundary onError={() => setFailed(true)}>
          <SkyScene paused={hidden} />
        </SkyErrorBoundary>
      )}
      {/* subtle scrim keeps light text readable over the bright day sky */}
      <div className="sky-scrim absolute inset-0" />
    </div>
  );
}

/**
 * app/opengraph-image.tsx
 *
 * Generates the og:image card for /  (1200×630 px).
 * Next.js automatically serves this at <origin>/opengraph-image and injects
 * the <meta property="og:image"> tag when referenced in metadata.
 *
 * Uses the built-in next/og ImageResponse — no extra packages needed.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Koundinya Pidaparthy — Full Stack Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Indigo radial glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, transparent 70%)",
          }}
        />

        {/* KP Avatar */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            boxShadow: "0 0 0 4px rgba(99,102,241,0.3)",
          }}
        >
          <span style={{ color: "white", fontSize: 48, fontWeight: 700 }}>KP</span>
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-1px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Koundinya Pidaparthy
        </div>

        {/* Role */}
        <div
          style={{
            fontSize: 28,
            color: "#818cf8",
            fontFamily: "monospace",
            marginBottom: 40,
          }}
        >
          &gt; Full-Stack Engineer · AI Builder
        </div>

        {/* Tech row */}
        <div style={{ display: "flex", gap: 12 }}>
          {["React", "Next.js", "Node.js", "TypeScript", "AWS"].map((tech) => (
            <div
              key={tech}
              style={{
                padding: "6px 16px",
                borderRadius: 9999,
                backgroundColor: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                fontSize: 18,
              }}
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}

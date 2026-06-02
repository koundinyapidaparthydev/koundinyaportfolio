#!/usr/bin/env node
/**
 * pdf-render-helper.cjs
 *
 * CommonJS script called as a subprocess by generate-applications.mjs.
 * Reads { resume } JSON from stdin, renders a PDF, writes PDF bytes to stdout.
 *
 * Usage:
 *   echo '<json>' | node scripts/pdf-render-helper.cjs
 *
 * Exit codes:
 *   0 — success, PDF bytes written to stdout
 *   1 — error, message on stderr
 */

"use strict";

// We need to register a JSX transform for @react-pdf/renderer + React.
// Use the @react-pdf/renderer package directly since it ships pre-built.

const React = require("react");
const { Document, Page, Text, View, StyleSheet, Link, renderToBuffer } = require("@react-pdf/renderer");

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT = "#1e40af";
const DARK   = "#111827";
const MID    = "#374151";
const LIGHT  = "#6b7280";
const RULE   = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: DARK,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 44,
    lineHeight: 1.45,
  },
  header:      { marginBottom: 10 },
  name:        { fontSize: 20, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  titleText:   { fontSize: 11, color: ACCENT, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  contactRow:  { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 2 },
  contactItem: { fontSize: 8.5, color: LIGHT },
  contactSep:  { fontSize: 8.5, color: RULE },
  section:     { marginBottom: 9 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    borderBottomWidth: 0.8,
    borderBottomColor: ACCENT,
    paddingBottom: 2,
    marginBottom: 5,
  },
  summaryText: { fontSize: 9.5, color: MID, lineHeight: 1.5 },
  expHeader:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  expCompany:  { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  expDate:     { fontSize: 8.5, color: LIGHT },
  expRole:     { fontSize: 9, color: ACCENT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  bullet:      { flexDirection: "row", marginBottom: 1.5, paddingLeft: 2 },
  bulletDot:   { width: 10, fontSize: 9, color: ACCENT },
  bulletText:  { flex: 1, fontSize: 9, color: MID, lineHeight: 1.45 },
  techRow:     { flexDirection: "row", flexWrap: "wrap", marginTop: 3, gap: 2 },
  techTag:     {
    fontSize: 7.5, color: ACCENT, backgroundColor: "#eff6ff",
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2,
  },
  skillRow:      { flexDirection: "row", marginBottom: 3 },
  skillCategory: { width: 90, fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK },
  skillList:     { flex: 1, fontSize: 9, color: MID },
  projHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  projName:   { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  projDate:   { fontSize: 8.5, color: LIGHT },
  projStack:  { fontSize: 8.5, color: LIGHT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  eduHeader:      { flexDirection: "row", justifyContent: "space-between" },
  eduInstitution: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  eduDate:        { fontSize: 8.5, color: LIGHT },
  eduDegree:      { fontSize: 9, color: MID },
});

function e(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

function Separator() {
  return e(Text, { style: styles.contactSep }, " · ");
}

function SectionTitle({ children }) {
  return e(Text, { style: styles.sectionTitle }, children);
}

function Bullet({ text }) {
  return e(View, { style: styles.bullet },
    e(Text, { style: styles.bulletDot }, "•"),
    e(Text, { style: styles.bulletText }, text)
  );
}

function ResumePdfDocument({ resume }) {
  const { personalInfo, experience, skills, projects, education } = resume;

  const contactItems = [
    personalInfo.email && e(Text, { key: "email", style: styles.contactItem }, personalInfo.email),
    personalInfo.email && e(Separator, { key: "s1" }),
    personalInfo.phone && e(Text, { key: "phone", style: styles.contactItem }, personalInfo.phone),
    personalInfo.phone && e(Separator, { key: "s2" }),
    personalInfo.location && e(Text, { key: "loc", style: styles.contactItem }, personalInfo.location),
    personalInfo.linkedin && e(Separator, { key: "s3" }),
    personalInfo.linkedin && e(
      Link,
      { key: "li", src: `https://${personalInfo.linkedin}`, style: styles.contactItem },
      personalInfo.linkedin
    ),
    personalInfo.github && e(Separator, { key: "s4" }),
    personalInfo.github && e(
      Link,
      { key: "gh", src: `https://${personalInfo.github}`, style: styles.contactItem },
      personalInfo.github
    ),
  ].filter(Boolean);

  return e(
    Document,
    { title: `${personalInfo.name} — Resume`, author: personalInfo.name, creator: "Koundinya Portfolio" },
    e(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      e(View, { style: styles.header },
        e(Text, { style: styles.name }, personalInfo.name),
        e(Text, { style: styles.titleText }, personalInfo.title),
        e(View, { style: styles.contactRow }, ...contactItems)
      ),
      // Summary
      personalInfo.summary && e(View, { style: styles.section },
        e(SectionTitle, null, "Summary"),
        e(Text, { style: styles.summaryText }, personalInfo.summary)
      ),
      // Experience
      e(View, { style: styles.section },
        e(SectionTitle, null, "Experience"),
        ...experience.map((exp) =>
          e(View, { key: exp.id, style: { marginBottom: 8 } },
            e(View, { style: styles.expHeader },
              e(Text, { style: styles.expCompany }, exp.companyName),
              e(Text, { style: styles.expDate }, exp.date)
            ),
            e(Text, { style: styles.expRole }, `${exp.role} · ${exp.location}`),
            ...exp.points.map((point, i) => e(Bullet, { key: i, text: point })),
            exp.technologies && exp.technologies.length > 0
              ? e(View, { style: styles.techRow },
                  ...exp.technologies.slice(0, 10).map((tech) =>
                    e(Text, { key: tech, style: styles.techTag }, tech)
                  )
                )
              : null
          )
        )
      ),
      // Skills
      e(View, { style: styles.section },
        e(SectionTitle, null, "Skills"),
        ...skills.map((cat) =>
          e(View, { key: cat.id, style: styles.skillRow },
            e(Text, { style: styles.skillCategory }, cat.title),
            e(Text, { style: styles.skillList }, cat.skills.join(" · "))
          )
        )
      ),
      // Projects
      e(View, { style: styles.section },
        e(SectionTitle, null, "Projects"),
        ...projects.slice(0, 3).map((proj) =>
          e(View, { key: proj.id, style: { marginBottom: 7 } },
            e(View, { style: styles.projHeader },
              e(Text, { style: styles.projName }, proj.name),
              e(Text, { style: styles.projDate }, proj.date)
            ),
            e(Text, { style: styles.projStack }, proj.stack.join(" · ")),
            ...proj.points.slice(0, 3).map((point, i) => e(Bullet, { key: i, text: point }))
          )
        )
      ),
      // Education
      e(View, { style: styles.section },
        e(SectionTitle, null, "Education"),
        ...education.map((edu) =>
          e(View, { key: edu.id, style: { marginBottom: 5 } },
            e(View, { style: styles.eduHeader },
              e(Text, { style: styles.eduInstitution }, edu.institution),
              e(Text, { style: styles.eduDate }, edu.graduationDate)
            ),
            e(Text, { style: styles.eduDegree },
              `${edu.degree} in ${edu.field}${edu.gpa ? `  ·  GPA: ${edu.gpa}` : ""}${edu.location ? `  ·  ${edu.location}` : ""}`
            ),
            ...(edu.achievements ?? []).map((a, i) => e(Bullet, { key: i, text: a }))
          )
        )
      )
    )
  );
}

async function main() {
  let inputData = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  let resume;
  try {
    resume = JSON.parse(inputData);
  } catch (err) {
    process.stderr.write("❌ Failed to parse resume JSON: " + err.message + "\n");
    process.exit(1);
  }

  try {
    const el = e(ResumePdfDocument, { resume });
    const pdfBuffer = Buffer.from(await renderToBuffer(el));
    process.stdout.write(pdfBuffer);
  } catch (err) {
    process.stderr.write("❌ PDF render failed: " + err.message + "\n");
    process.exit(1);
  }
}

main();

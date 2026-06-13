#!/usr/bin/env node
/**
 * pdf-render-helper.cjs
 *
 * CommonJS script called as a subprocess by generate-applications.mjs.
 * Reads resume JSON from stdin, renders an ATS-friendly PDF, writes bytes to stdout.
 */

"use strict";

const React = require("react");
const { Document, Page, Text, View, StyleSheet, Link, renderToBuffer } = require("@react-pdf/renderer");

const BLACK = "#000000";
const DARK  = "#1a1a1a";
const MID   = "#333333";
const LIGHT = "#555555";
const RULE  = "#cccccc";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    backgroundColor: "#ffffff",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  header:      { marginBottom: 12 },
  name:        { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLACK, marginBottom: 2 },
  titleText:   { fontSize: 11, color: MID, marginBottom: 6 },
  contactRow:  { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  contactItem: { fontSize: 9, color: LIGHT },
  contactSep:  { fontSize: 9, color: LIGHT },
  section:     { marginBottom: 10 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingBottom: 2,
    marginBottom: 6,
  },
  summaryText: { fontSize: 10, color: MID, lineHeight: 1.45 },
  expHeader:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  expCompany:  { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  expDate:     { fontSize: 9, color: LIGHT },
  expRole:     { fontSize: 9.5, color: MID, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  bullet:      { flexDirection: "row", marginBottom: 2, paddingLeft: 0 },
  bulletDot:   { width: 12, fontSize: 10, color: BLACK },
  bulletText:  { flex: 1, fontSize: 9.5, color: MID, lineHeight: 1.4 },
  techLine:    { fontSize: 8.5, color: LIGHT, marginTop: 2, fontFamily: "Helvetica-Oblique" },
  skillRow:      { flexDirection: "row", marginBottom: 3 },
  skillCategory: { width: 100, fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLACK },
  skillList:     { flex: 1, fontSize: 9.5, color: MID },
  projHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  projName:   { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  projDate:   { fontSize: 9, color: LIGHT },
  projStack:  { fontSize: 9, color: LIGHT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  eduHeader:      { flexDirection: "row", justifyContent: "space-between" },
  eduInstitution: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  eduDate:        { fontSize: 9, color: LIGHT },
  eduDegree:      { fontSize: 9.5, color: MID },
});

function e(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

function Separator() {
  return e(Text, { style: styles.contactSep }, " | ");
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

  const contactParts = [];
  if (personalInfo.email) {
    contactParts.push(e(Text, { key: "email", style: styles.contactItem }, personalInfo.email));
  }
  if (personalInfo.phone) {
    if (contactParts.length) contactParts.push(e(Separator, { key: "s1" }));
    contactParts.push(e(Text, { key: "phone", style: styles.contactItem }, personalInfo.phone));
  }
  if (personalInfo.location) {
    if (contactParts.length) contactParts.push(e(Separator, { key: "s2" }));
    contactParts.push(e(Text, { key: "loc", style: styles.contactItem }, personalInfo.location));
  }
  if (personalInfo.linkedin) {
    if (contactParts.length) contactParts.push(e(Separator, { key: "s3" }));
    contactParts.push(
      e(Link, { key: "li", src: `https://${personalInfo.linkedin}`, style: styles.contactItem }, personalInfo.linkedin)
    );
  }
  if (personalInfo.github) {
    if (contactParts.length) contactParts.push(e(Separator, { key: "s4" }));
    contactParts.push(
      e(Link, { key: "gh", src: `https://${personalInfo.github}`, style: styles.contactItem }, personalInfo.github)
    );
  }

  return e(
    Document,
    { title: `${personalInfo.name} — Resume`, author: personalInfo.name, creator: "Koundinya Portfolio" },
    e(
      Page,
      { size: "LETTER", style: styles.page },
      e(View, { style: styles.header },
        e(Text, { style: styles.name }, personalInfo.name),
        personalInfo.title
          ? e(Text, { style: styles.titleText }, personalInfo.title)
          : null,
        e(View, { style: styles.contactRow }, ...contactParts)
      ),
      personalInfo.summary && e(View, { style: styles.section },
        e(SectionTitle, null, "Summary"),
        e(Text, { style: styles.summaryText }, personalInfo.summary)
      ),
      e(View, { style: styles.section },
        e(SectionTitle, null, "Skills"),
        ...skills.map((cat) =>
          e(View, { key: cat.id, style: styles.skillRow },
            e(Text, { style: styles.skillCategory }, cat.title),
            e(Text, { style: styles.skillList }, cat.skills.join(", "))
          )
        )
      ),
      e(View, { style: styles.section },
        e(SectionTitle, null, "Experience"),
        ...experience.map((exp) =>
          e(View, { key: exp.id, style: { marginBottom: 8 } },
            e(View, { style: styles.expHeader },
              e(Text, { style: styles.expCompany }, exp.companyName),
              e(Text, { style: styles.expDate }, exp.date)
            ),
            e(Text, { style: styles.expRole }, `${exp.role} — ${exp.location}`),
            ...exp.points.map((point, i) => e(Bullet, { key: i, text: point })),
            exp.technologies && exp.technologies.length > 0
              ? e(Text, { style: styles.techLine }, exp.technologies.slice(0, 12).join(", "))
              : null
          )
        )
      ),
      projects.length > 0 && e(View, { style: styles.section },
        e(SectionTitle, null, "Projects"),
        ...projects.slice(0, 3).map((proj) =>
          e(View, { key: proj.id, style: { marginBottom: 7 } },
            e(View, { style: styles.projHeader },
              e(Text, { style: styles.projName }, proj.name),
              e(Text, { style: styles.projDate }, proj.date)
            ),
            e(Text, { style: styles.projStack }, proj.stack.join(", ")),
            ...proj.points.slice(0, 3).map((point, i) => e(Bullet, { key: i, text: point }))
          )
        )
      ),
      e(View, { style: styles.section },
        e(SectionTitle, null, "Education"),
        ...education.map((edu) =>
          e(View, { key: edu.id, style: { marginBottom: 5 } },
            e(View, { style: styles.eduHeader },
              e(Text, { style: styles.eduInstitution }, edu.institution),
              e(Text, { style: styles.eduDate }, edu.graduationDate)
            ),
            e(Text, { style: styles.eduDegree },
              `${edu.degree} in ${edu.field}${edu.gpa ? ` — GPA: ${edu.gpa}` : ""}${edu.location ? ` — ${edu.location}` : ""}`
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

// Server-only — rendered via @react-pdf/renderer in API routes, never imported by client components.
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { Resume } from "@/types/resume";

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT = "#1e40af"; // blue-800
const DARK   = "#111827"; // gray-900
const MID    = "#374151"; // gray-700
const LIGHT  = "#6b7280"; // gray-500
const RULE   = "#e5e7eb"; // gray-200

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
  // ── Header ──
  header: { marginBottom: 10 },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  title: { fontSize: 11, color: ACCENT, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 2 },
  contactItem: { fontSize: 8.5, color: LIGHT },
  contactSep: { fontSize: 8.5, color: RULE },
  // ── Section ──
  section: { marginBottom: 9 },
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
  // ── Summary ──
  summaryText: { fontSize: 9.5, color: MID, lineHeight: 1.5 },
  // ── Experience ──
  expHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  expCompany: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  expDate: { fontSize: 8.5, color: LIGHT },
  expRole: { fontSize: 9, color: ACCENT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 2 },
  bulletDot: { width: 10, fontSize: 9, color: ACCENT },
  bulletText: { flex: 1, fontSize: 9, color: MID, lineHeight: 1.45 },
  techRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 3, gap: 2 },
  techTag: {
    fontSize: 7.5,
    color: ACCENT,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  // ── Skills ──
  skillRow: { flexDirection: "row", marginBottom: 3 },
  skillCategory: { width: 90, fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK },
  skillList: { flex: 1, fontSize: 9, color: MID },
  // ── Projects ──
  projHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  projName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  projDate: { fontSize: 8.5, color: LIGHT },
  projStack: { fontSize: 8.5, color: LIGHT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  // ── Education ──
  eduHeader: { flexDirection: "row", justifyContent: "space-between" },
  eduInstitution: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  eduDate: { fontSize: 8.5, color: LIGHT },
  eduDegree: { fontSize: 9, color: MID },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function Separator() {
  return <Text style={styles.contactSep}> · </Text>;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

export function ResumePdfDocument({ resume }: { resume: Resume }) {
  const { personalInfo, experience, skills, projects, education } = resume;

  return (
    <Document
      title={`${personalInfo.name} — Resume`}
      author={personalInfo.name}
      creator="Koundinya Portfolio"
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.name}>{personalInfo.name}</Text>
          <Text style={styles.title}>{personalInfo.title}</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactItem}>{personalInfo.email}</Text>
            <Separator />
            <Text style={styles.contactItem}>{personalInfo.phone}</Text>
            <Separator />
            <Text style={styles.contactItem}>{personalInfo.location}</Text>
            <Separator />
            <Link src={`https://${personalInfo.linkedin}`} style={styles.contactItem}>
              {personalInfo.linkedin}
            </Link>
            {personalInfo.github && (
              <>
                <Separator />
                <Link src={`https://${personalInfo.github}`} style={styles.contactItem}>
                  {personalInfo.github}
                </Link>
              </>
            )}
            {personalInfo.portfolio && (
              <>
                <Separator />
                <Text style={styles.contactItem}>{personalInfo.portfolio}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Summary ── */}
        {personalInfo.summary && (
          <View style={styles.section}>
            <SectionTitle>Summary</SectionTitle>
            <Text style={styles.summaryText}>{personalInfo.summary}</Text>
          </View>
        )}

        {/* ── Experience ── */}
        <View style={styles.section}>
          <SectionTitle>Experience</SectionTitle>
          {experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 8 }}>
              <View style={styles.expHeader}>
                <Text style={styles.expCompany}>{exp.companyName}</Text>
                <Text style={styles.expDate}>{exp.date}</Text>
              </View>
              <Text style={styles.expRole}>
                {exp.role} · {exp.location}
              </Text>
              {exp.points.map((point, i) => (
                <Bullet key={i} text={point} />
              ))}
              {exp.technologies && exp.technologies.length > 0 && (
                <View style={styles.techRow}>
                  {exp.technologies.slice(0, 10).map((tech) => (
                    <Text key={tech} style={styles.techTag}>{tech}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Skills ── */}
        <View style={styles.section}>
          <SectionTitle>Skills</SectionTitle>
          {skills.map((cat) => (
            <View key={cat.id} style={styles.skillRow}>
              <Text style={styles.skillCategory}>{cat.title}</Text>
              <Text style={styles.skillList}>{cat.skills.join(" · ")}</Text>
            </View>
          ))}
        </View>

        {/* ── Projects ── */}
        <View style={styles.section}>
          <SectionTitle>Projects</SectionTitle>
          {projects.slice(0, 3).map((proj) => (
            <View key={proj.id} style={{ marginBottom: 7 }}>
              <View style={styles.projHeader}>
                <Text style={styles.projName}>{proj.name}</Text>
                <Text style={styles.projDate}>{proj.date}</Text>
              </View>
              <Text style={styles.projStack}>{proj.stack.join(" · ")}</Text>
              {proj.points.slice(0, 3).map((point, i) => (
                <Bullet key={i} text={point} />
              ))}
            </View>
          ))}
        </View>

        {/* ── Education ── */}
        <View style={styles.section}>
          <SectionTitle>Education</SectionTitle>
          {education.map((edu) => (
            <View key={edu.id} style={{ marginBottom: 5 }}>
              <View style={styles.eduHeader}>
                <Text style={styles.eduInstitution}>{edu.institution}</Text>
                <Text style={styles.eduDate}>{edu.graduationDate}</Text>
              </View>
              <Text style={styles.eduDegree}>
                {edu.degree} in {edu.field}
                {edu.gpa ? `  ·  GPA: ${edu.gpa}` : ""}
                {edu.location ? `  ·  ${edu.location}` : ""}
              </Text>
              {edu.achievements?.map((a, i) => (
                <Bullet key={i} text={a} />
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// ── Cover Letter ──────────────────────────────────────────────────────────────

export function CoverLetterPdfDocument({
  name,
  title,
  email,
  phone,
  companyName,
  jobTitle,
  coverLetter,
}: {
  name: string;
  title: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  coverLetter: string;
}) {
  const clStyles = StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      fontSize: 10.5,
      color: DARK,
      paddingTop: 60,
      paddingBottom: 60,
      paddingHorizontal: 60,
      lineHeight: 1.6,
    },
    sender: { marginBottom: 24 },
    senderName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK },
    senderTitle: { fontSize: 10, color: ACCENT },
    senderContact: { fontSize: 9, color: LIGHT, marginTop: 2 },
    date: { fontSize: 10, color: LIGHT, marginBottom: 20 },
    salutation: { fontSize: 10.5, marginBottom: 12 },
    body: { fontSize: 10.5, color: MID, marginBottom: 14, lineHeight: 1.65 },
    closing: { fontSize: 10.5, marginTop: 24, marginBottom: 6 },
    signature: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK },
  });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Split cover letter into paragraphs
  const paragraphs = coverLetter
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document title={`Cover Letter — ${companyName}`} author={name}>
      <Page size="LETTER" style={clStyles.page}>
        <View style={clStyles.sender}>
          <Text style={clStyles.senderName}>{name}</Text>
          <Text style={clStyles.senderTitle}>{title}</Text>
          <Text style={clStyles.senderContact}>
            {email}  ·  {phone}
          </Text>
        </View>

        <Text style={clStyles.date}>{today}</Text>

        <Text style={clStyles.salutation}>
          Hiring Team at {companyName},
        </Text>

        {paragraphs.map((para, i) => (
          <Text key={i} style={clStyles.body}>
            {para}
          </Text>
        ))}

        <Text style={clStyles.closing}>Warm regards,</Text>
        <Text style={clStyles.signature}>{name}</Text>
        <Text style={{ fontSize: 9, color: LIGHT, marginTop: 2 }}>
          Applying for: {jobTitle}
        </Text>
      </Page>
    </Document>
  );
}

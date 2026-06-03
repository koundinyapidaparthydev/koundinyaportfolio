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

// ATS-friendly palette: black / gray on white only (no accent colors)
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
  header: { marginBottom: 12 },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    marginBottom: 2,
  },
  title: {
    fontSize: 11,
    color: MID,
    fontFamily: "Helvetica",
    marginBottom: 6,
  },
  contactRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  contactItem: { fontSize: 9, color: LIGHT },
  contactSep: { fontSize: 9, color: LIGHT },
  section: { marginBottom: 10 },
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
  expHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  expCompany: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  expDate: { fontSize: 9, color: LIGHT },
  expRole: { fontSize: 9.5, color: MID, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 0 },
  bulletDot: { width: 12, fontSize: 10, color: BLACK },
  bulletText: { flex: 1, fontSize: 9.5, color: MID, lineHeight: 1.4 },
  techLine: { fontSize: 8.5, color: LIGHT, marginTop: 2, fontFamily: "Helvetica-Oblique" },
  skillRow: { flexDirection: "row", marginBottom: 3 },
  skillCategory: { width: 100, fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLACK },
  skillList: { flex: 1, fontSize: 9.5, color: MID },
  projHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  projName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  projDate: { fontSize: 9, color: LIGHT },
  projStack: { fontSize: 9, color: LIGHT, fontFamily: "Helvetica-Oblique", marginBottom: 3 },
  eduHeader: { flexDirection: "row", justifyContent: "space-between" },
  eduInstitution: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  eduDate: { fontSize: 9, color: LIGHT },
  eduDegree: { fontSize: 9.5, color: MID },
});

function Separator() {
  return <Text style={styles.contactSep}> | </Text>;
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

export function ResumePdfDocument({ resume }: { resume: Resume }) {
  const { personalInfo, experience, skills, projects, education } = resume;

  return (
    <Document
      title={`${personalInfo.name} — Resume`}
      author={personalInfo.name}
      creator="Koundinya Portfolio"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{personalInfo.name}</Text>
          <Text style={styles.title}>{personalInfo.title}</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactItem}>{personalInfo.email}</Text>
            <Separator />
            <Text style={styles.contactItem}>{personalInfo.phone}</Text>
            <Separator />
            <Text style={styles.contactItem}>{personalInfo.location}</Text>
            {personalInfo.linkedin && (
              <>
                <Separator />
                <Link src={`https://${personalInfo.linkedin}`} style={styles.contactItem}>
                  {personalInfo.linkedin}
                </Link>
              </>
            )}
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

        {personalInfo.summary && (
          <View style={styles.section}>
            <SectionTitle>Summary</SectionTitle>
            <Text style={styles.summaryText}>{personalInfo.summary}</Text>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle>Skills</SectionTitle>
          {skills.map((cat) => (
            <View key={cat.id} style={styles.skillRow}>
              <Text style={styles.skillCategory}>{cat.title}</Text>
              <Text style={styles.skillList}>{cat.skills.join(", ")}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle>Experience</SectionTitle>
          {experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 8 }}>
              <View style={styles.expHeader}>
                <Text style={styles.expCompany}>{exp.companyName}</Text>
                <Text style={styles.expDate}>{exp.date}</Text>
              </View>
              <Text style={styles.expRole}>
                {exp.role} — {exp.location}
              </Text>
              {exp.points.map((point, i) => (
                <Bullet key={i} text={point} />
              ))}
              {exp.technologies && exp.technologies.length > 0 && (
                <Text style={styles.techLine}>
                  {exp.technologies.slice(0, 12).join(", ")}
                </Text>
              )}
            </View>
          ))}
        </View>

        {projects.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Projects</SectionTitle>
            {projects.slice(0, 3).map((proj) => (
              <View key={proj.id} style={{ marginBottom: 7 }}>
                <View style={styles.projHeader}>
                  <Text style={styles.projName}>{proj.name}</Text>
                  <Text style={styles.projDate}>{proj.date}</Text>
                </View>
                <Text style={styles.projStack}>{proj.stack.join(", ")}</Text>
                {proj.points.slice(0, 3).map((point, i) => (
                  <Bullet key={i} text={point} />
                ))}
              </View>
            ))}
          </View>
        )}

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
                {edu.gpa ? ` — GPA: ${edu.gpa}` : ""}
                {edu.location ? ` — ${edu.location}` : ""}
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
      fontSize: 11,
      color: DARK,
      backgroundColor: "#ffffff",
      paddingTop: 60,
      paddingBottom: 60,
      paddingHorizontal: 60,
      lineHeight: 1.55,
    },
    sender: { marginBottom: 24 },
    senderName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BLACK },
    senderTitle: { fontSize: 10, color: MID },
    senderContact: { fontSize: 9, color: LIGHT, marginTop: 2 },
    date: { fontSize: 10, color: LIGHT, marginBottom: 20 },
    salutation: { fontSize: 11, marginBottom: 12, color: BLACK },
    body: { fontSize: 11, color: MID, marginBottom: 14, lineHeight: 1.6 },
    closing: { fontSize: 11, marginTop: 24, marginBottom: 6, color: BLACK },
    signature: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLACK },
  });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
            {email} | {phone}
          </Text>
        </View>

        <Text style={clStyles.date}>{today}</Text>

        <Text style={clStyles.salutation}>Hiring Team at {companyName},</Text>

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

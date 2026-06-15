// Server-only — rendered via @react-pdf/renderer in API routes, never imported by client components.
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Resume, Experience, Project, SkillCategory, Education } from "@/types/resume";

// Matches ResumePreview.tsx — black/gray on white, centered header, same section order.
const BLACK = "#0f172a";
const DARK = "#334155";
const MID = "#475569";
const LIGHT = "#64748b";
const RULE = "#1e293b";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    backgroundColor: "#ffffff",
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 44,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 8,
    width: "100%",
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textAlign: "center",
    width: "100%",
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    color: MID,
    textAlign: "center",
    width: "100%",
    marginBottom: 6,
  },
  contactLine: {
    fontSize: 9,
    color: LIGHT,
    textAlign: "center",
    width: "100%",
    lineHeight: 1.6,
    marginTop: 2,
    marginBottom: 6,
  },
  summary: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    lineHeight: 1.45,
    marginTop: 10,
    marginBottom: 12,
    textAlign: "justify",
    width: "100%",
  },
  section: { marginTop: 14, marginBottom: 4 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    borderBottomWidth: 1.5,
    borderBottomColor: RULE,
    paddingBottom: 2,
    marginBottom: 6,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  company: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: BLACK },
  date: { fontSize: 9, color: LIGHT },
  role: { fontSize: 10, fontFamily: "Helvetica-Oblique", color: MID },
  location: { fontSize: 9, color: LIGHT },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 2 },
  bulletDot: { width: 10, fontSize: 9, color: BLACK },
  bulletText: { flex: 1, fontSize: 9.5, color: DARK, lineHeight: 1.4 },
  techLine: { fontSize: 9, color: LIGHT, marginTop: 2 },
  techLabel: { fontFamily: "Helvetica-Bold", color: MID },
  skillRow: { flexDirection: "row", marginBottom: 2, flexWrap: "wrap" },
  skillTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  skillList: { fontSize: 9.5, color: DARK, flex: 1 },
  projStack: { fontSize: 9, color: LIGHT, marginBottom: 2 },
  projDesc: { fontSize: 9.5, color: DARK, lineHeight: 1.4, marginBottom: 2 },
  eduDegree: { fontSize: 10, color: MID },
});

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** Plain-text contact row — react-pdf overlaps when mixing Fragment, Link, and raw strings. */
function ContactLine({ parts }: { parts: { text: string }[] }) {
  if (parts.length === 0) return null;
  return <Text style={styles.contactLine}>{parts.map((p) => p.text).join(" · ")}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function ExperienceBlock({ exp }: { exp: Experience }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.company}>{exp.companyName}</Text>
        <Text style={styles.date}>{exp.date}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.role}>{exp.role}</Text>
        <Text style={styles.location}>{exp.location}</Text>
      </View>
      {exp.points.map((point, i) => (
        <Bullet key={i} text={point} />
      ))}
      {exp.otherRoles?.map((role, i) => (
        <View key={i} style={{ marginTop: 4, marginLeft: 4 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.role}>{role.role}</Text>
            <Text style={styles.date}>{role.date}</Text>
          </View>
          {role.points.map((point, j) => (
            <Bullet key={j} text={point} />
          ))}
        </View>
      ))}
      {exp.technologies && exp.technologies.length > 0 && (
        <Text style={styles.techLine}>
          <Text style={styles.techLabel}>Tech: </Text>
          {exp.technologies.join(" · ")}
        </Text>
      )}
    </View>
  );
}

function ProjectBlock({ project }: { project: Project }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.company}>{project.name}</Text>
        <Text style={styles.date}>{project.date}</Text>
      </View>
      {project.stack.length > 0 && (
        <Text style={styles.projStack}>{project.stack.join(" · ")}</Text>
      )}
      {project.description ? (
        <Text style={styles.projDesc}>{project.description}</Text>
      ) : null}
      {project.points.map((point, i) => (
        <Bullet key={i} text={point} />
      ))}
    </View>
  );
}

function SkillsBlock({ category }: { category: SkillCategory }) {
  return (
    <View style={styles.skillRow}>
      <Text style={styles.skillTitle}>{category.title}: </Text>
      <Text style={styles.skillList}>{category.skills.join(", ")}</Text>
    </View>
  );
}

function EducationBlock({ edu }: { edu: Education }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.company}>{edu.institution}</Text>
        <Text style={styles.date}>{edu.graduationDate}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.eduDegree}>
          {edu.degree} in {edu.field}
          {edu.gpa ? ` · GPA: ${edu.gpa}` : ""}
        </Text>
        <Text style={styles.location}>{edu.location}</Text>
      </View>
      {edu.achievements?.map((a, i) => (
        <Bullet key={i} text={a} />
      ))}
    </View>
  );
}

export function ResumePdfDocument({ resume }: { resume: Resume }) {
  const { personalInfo, experience, projects, skills, education } = resume;

  const contactParts: { text: string }[] = [];
  if (personalInfo.email) contactParts.push({ text: personalInfo.email });
  if (personalInfo.phone) contactParts.push({ text: personalInfo.phone });
  if (personalInfo.location) contactParts.push({ text: personalInfo.location });
  if (personalInfo.linkedin) contactParts.push({ text: personalInfo.linkedin });
  if (personalInfo.github) contactParts.push({ text: personalInfo.github });
  if (personalInfo.portfolio) contactParts.push({ text: personalInfo.portfolio });

  return (
    <Document
      title={`${personalInfo.name} — Resume`}
      author={personalInfo.name}
      creator="Koundinya Portfolio"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{personalInfo.name}</Text>
          {personalInfo.title ? (
            <Text style={styles.title}>{personalInfo.title}</Text>
          ) : null}
          <ContactLine parts={contactParts} />
        </View>
        {personalInfo.summary ? (
          <Text style={styles.summary}>{personalInfo.summary}</Text>
        ) : null}

        {experience.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Experience</SectionTitle>
            {experience.map((exp) => (
              <ExperienceBlock key={exp.id} exp={exp} />
            ))}
          </View>
        )}

        {projects.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Projects</SectionTitle>
            {projects.map((proj) => (
              <ProjectBlock key={proj.id} project={proj} />
            ))}
          </View>
        )}

        {skills.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Skills</SectionTitle>
            {skills.map((cat) => (
              <SkillsBlock key={cat.id} category={cat} />
            ))}
          </View>
        )}

        {education.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Education</SectionTitle>
            {education.map((edu) => (
              <EducationBlock key={edu.id} edu={edu} />
            ))}
          </View>
        )}
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
          {title ? <Text style={clStyles.senderTitle}>{title}</Text> : null}
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

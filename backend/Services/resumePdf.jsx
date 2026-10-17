import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

function section(title, children) {
  if (!children) return null;
  return (
    <View style={styles.section} key={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, lineHeight: 1.4 },
  name: { fontSize: 20, fontWeight: 700 },
  contact: { fontSize: 9, color: '#555', marginTop: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' },
  row: { marginBottom: 6 },
  rowTitle: { fontWeight: 700 },
  rowMeta: { fontSize: 9, color: '#555' },
});

function ClassicTemplate({ r, accent }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={[styles.name, { color: accent }]}>{r.personal?.fullName}</Text>
        <Text style={styles.contact}>
          {[r.personal?.email, r.personal?.phone, r.personal?.location].filter(Boolean).join(' • ')}
        </Text>
        {r.personal?.careerObjective && (
          <Text style={{ marginTop: 8 }}>{r.personal.careerObjective}</Text>
        )}

        {section('Experience', r.experience?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.title} — {e.company}</Text>
            <Text style={styles.rowMeta}>{e.startDate} – {e.endDate || 'Present'}</Text>
            <Text>{e.description}</Text>
          </View>
        )))}

        {section('Internships', r.internships?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.role} — {e.company}</Text>
            <Text style={styles.rowMeta}>{e.startDate} – {e.endDate || 'Present'}</Text>
            <Text>{e.description}</Text>
          </View>
        )))}

        {section('Projects', r.projects?.map((p, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{p.name}</Text>
            <Text>{p.description}</Text>
          </View>
        )))}

        {section('Education', r.education?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.degree} — {e.institution}</Text>
            <Text style={styles.rowMeta}>{e.startYear} – {e.endYear} {e.grade ? `• ${e.grade}` : ''}</Text>
          </View>
        )))}

        {section('Skills', r.skills?.length ? <Text>{r.skills.join(' • ')}</Text> : null)}
        {section('Certifications', r.certifications?.map((c, i) => (
          <Text key={i}>{c.name} — {c.issuer} ({c.year})</Text>
        )))}
        {section('Achievements', r.achievements?.length ? r.achievements.map((a, i) => <Text key={i}>• {a}</Text>) : null)}
        {section('Languages', r.languages?.length ? <Text>{r.languages.map(l => `${l.name} (${l.proficiency})`).join(', ')}</Text> : null)}
        {section('Links', (r.socialLinks?.linkedin || r.socialLinks?.github || r.socialLinks?.portfolio) ? (
          <Text>{[r.socialLinks.linkedin, r.socialLinks.github, r.socialLinks.portfolio].filter(Boolean).join('  |  ')}</Text>
        ) : null)}
        {section('References', r.references?.map((ref, i) => (
          <Text key={i}>{ref.name} — {ref.relation} — {ref.contact}</Text>
        )))}
      </Page>
    </Document>
  );
}

function ModernTemplate({ r, accent }) {
  return <ClassicTemplate r={r} accent={accent} />;
}

const TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate, minimal: ClassicTemplate };

export async function generateResumePdf(resumeDoc) {
  const Template = TEMPLATES[resumeDoc.template] || ClassicTemplate;
  const element = <Template r={resumeDoc} accent={resumeDoc.themeColor} />;
  return renderToBuffer(element);
}
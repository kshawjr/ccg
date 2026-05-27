import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer as rpdfRenderToBuffer,
} from '@react-pdf/renderer';
import type { Analysis, Rating, Verdict } from './analysis';
import { COLOR_HEX, COLOR_LABEL, PRIMARY_DESCRIPTION } from './data';
import { primaryColor } from './scoring';
import type { Color, Scores } from './types';

const SLATE = '#1c2128';
const TEXT = '#1a1a1a';
const TEXT_SOFT = '#5a5a55';
const TEXT_FAINT = '#9a9a98';
const BORDER = '#e7e5dc';
const BORDER_STRONG = '#c8c6bb';
const BG_SOFT = '#faf8f3';
const SURFACE = '#ffffff';

const VERDICT_COLOR: Record<Verdict, Color> = {
  'Strong Fit': 'green',
  'Promising — Probe Further': 'blue',
  'Mixed — Multiple Concerns': 'gold',
  'Likely Misfit': 'orange',
};

const RATING_COLOR: Record<Rating, Color> = {
  High: 'green',
  Medium: 'gold',
  Watch: 'orange',
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: TEXT,
    backgroundColor: SURFACE,
    lineHeight: 1.4,
  },
  headerBar: {
    backgroundColor: SLATE,
    color: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  headerTitle: {
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  headerMeta: {
    color: '#cbd2d6',
    fontSize: 9,
  },
  accentStripe: {
    height: 6,
    marginBottom: 18,
  },

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 18,
  },
  nameText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    color: TEXT,
    letterSpacing: -0.4,
  },
  dateText: {
    fontSize: 10,
    color: TEXT_SOFT,
  },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: BG_SOFT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 10,
  },
  scoreLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  scoreNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    lineHeight: 1.2,
    letterSpacing: -1,
    marginBottom: 8,
    paddingBottom: 2,
    color: TEXT,
  },
  scoreBarTrack: {
    backgroundColor: '#ece9dd',
    height: 5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 5,
  },
  scoreOutOf: {
    marginTop: 4,
    fontSize: 8,
    color: TEXT_FAINT,
  },

  // Spotlight
  spotlight: {
    borderRadius: 6,
    padding: 18,
    marginBottom: 18,
    color: '#fff',
  },
  spotlightLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  spotlightName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 44,
    color: '#fff',
    letterSpacing: -1.5,
    marginBottom: 8,
    lineHeight: 1,
  },
  spotlightDesc: {
    fontSize: 11,
    color: '#fff',
    lineHeight: 1.4,
  },

  // Section
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionAccent: {
    width: 4,
    height: 14,
    marginRight: 8,
    borderRadius: 1,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: TEXT,
  },
  sectionBody: {
    fontSize: 10.5,
    color: TEXT,
    lineHeight: 1.5,
  },

  // Strength/Concern bullets
  bullet: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    marginRight: 10,
  },
  bulletBody: {
    flex: 1,
  },
  bulletTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    marginBottom: 2,
    color: TEXT,
  },
  bulletDetail: {
    fontSize: 10,
    color: TEXT_SOFT,
    lineHeight: 1.4,
  },

  // Values table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BG_SOFT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_STRONG,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    minHeight: 28,
    alignItems: 'flex-start',
  },
  thValue: {
    flex: 2.2,
    paddingHorizontal: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_SOFT,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  thRating: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_SOFT,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  thNote: {
    flex: 4,
    paddingHorizontal: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_SOFT,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tdValue: {
    flex: 2.2,
    paddingHorizontal: 10,
    fontSize: 10.5,
    color: TEXT,
    fontFamily: 'Helvetica-Bold',
  },
  tdRating: {
    flex: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tdNote: {
    flex: 4,
    paddingHorizontal: 10,
    fontSize: 10,
    color: TEXT_SOFT,
    lineHeight: 1.4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Interview Questions
  qRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  qNum: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    width: 22,
    color: TEXT_FAINT,
  },
  qText: {
    flex: 1,
    fontSize: 11,
    color: TEXT,
    lineHeight: 1.5,
  },

  // Recommendation
  verdictBlock: {
    borderRadius: 8,
    paddingVertical: 26,
    paddingHorizontal: 22,
    marginTop: 6,
    marginBottom: 18,
    color: '#fff',
  },
  verdictLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  verdictText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    color: '#fff',
    letterSpacing: -0.6,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  verdictSummary: {
    fontSize: 11,
    color: '#fff',
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 8,
    color: TEXT_FAINT,
    borderTopWidth: 1,
    borderColor: BORDER,
    paddingTop: 8,
  },
});

export type AnalysisReportProps = {
  name: string;
  scores: Scores;
  analysis: Analysis;
  generatedAt?: Date;
};

export function AnalysisReport({
  name,
  scores,
  analysis,
  generatedAt = new Date(),
}: AnalysisReportProps) {
  const primary = primaryColor(scores);
  const primaryHex = COLOR_HEX[primary];
  const dateLong = formatDateLong(generatedAt);
  const dateShort = formatDateShort(generatedAt);

  // Verdict color falls back to slate if Claude returned an unexpected string.
  const verdictKey = (Object.keys(VERDICT_COLOR) as Verdict[]).find(
    (v) => v === analysis.recommendation.verdict,
  );
  const verdictHex = verdictKey ? COLOR_HEX[VERDICT_COLOR[verdictKey]] : SLATE;

  const colorOrder: Color[] = ['orange', 'blue', 'gold', 'green'];

  return (
    <Document
      title={`True Colors Report — ${name}`}
      author="Corporate Cleaning Group"
      subject={`Candidate evaluation for ${name}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>TRUE COLORS ASSESSMENT REPORT</Text>
          <Text style={styles.headerMeta}>Corporate Cleaning Group</Text>
        </View>
        <View style={[styles.accentStripe, { backgroundColor: primaryHex }]} />

        {/* Name + date */}
        <View style={styles.nameRow}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.dateText}>{dateLong}</Text>
        </View>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          {colorOrder.map((c) => (
            <View key={c} style={styles.scoreCard}>
              <Text style={[styles.scoreLabel, { color: COLOR_HEX[c] }]}>
                {COLOR_LABEL[c]}
              </Text>
              <Text style={styles.scoreNumber}>{scores[c]}</Text>
              <View style={styles.scoreBarTrack}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${(scores[c] / 24) * 100}%`,
                      backgroundColor: COLOR_HEX[c],
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreOutOf}>out of 24</Text>
            </View>
          ))}
        </View>

        {/* Brightest Color spotlight */}
        <View style={[styles.spotlight, { backgroundColor: primaryHex }]} wrap={false}>
          <Text style={styles.spotlightLabel}>BRIGHTEST COLOR</Text>
          <Text style={styles.spotlightName}>{COLOR_LABEL[primary]}</Text>
          <Text style={styles.spotlightDesc}>{PRIMARY_DESCRIPTION[primary]}</Text>
        </View>

        {/* Snapshot */}
        <Section title="Snapshot" accentHex={SLATE}>
          <Text style={styles.sectionBody}>{analysis.snapshot}</Text>
        </Section>

        {/* Strengths */}
        <Section title="Strengths" accentHex={COLOR_HEX.green}>
          {analysis.strengths.map((s, i) => (
            <Bullet key={i} dotHex={COLOR_HEX.green} title={s.title} detail={s.detail} />
          ))}
        </Section>

        {/* Areas to probe */}
        <Section title="Areas to Probe" accentHex={COLOR_HEX.orange}>
          {analysis.concerns.map((c, i) => (
            <Bullet key={i} dotHex={COLOR_HEX.orange} title={c.title} detail={c.detail} />
          ))}
        </Section>

        {/* Core values fit */}
        <Section title="Core Values Fit" accentHex={COLOR_HEX.gold}>
          <View style={styles.tableHeader}>
            <Text style={styles.thValue}>Value</Text>
            <Text style={styles.thRating}>Rating</Text>
            <Text style={styles.thNote}>Why</Text>
          </View>
          {analysis.coreValuesFit.map((r, i) => {
            const ratingKey = (Object.keys(RATING_COLOR) as Rating[]).find((k) => k === r.rating);
            const ratingHex = ratingKey ? COLOR_HEX[RATING_COLOR[ratingKey]] : TEXT_SOFT;
            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={styles.tdValue}>{r.value}</Text>
                <View style={styles.tdRating}>
                  <Text style={[styles.badge, { backgroundColor: ratingHex }]}>{r.rating}</Text>
                </View>
                <Text style={styles.tdNote}>{r.note}</Text>
              </View>
            );
          })}
        </Section>

        {/* Interview questions */}
        <Section title="Interview Questions" accentHex={COLOR_HEX.blue}>
          {analysis.interviewQuestions.map((q, i) => (
            <View key={i} style={styles.qRow} wrap={false}>
              <Text style={styles.qNum}>{i + 1}.</Text>
              <Text style={styles.qText}>{q}</Text>
            </View>
          ))}
        </Section>

        {/* Verdict */}
        <View
          style={[styles.verdictBlock, { backgroundColor: verdictHex }]}
          wrap={false}
          minPresenceAhead={120}
        >
          <Text style={styles.verdictLabel}>RECOMMENDATION</Text>
          <Text style={styles.verdictText}>{analysis.recommendation.verdict}</Text>
          <Text style={styles.verdictSummary}>{analysis.recommendation.summary}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Generated {dateShort} · Corporate Cleaning Group · Confidential
        </Text>
      </Page>
    </Document>
  );
}

function Section({
  title,
  accentHex,
  children,
}: {
  title: string;
  accentHex: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionAccent, { backgroundColor: accentHex }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Bullet({
  dotHex,
  title,
  detail,
}: {
  dotHex: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.bullet} wrap={false}>
      <View style={[styles.bulletDot, { backgroundColor: dotHex }]} />
      <View style={styles.bulletBody}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function renderToBuffer(props: AnalysisReportProps): Promise<Buffer> {
  // @react-pdf returns a Node Buffer in Node runtimes.
  const out = await rpdfRenderToBuffer(<AnalysisReport {...props} />);
  return out as Buffer;
}

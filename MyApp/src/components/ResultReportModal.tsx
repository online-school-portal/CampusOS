import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PreparedReport,
  getComment,
  formatName,
  printReport,
} from '@/lib/reportHelpers';
import { calculateGrade } from '@/lib/resultsConfig';
import { showToast, getFriendlyError } from '@/utils/toast';

type Props = {
  visible: boolean;
  report: PreparedReport | null;
  onClose: () => void;
};

export default function ResultReportModal({ visible, report, onClose }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  if (!report) return null;

  const {
    row,
    school,
    config,
    results,
    totalMarks,
    average,
    overallGrade,
    position,
    classSize,
    psychomotor,
    affective,
    attendance,
    termDuration,
  } = report;

  const primary = school.primary_color || '#1a3d7c';
  const studentName = row.students?.full_name || 'Student';

  const handlePrint = () => {
    try {
      if (Platform.OS === 'web') {
        printReport(report);
      } else {
        showToast('Use web browser Print for the full report sheet.', 'info');
      }
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const DomainTable = ({
    title,
    data,
    firstCol,
  }: {
    title: string;
    data: Record<string, any>;
    firstCol: string;
  }) => {
    const entries = Object.entries(data || {});
    return (
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: primary }]}>{title}</Text>
        <View style={styles.table}>
          <View style={[styles.tr, { backgroundColor: primary }]}>
            <Text style={[styles.th, { flex: 1.6 }]}>{firstCol}</Text>
            {[100, 85, 75, 65, 55].map((s) => (
              <Text key={s} style={[styles.th, styles.center]}>
                {s}
              </Text>
            ))}
          </View>
          {entries.length === 0 ? (
            <Text style={styles.emptyCell}>No data</Text>
          ) : (
            entries.map(([key, score]) => (
              <View key={key} style={styles.tr}>
                <Text style={[styles.td, { flex: 1.6 }]}>{formatName(key)}</Text>
                {[100, 85, 75, 65, 55].map((s) => (
                  <Text key={s} style={[styles.td, styles.center]}>
                    {Number(score) === s ? '✔' : ''}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.toolBtn}>
            <Ionicons name="close" size={22} color="#64748b" />
            <Text style={styles.toolBtnText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={[styles.printBtn, { backgroundColor: primary }]}
          >
            <Ionicons name="print-outline" size={20} color="#fff" />
            <Text style={styles.printText}>Print</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { borderColor: primary }]}>
            {/* HEADER — logo + school */}
            <View style={[styles.header, { borderBottomColor: primary }]}>
              {school.logo_url ? (
                <Image
                  source={{ uri: school.logo_url }}
                  style={[styles.logo, { borderColor: primary }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.logo, { borderColor: primary }]} />
              )}
              <View style={styles.headerText}>
                <Text style={styles.schoolName}>
                  {(school.name || 'School Name').toUpperCase()}
                </Text>
                <Text style={styles.motto}>MOTTO: {school.motto || 'N/A'}</Text>
                <Text style={styles.address}>
                  {(school.address || '').toUpperCase()}
                </Text>
                <Text style={styles.address}>
                  TEL: {school.phone_numbers || 'N/A'}
                </Text>
              </View>
            </View>

            <View style={[styles.banner, { backgroundColor: primary }]}>
              <Text style={styles.bannerText}>CONTINUOUS ASSESSMENT REPORT</Text>
            </View>

            {/* INFO GRID — same fields as web */}
            <View style={styles.infoGrid}>
              <Info label="Name" value={studentName} />
              <Info label="Student ID" value={row.students?.student_id || 'N/A'} />
              <Info label="Class" value={row.classes?.name || 'N/A'} />
              <Info
                label="Gender"
                value={row.gender || row.students?.sex || 'N/A'}
              />
              <Info label="Term" value={row.term || 'N/A'} />
              <Info label="Academic Session" value={row.session || 'N/A'} />
              <Info label="No. in Class" value={String(classSize)} />
              <Info label="Position" value={position} />
            </View>

            {/* Attendance + Terminal Duration side by side */}
            <View style={wide ? styles.twoCol : styles.oneCol}>
              <View style={styles.col}>
                <Text style={[styles.sectionTitle, { color: primary }]}>
                  Attendance
                </Text>
                <View style={styles.miniTable}>
                  <View style={[styles.tr, { backgroundColor: primary }]}>
                    <Text style={styles.th}>Opened</Text>
                    <Text style={styles.th}>Present</Text>
                    <Text style={styles.th}>Absent</Text>
                  </View>
                  <View style={styles.tr}>
                    <Text style={[styles.td, styles.center]}>
                      {attendance.days_opened ?? '—'}
                    </Text>
                    <Text style={[styles.td, styles.center]}>
                      {attendance.days_present ?? '—'}
                    </Text>
                    <Text style={[styles.td, styles.center]}>
                      {attendance.days_absent ?? '—'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.col}>
                <Text style={[styles.sectionTitle, { color: primary }]}>
                  Terminal Duration
                </Text>
                <View style={styles.miniTable}>
                  <View style={[styles.tr, { backgroundColor: primary }]}>
                    <Text style={styles.th}>Begins</Text>
                    <Text style={styles.th}>Ends</Text>
                    <Text style={styles.th}>Next</Text>
                  </View>
                  <View style={styles.tr}>
                    <Text style={[styles.td, styles.center, { fontSize: 10 }]}>
                      {termDuration.term_begins || '—'}
                    </Text>
                    <Text style={[styles.td, styles.center, { fontSize: 10 }]}>
                      {termDuration.term_ends || '—'}
                    </Text>
                    <Text style={[styles.td, styles.center, { fontSize: 10 }]}>
                      {termDuration.next_term_begins || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* COLUMNS: left cognitive + comments, right domains */}
            <View style={wide ? styles.twoCol : styles.oneCol}>
              <View style={[styles.col, { flex: 1.4 }]}>
                <Text style={[styles.sectionTitle, { color: primary }]}>
                  Academic Progress Summaries (Cognitive)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[styles.tr, { backgroundColor: primary }]}>
                      <Text style={[styles.th, { width: 100 }]}>Subjects</Text>
                      {config.parts.map((p) => (
                        <Text key={p.key} style={[styles.th, { width: 52 }]}>
                          {p.label}
                        </Text>
                      ))}
                      <Text style={[styles.th, { width: 44 }]}>Total</Text>
                      <Text style={[styles.th, { width: 44 }]}>Grade</Text>
                      <Text style={[styles.th, { width: 64 }]}>Comment</Text>
                    </View>
                    {results.map((subject: any, i: number) => {
                      let total = 0;
                      return (
                        <View key={subject.subject_id || i} style={styles.tr}>
                          <Text style={[styles.td, { width: 100 }]}>
                            {subject.subject_name}
                          </Text>
                          {config.parts.map((p) => {
                            const v = Number(subject[p.key] || 0);
                            total += v;
                            return (
                              <Text
                                key={p.key}
                                style={[styles.td, styles.center, { width: 52 }]}
                              >
                                {v}
                              </Text>
                            );
                          })}
                          <Text
                            style={[
                              styles.td,
                              styles.center,
                              { width: 44, fontWeight: '700' },
                            ]}
                          >
                            {total}
                          </Text>
                          <Text style={[styles.td, styles.center, { width: 44 }]}>
                            {calculateGrade(total)}
                          </Text>
                          <Text
                            style={[
                              styles.td,
                              { width: 64, fontStyle: 'italic', fontSize: 10 },
                            ]}
                          >
                            {getComment(calculateGrade(total))}
                          </Text>
                        </View>
                      );
                    })}
                    <View style={[styles.tr, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.td, { width: 100, fontWeight: '700' }]}>
                        Overall Total
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          styles.center,
                          {
                            width: 52 * config.parts.length,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {totalMarks}
                      </Text>
                      <Text style={[styles.td, styles.center, { width: 44 }]}>
                        {average}%
                      </Text>
                      <Text style={[styles.td, styles.center, { width: 44 }]}>
                        {overallGrade}
                      </Text>
                      <Text
                        style={[styles.td, { width: 64, fontStyle: 'italic' }]}
                      >
                        {getComment(overallGrade)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.commentBox}>
                  <Text style={styles.commentStrong}>TEACHER'S COMMENT:</Text>
                  <Text style={styles.commentBody}>
                    {row.teacher_comment || '...'}
                  </Text>
                </View>
                <View style={styles.commentBox}>
                  <Text style={styles.commentStrong}>HEADMASTER'S COMMENT:</Text>
                  <Text style={styles.commentBody}>
                    {row.headmaster_comment || '...'}
                  </Text>
                </View>

                <View style={styles.signature}>
                  <Text style={styles.commentStrong}>HEADMASTER'S SIGNATURE:</Text>
                  {school.headmaster_signature_url ? (
                    <Image
                      source={{ uri: school.headmaster_signature_url }}
                      style={styles.sigImg}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={styles.sigLine} />
                </View>
              </View>

              <View style={styles.col}>
                <DomainTable
                  title="Affective Domain"
                  data={affective}
                  firstCol="Behaviour"
                />
                <DomainTable
                  title="Psychomotor Domain"
                  data={psychomotor}
                  firstCol="Activities"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolBtnText: {
    color: '#64748b',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  printText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  scroll: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 2,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 2,
    paddingBottom: 10,
    marginBottom: 10,
  },
  logo: {
    width: 64,
    height: 64,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  headerText: { flex: 1, alignItems: 'center' },
  schoolName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    letterSpacing: 1,
  },
  motto: {
    fontSize: 11,
    fontStyle: 'italic',
    fontWeight: '700',
    color: '#444',
    marginTop: 2,
  },
  address: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
  },
  banner: {
    paddingVertical: 6,
    marginBottom: 12,
  },
  bannerText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoItem: {
    width: '47%',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  infoValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111',
  },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  oneCol: { flexDirection: 'column', gap: 8, marginBottom: 8 },
  col: { flex: 1 },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 4,
  },
  block: { marginBottom: 10 },
  table: { marginBottom: 6 },
  miniTable: { marginBottom: 8 },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  th: {
    flex: 1,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 5,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  td: {
    flex: 1,
    fontSize: 11,
    color: '#222',
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  center: { textAlign: 'center' },
  emptyCell: { padding: 8, color: '#999', fontSize: 11 },
  commentBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginTop: 8,
    minHeight: 48,
  },
  commentStrong: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  commentBody: { fontSize: 12, color: '#333' },
  signature: { marginTop: 16, alignItems: 'center' },
  sigImg: { height: 48, width: 140, marginTop: 8 },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 180,
    marginTop: 6,
  },
});

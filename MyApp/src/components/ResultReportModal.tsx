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

  const primary = school.primary_color || '#1e40af';
  const studentName = row.students?.full_name || 'Student';

  const handlePrint = () => {
    try {
      if (Platform.OS === 'web') {
        printReport(report);
      } else {
        showToast(
          'Open this screen on web to print, or use your device share/print from the browser preview.',
          'info'
        );
      }
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const DomainTable = ({
    title,
    data,
  }: {
    title: string;
    data: Record<string, any>;
  }) => {
    const entries = Object.entries(data || {});
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: primary }]}>{title}</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.thRow, { backgroundColor: primary }]}>
            <Text style={[styles.th, { flex: 2 }]}>Item</Text>
            {[100, 85, 75, 65, 55].map((s) => (
              <Text key={s} style={[styles.th, styles.center]}>
                {s}
              </Text>
            ))}
          </View>
          {entries.length === 0 ? (
            <Text style={styles.emptyRow}>No data</Text>
          ) : (
            entries.map(([key, score]) => (
              <View key={key} style={styles.tr}>
                <Text style={[styles.td, { flex: 2 }]}>{formatName(key)}</Text>
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
            {/* Header */}
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
                <Text style={styles.motto}>
                  MOTTO: {school.motto || 'N/A'}
                </Text>
                <Text style={styles.address}>
                  {(school.address || '').toUpperCase()}
                </Text>
                <Text style={styles.address}>
                  TEL: {school.phone_numbers || 'N/A'}
                </Text>
              </View>
            </View>

            <View style={[styles.banner, { backgroundColor: primary }]}>
              <Text style={styles.bannerText}>
                CONTINUOUS ASSESSMENT REPORT
              </Text>
            </View>

            {/* Student info */}
            <View style={styles.infoGrid}>
              <Info label="Name" value={studentName} />
              <Info label="Student ID" value={row.students?.student_id || 'N/A'} />
              <Info label="Class" value={row.classes?.name || 'N/A'} />
              <Info label="Term / Session" value={`${row.term} / ${row.session}`} />
              <Info
                label="Gender"
                value={row.gender || row.students?.sex || 'N/A'}
              />
              <Info label="Position" value={`${position} of ${classSize}`} />
            </View>

            {/* Subjects table */}
            <Text style={[styles.sectionTitle, { color: primary }]}>
              Subject Results
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tr, styles.thRow, { backgroundColor: primary }]}>
                  <Text style={[styles.th, { width: 110 }]}>Subject</Text>
                  {config.parts.map((p) => (
                    <Text key={p.key} style={[styles.th, { width: 56 }]}>
                      {p.label}
                    </Text>
                  ))}
                  <Text style={[styles.th, { width: 48 }]}>Total</Text>
                  <Text style={[styles.th, { width: 48 }]}>Grade</Text>
                  <Text style={[styles.th, { width: 70 }]}>Comment</Text>
                </View>
                {results.map((subject: any, i: number) => {
                  let total = 0;
                  return (
                    <View key={subject.subject_id || i} style={styles.tr}>
                      <Text style={[styles.td, { width: 110 }]}>
                        {subject.subject_name}
                      </Text>
                      {config.parts.map((p) => {
                        const v = Number(subject[p.key] || 0);
                        total += v;
                        return (
                          <Text
                            key={p.key}
                            style={[styles.td, styles.center, { width: 56 }]}
                          >
                            {v}
                          </Text>
                        );
                      })}
                      <Text
                        style={[
                          styles.td,
                          styles.center,
                          { width: 48, fontFamily: 'PlusJakartaSans_700Bold' },
                        ]}
                      >
                        {total}
                      </Text>
                      <Text style={[styles.td, styles.center, { width: 48 }]}>
                        {calculateGrade(total)}
                      </Text>
                      <Text style={[styles.td, { width: 70, fontStyle: 'italic' }]}>
                        {getComment(calculateGrade(total))}
                      </Text>
                    </View>
                  );
                })}
                <View style={[styles.tr, { backgroundColor: '#f1f5f9' }]}>
                  <Text
                    style={[
                      styles.td,
                      { width: 110, fontFamily: 'PlusJakartaSans_700Bold' },
                    ]}
                  >
                    Overall
                  </Text>
                  <Text
                    style={[
                      styles.td,
                      styles.center,
                      {
                        width: 56 * config.parts.length,
                        fontFamily: 'PlusJakartaSans_700Bold',
                      },
                    ]}
                  >
                    {totalMarks}
                  </Text>
                  <Text style={[styles.td, styles.center, { width: 48 }]}>
                    {average}%
                  </Text>
                  <Text style={[styles.td, styles.center, { width: 48 }]}>
                    {overallGrade}
                  </Text>
                  <Text style={[styles.td, { width: 70, fontStyle: 'italic' }]}>
                    {getComment(overallGrade)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <DomainTable title="Psychomotor Domain" data={psychomotor} />
            <DomainTable title="Affective Domain" data={affective} />

            <Text style={[styles.sectionTitle, { color: primary }]}>
              Attendance
            </Text>
            <View style={styles.infoGrid}>
              <Info label="Days Opened" value={String(attendance.days_opened ?? '—')} />
              <Info label="Days Present" value={String(attendance.days_present ?? '—')} />
              <Info label="Days Absent" value={String(attendance.days_absent ?? '—')} />
            </View>

            <Text style={[styles.sectionTitle, { color: primary }]}>
              Comments
            </Text>
            <Text style={styles.comment}>
              <Text style={styles.commentLabel}>Teacher: </Text>
              {row.teacher_comment || '—'}
            </Text>
            <Text style={styles.comment}>
              <Text style={styles.commentLabel}>Headmaster: </Text>
              {row.headmaster_comment || '—'}
            </Text>
            <Text style={styles.termDates}>
              Term: {termDuration.term_begins || '—'} →{' '}
              {termDuration.term_ends || '—'} · Next:{' '}
              {termDuration.next_term_begins || '—'}
            </Text>
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
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
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
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 4,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 2,
    paddingBottom: 12,
    marginBottom: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: '#f8fafc',
  },
  headerText: { flex: 1, alignItems: 'center' },
  schoolName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
  },
  motto: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748b',
    marginTop: 2,
  },
  address: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  banner: {
    paddingVertical: 8,
    marginBottom: 12,
    borderRadius: 4,
  },
  bannerText: {
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoItem: { width: '47%' },
  infoLabel: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  infoValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  sectionBlock: { marginBottom: 8 },
  table: { marginBottom: 8 },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  thRow: { borderBottomWidth: 0 },
  th: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    paddingVertical: 6,
    paddingHorizontal: 4,
    flex: 1,
  },
  td: {
    fontSize: 11,
    color: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 4,
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  center: { textAlign: 'center' },
  emptyRow: {
    padding: 8,
    color: '#94a3b8',
    fontSize: 12,
  },
  comment: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 6,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  commentLabel: { fontFamily: 'PlusJakartaSans_700Bold' },
  termDates: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
  },
});

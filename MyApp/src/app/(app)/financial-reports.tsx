import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

type ReportKey = {
  class_id: string;
  class_name: string;
  session: string;
  term: string;
};

type StudentFeeLine = {
  feeName: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
};

type StudentFin = {
  studentId: string;
  studentName: string;
  fees: StudentFeeLine[];
  expected: number;
  collected: number;
  outstanding: number;
};

export default function FinancialReportsScreen() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [allReports, setAllReports] = useState<ReportKey[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [students, setStudents] = useState<StudentFin[]>([]);
  const [totals, setTotals] = useState({
    expected: 0,
    collected: 0,
    outstanding: 0,
    rate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('classes')
            .select('id, name')
            .order('name');
          if (error) throw error;
          setClasses(data || []);
        } catch (err) {
          showToast(getFriendlyError(err), 'error');
        }
      })();
    }, [])
  );

  useEffect(() => {
    if (classId) fetchReports();
    else {
      setAllReports([]);
      setSessions([]);
    }
  }, [classId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_fees')
        .select('class_id, session, term, classes(name)')
        .eq('class_id', classId)
        .order('session')
        .order('term');
      if (error) throw error;

      const grouped: Record<string, ReportKey> = {};
      (data || []).forEach((row: any) => {
        const key = `${row.class_id}_${row.session}_${row.term}`;
        if (!grouped[key]) {
          grouped[key] = {
            class_id: row.class_id,
            class_name: row.classes?.name || 'Class',
            session: row.session,
            term: row.term,
          };
        }
      });
      const list = Object.values(grouped);
      setAllReports(list);
      setSessions([...new Set(list.map((r) => r.session))]);
      setSessionFilter('all');
      setTermFilter('all');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = allReports.filter((r) => {
    if (sessionFilter !== 'all' && r.session !== sessionFilter) return false;
    if (termFilter !== 'all' && r.term !== termFilter) return false;
    return true;
  });

  const openReport = async (report: ReportKey) => {
    setBusy(true);
    setDetailTitle(`${report.class_name} · ${report.session} · ${report.term}`);
    try {
      const [{ data: classFees, error: feeErr }, { data: classStudents, error: stuErr }] =
        await Promise.all([
          supabase
            .from('class_fees')
            .select('id, amount, fee_types(name)')
            .eq('class_id', report.class_id)
            .eq('session', report.session)
            .eq('term', report.term),
          supabase
            .from('students')
            .select('id, full_name')
            .eq('class_id', report.class_id)
            .order('full_name'),
        ]);
      if (feeErr) throw feeErr;
      if (stuErr) throw stuErr;

      const feeIds = (classFees || []).map((f) => f.id);
      let payments: any[] = [];
      if (feeIds.length && (classStudents || []).length) {
        const { data: pays, error: payErr } = await supabase
          .from('fee_payments')
          .select('student_id, class_fee_id, amount')
          .in('class_fee_id', feeIds);
        if (payErr) throw payErr;
        payments = pays || [];
      }

      const payMap: Record<string, number> = {};
      payments.forEach((p) => {
        const k = `${p.student_id}_${p.class_fee_id}`;
        payMap[k] = (payMap[k] || 0) + Number(p.amount || 0);
      });

      let schoolExpected = 0;
      let schoolCollected = 0;

      const studentFinancials: StudentFin[] = (classStudents || []).map((stu) => {
        const fees: StudentFeeLine[] = (classFees || []).map((fee: any) => {
          const amount = Number(fee.amount);
          const paid = payMap[`${stu.id}_${fee.id}`] || 0;
          const balance = Math.max(0, amount - paid);
          schoolExpected += amount;
          schoolCollected += Math.min(paid, amount);
          return {
            feeName: fee.fee_types?.name || 'Fee',
            amount,
            paid,
            balance,
            status:
              balance <= 0 ? 'Paid' : paid > 0 ? 'Part Payment' : 'Unpaid',
          };
        });
        const expected = fees.reduce((s, f) => s + f.amount, 0);
        const collected = fees.reduce((s, f) => s + Math.min(f.paid, f.amount), 0);
        const outstanding = Math.max(0, expected - collected);
        return {
          studentId: stu.id,
          studentName: stu.full_name,
          fees,
          expected,
          collected,
          outstanding,
        };
      });

      setStudents(studentFinancials);
      setTotals({
        expected: schoolExpected,
        collected: schoolCollected,
        outstanding: Math.max(0, schoolExpected - schoolCollected),
        rate: schoolExpected === 0 ? 0 : (schoolCollected / schoolExpected) * 100,
      });
      setDetailVisible(true);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteReport = (report: ReportKey) => {
    const msg = `Delete all class fees for ${report.class_name} — ${report.session} / ${report.term}? Payments are not deleted.`;
    const run = async () => {
      setBusy(true);
      try {
        const { error } = await supabase
          .from('class_fees')
          .delete()
          .eq('class_id', report.class_id)
          .eq('session', report.session)
          .eq('term', report.term);
        if (error) throw error;
        await fetchReports();
        showToast('Report fees removed.', 'success');
      } catch (err) {
        showToast(getFriendlyError(err), 'error');
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) run();
      return;
    }
    Alert.alert('Delete report', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <View style={styles.page}>
      {busy ? <LoadingSpinner visible message="Loading..." /> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchReports} />
        }
      >
        <Text style={styles.header}>Financial Reports</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Class</Text>
          <View style={styles.selectBox}>
            <Picker selectedValue={classId} onValueChange={setClassId} style={styles.picker}>
              <Picker.Item label="Select class" value="" color="#94a3b8" />
              {classes.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Session</Text>
          <View style={styles.selectBox}>
            <Picker
              selectedValue={sessionFilter}
              onValueChange={setSessionFilter}
              style={styles.picker}
            >
              <Picker.Item label="All Sessions" value="all" />
              {sessions.map((s) => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Term</Text>
          <View style={styles.selectBox}>
            <Picker
              selectedValue={termFilter}
              onValueChange={setTermFilter}
              style={styles.picker}
            >
              <Picker.Item label="All Terms" value="all" />
              <Picker.Item label="First Term" value="First Term" />
              <Picker.Item label="Second Term" value="Second Term" />
              <Picker.Item label="Third Term" value="Third Term" />
            </Picker>
          </View>
        </View>

        {!classId ? (
          <Text style={styles.empty}>Select a class to view available financial reports.</Text>
        ) : loading ? (
          <Text style={styles.empty}>Loading...</Text>
        ) : !filtered.length ? (
          <Text style={styles.empty}>No financial reports found.</Text>
        ) : (
          filtered.map((r) => (
            <View
              key={`${r.class_id}_${r.session}_${r.term}`}
              style={styles.reportCard}
            >
              <Text style={styles.reportName}>{r.class_name}</Text>
              <Text style={styles.meta}>{r.session}</Text>
              <Text style={styles.meta}>Term: {r.term}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openReport(r)}
                >
                  <Text style={styles.viewText}>View Report</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.delBtn}
                  onPress={() => deleteReport(r)}
                >
                  <Text style={styles.delText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={detailVisible}
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={2}>
              {detailTitle}
            </Text>
            <TouchableOpacity onPress={() => setDetailVisible(false)}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                Expected: ₦{totals.expected.toLocaleString()}
              </Text>
              <Text style={styles.summaryLine}>
                Collected: ₦{totals.collected.toLocaleString()}
              </Text>
              <Text style={styles.summaryLine}>
                Outstanding: ₦{totals.outstanding.toLocaleString()}
              </Text>
              <Text style={styles.summaryLine}>
                Collection rate: {totals.rate.toFixed(1)}%
              </Text>
            </View>

            {!students.length ? (
              <Text style={styles.empty}>No students in this class.</Text>
            ) : (
              students.map((stu) => (
                <View key={stu.studentId} style={styles.studentBlock}>
                  <Text style={styles.studentName}>{stu.studentName}</Text>
                  {stu.fees.map((f, i) => (
                    <View key={i} style={styles.feeRow}>
                      <Text style={styles.feeName}>{f.feeName}</Text>
                      <Text style={styles.feeMeta}>
                        Exp ₦{f.amount.toLocaleString()} · Paid ₦
                        {f.paid.toLocaleString()} · Bal ₦
                        {f.balance.toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.status,
                          f.status === 'Paid'
                            ? styles.statusPaid
                            : f.status === 'Part Payment'
                            ? styles.statusPartial
                            : styles.statusUnpaid,
                        ]}
                      >
                        {f.status}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.studentTotal}>
                    Total · Exp ₦{stu.expected.toLocaleString()} · Paid ₦
                    {stu.collected.toLocaleString()} · Out ₦
                    {stu.outstanding.toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 48 },
  header: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 6,
    marginTop: 4,
  },
  selectBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  picker: { height: 48 },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  reportName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#0f172a',
  },
  meta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  viewBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewText: {
    color: '#1e40af',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  delBtn: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  delText: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 12,
  },
  modalContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginRight: 12,
  },
  closeX: { fontSize: 20, color: '#64748b', padding: 4 },
  modalBody: { padding: 16, paddingBottom: 40 },
  summaryBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  summaryLine: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    marginBottom: 4,
  },
  studentBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  studentName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 8,
  },
  feeRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 8,
  },
  feeName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  feeMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  status: {
    marginTop: 4,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  statusPaid: { color: '#16a34a' },
  statusPartial: { color: '#d97706' },
  statusUnpaid: { color: '#dc2626' },
  studentTotal: {
    marginTop: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#1e40af',
  },
});

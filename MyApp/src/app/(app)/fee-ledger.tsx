import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

const SESSIONS = ['2025/2026', '2026/2027', '2027/2028'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];
const METHODS = ['Cash', 'Transfer', 'POS', 'Other'];

type LedgerRow = {
  classFeeId: string;
  feeTypeId: string;
  feeName: string;
  amount: number;
  paid: number;
  balance: number;
};

/**
 * Fee ledger + payments.
 * IMPORTANT: Records payments with a direct insert into fee_payments.
 * Does NOT call save_fee_payment_with_credit / save_bulk_fee_payments_with_credit
 * (no credit deduction on the frontend for fee registration).
 */
export default function FeeLedgerScreen() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('Working...');

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [session, setSession] = useState('2025/2026');
  const [term, setTerm] = useState('First Term');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Payment modal
  const [payVisible, setPayVisible] = useState(false);
  const [payFeeId, setPayFeeId] = useState('');
  const [payFeeName, setPayFeeName] = useState('');
  const [payBalance, setPayBalance] = useState(0);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [proofUri, setProofUri] = useState<string | null>(null);

  // Pay all modal
  const [payAllVisible, setPayAllVisible] = useState(false);
  const [payAllMethod, setPayAllMethod] = useState('Cash');

  // History modal
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [{ data: cls }, { data: sid }] = await Promise.all([
            supabase.from('classes').select('id, name').order('name'),
            supabase.rpc('current_user_school_id'),
          ]);
          setClasses(cls || []);
          setSchoolId(sid || null);
        } catch (err) {
          showToast(getFriendlyError(err), 'error');
        }
      })();
    }, [])
  );

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setStudentId('');
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name, student_id')
          .eq('class_id', classId)
          .order('full_name');
        if (error) throw error;
        setStudents(data || []);
        setStudentId('');
      } catch (err) {
        showToast(getFriendlyError(err), 'error');
      }
    })();
  }, [classId]);

  useEffect(() => {
    fetchLedger();
  }, [session, term, classId, studentId]);

  const fetchLedger = async () => {
    if (!session || !term || !classId || !studentId) {
      setLedger([]);
      return;
    }
    setLoading(true);
    try {
      const { data: classFees, error: feeErr } = await supabase
        .from('class_fees')
        .select('id, fee_type_id, amount, fee_types(name)')
        .eq('class_id', classId)
        .eq('session', session)
        .eq('term', term)
        .order('created_at');
      if (feeErr) throw feeErr;

      const feeIds = (classFees || []).map((f) => f.id);
      let paymentTotals: Record<string, number> = {};

      if (feeIds.length) {
        const { data: pays, error: payErr } = await supabase
          .from('fee_payments')
          .select('class_fee_id, amount')
          .eq('student_id', studentId)
          .in('class_fee_id', feeIds);
        if (payErr) throw payErr;
        (pays || []).forEach((p: any) => {
          paymentTotals[p.class_fee_id] =
            (paymentTotals[p.class_fee_id] || 0) + Number(p.amount || 0);
        });
      }

      const rows: LedgerRow[] = (classFees || []).map((fee: any) => {
        const amount = Number(fee.amount);
        const paid = paymentTotals[fee.id] || 0;
        return {
          classFeeId: fee.id,
          feeTypeId: fee.fee_type_id,
          feeName: fee.fee_types?.name || 'Unknown',
          amount,
          paid,
          balance: Math.max(0, amount - paid),
        };
      });
      setLedger(rows);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadProof = async (uri: string): Promise<{ url: string; path: string } | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return null;

      const res = await fetch(uri);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append(
        'file',
        blob as any,
        `proof-${Date.now()}.jpg`
      );

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/upload-payment-proof`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const result = await response.json();
      if (!response.ok) throw result;
      return { url: result.url, path: result.path };
    } catch {
      return null;
    }
  };

  const openPay = (row: LedgerRow) => {
    setPayFeeId(row.classFeeId);
    setPayFeeName(row.feeName);
    setPayBalance(row.balance);
    setPayAmount(String(row.balance));
    setPayMethod('Cash');
    setProofUri(null);
    setPayVisible(true);
  };

  const pickProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setProofUri(result.assets[0].uri);
    }
  };

  /**
   * Direct insert — NO save_fee_payment_with_credit RPC (no credit deduction).
   */
  const recordPaymentDirect = async (payload: {
    school_id: string;
    student_id: string;
    class_fee_id: string;
    amount: number;
    payment_method: string;
    proof_url?: string | null;
    proof_path?: string | null;
  }) => {
    const { error } = await supabase.from('fee_payments').insert({
      ...payload,
      source: 'manual',
    });
    if (error) throw error;
  };

  const savePayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid payment amount.', 'error');
      return;
    }
    if (amount > payBalance) {
      showToast('Amount cannot exceed balance.', 'error');
      return;
    }
    if (!studentId) return;

    setBusyMsg('Recording payment...');
    setBusy(true);
    try {
      let sid = schoolId;
      if (!sid) {
        const { data: student, error } = await supabase
          .from('students')
          .select('school_id')
          .eq('id', studentId)
          .single();
        if (error) throw error;
        sid = student.school_id;
      }

      let proof_url: string | null = null;
      let proof_path: string | null = null;
      if (proofUri) {
        const up = await uploadProof(proofUri);
        if (up) {
          proof_url = up.url;
          proof_path = up.path;
        }
      }

      // NO credit RPC — first-time / any fee registration without credit deduction
      await recordPaymentDirect({
        school_id: sid!,
        student_id: studentId,
        class_fee_id: payFeeId,
        amount,
        payment_method: payMethod,
        proof_url,
        proof_path,
      });

      setPayVisible(false);
      await fetchLedger();
      showToast('Payment recorded successfully.', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openPayAll = () => {
    if (!ledger.some((r) => r.balance > 0)) {
      showToast('Nothing left to pay.', 'info');
      return;
    }
    setPayAllMethod('Cash');
    setProofUri(null);
    setPayAllVisible(true);
  };

  /**
   * Pay all remaining balances — direct inserts, NO save_bulk_fee_payments_with_credit.
   */
  const savePayAll = async () => {
    const due = ledger.filter((r) => r.balance > 0);
    if (!due.length || !studentId) return;

    setBusyMsg('Recording payments...');
    setBusy(true);
    try {
      let sid = schoolId;
      if (!sid) {
        const { data: student, error } = await supabase
          .from('students')
          .select('school_id')
          .eq('id', studentId)
          .single();
        if (error) throw error;
        sid = student.school_id;
      }

      let proof_url: string | null = null;
      let proof_path: string | null = null;
      if (proofUri) {
        const up = await uploadProof(proofUri);
        if (up) {
          proof_url = up.url;
          proof_path = up.path;
        }
      }

      for (const row of due) {
        await recordPaymentDirect({
          school_id: sid!,
          student_id: studentId,
          class_fee_id: row.classFeeId,
          amount: row.balance,
          payment_method: payAllMethod,
          proof_url,
          proof_path,
        });
      }

      setPayAllVisible(false);
      await fetchLedger();
      showToast('Payments recorded successfully.', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    if (!studentId) return;
    setHistoryVisible(true);
    setBusyMsg('Loading history...');
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('fee_payments')
        .select(
          'id, amount, payment_method, created_at, class_fee_id, class_fees(fee_types(name), session, term)'
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const totalAmount = ledger.reduce((s, r) => s + r.amount, 0);
  const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
  const totalBalance = ledger.reduce((s, r) => s + r.balance, 0);

  return (
    <View style={styles.page}>
      {busy ? <LoadingSpinner visible message={busyMsg} /> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLedger} />
        }
      >
        <Text style={styles.header}>Student Fee Ledger</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Session</Text>
          <View style={styles.selectBox}>
            <Picker selectedValue={session} onValueChange={setSession} style={styles.picker}>
              {SESSIONS.map((s) => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Term</Text>
          <View style={styles.selectBox}>
            <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
              {TERMS.map((t) => (
                <Picker.Item key={t} label={t} value={t} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Class</Text>
          <View style={styles.selectBox}>
            <Picker selectedValue={classId} onValueChange={setClassId} style={styles.picker}>
              <Picker.Item label="Select class" value="" color="#94a3b8" />
              {classes.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Student</Text>
          <View style={styles.selectBox}>
            <Picker
              selectedValue={studentId}
              onValueChange={setStudentId}
              style={styles.picker}
              enabled={!!classId}
            >
              <Picker.Item label="Select student" value="" color="#94a3b8" />
              {students.map((s) => (
                <Picker.Item
                  key={s.id}
                  label={`${s.full_name}${s.student_id ? ` (${s.student_id})` : ''}`}
                  value={s.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Student Ledger</Text>
        {!studentId ? (
          <Text style={styles.empty}>Select session, term, class and student.</Text>
        ) : loading ? (
          <Text style={styles.empty}>Loading...</Text>
        ) : !ledger.length ? (
          <Text style={styles.empty}>No fees assigned.</Text>
        ) : (
          <>
            {ledger.map((row) => (
              <View key={row.classFeeId} style={styles.ledgerCard}>
                <Text style={styles.feeName}>{row.feeName}</Text>
                <View style={styles.rowLine}>
                  <Text style={styles.meta}>Amount</Text>
                  <Text style={styles.val}>₦{row.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.meta}>Paid</Text>
                  <Text style={styles.val}>₦{row.paid.toLocaleString()}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.meta}>Balance</Text>
                  {row.balance === 0 ? (
                    <Text style={styles.paidBadge}>Paid</Text>
                  ) : (
                    <Text style={styles.balance}>₦{row.balance.toLocaleString()}</Text>
                  )}
                </View>
                {row.balance > 0 ? (
                  <TouchableOpacity style={styles.recordBtn} onPress={() => openPay(row)}>
                    <Text style={styles.recordBtnText}>Record Payment</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.paidBtn}>
                    <Text style={styles.paidBtnText}>Paid</Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.totals}>
              <Text style={styles.totalLine}>
                Total: ₦{totalAmount.toLocaleString()}
              </Text>
              <Text style={styles.totalLine}>
                Paid: ₦{totalPaid.toLocaleString()}
              </Text>
              <Text style={styles.totalLine}>
                Balance: ₦{totalBalance.toLocaleString()}
              </Text>
              <View style={styles.totalActions}>
                {totalBalance > 0 ? (
                  <TouchableOpacity style={styles.payAllBtn} onPress={openPayAll}>
                    <Text style={styles.payAllText}>Pay All</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.historyBtn} onPress={openHistory}>
                  <Text style={styles.historyText}>Payment History</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Record single payment */}
      <Modal visible={payVisible} animationType="slide" onRequestClose={() => setPayVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TouchableOpacity onPress={() => setPayVisible(false)}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{payFeeName}</Text>
            <Text style={styles.meta}>Balance: ₦{payBalance.toLocaleString()}</Text>

            <Text style={styles.label}>Amount (₦)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={payAmount}
              onChangeText={setPayAmount}
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={payMethod} onValueChange={setPayMethod} style={styles.picker}>
                {METHODS.map((m) => (
                  <Picker.Item key={m} label={m} value={m} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={pickProof}>
              <Text style={styles.secondaryBtnText}>
                {proofUri ? 'Proof selected ✓' : 'Attach payment proof (optional)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={savePayment}>
              <Text style={styles.btnText}>Save Payment</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Pay all */}
      <Modal visible={payAllVisible} animationType="slide" onRequestClose={() => setPayAllVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pay All Outstanding</Text>
            <TouchableOpacity onPress={() => setPayAllVisible(false)}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.meta}>
              Total outstanding: ₦{totalBalance.toLocaleString()}
            </Text>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.selectBox}>
              <Picker
                selectedValue={payAllMethod}
                onValueChange={setPayAllMethod}
                style={styles.picker}
              >
                {METHODS.map((m) => (
                  <Picker.Item key={m} label={m} value={m} />
                ))}
              </Picker>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={pickProof}>
              <Text style={styles.secondaryBtnText}>
                {proofUri ? 'Proof selected ✓' : 'Attach proof (optional)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={savePayAll}>
              <Text style={styles.btnText}>Record All Payments</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* History */}
      <Modal visible={historyVisible} animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment History</Text>
            <TouchableOpacity onPress={() => setHistoryVisible(false)}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {!history.length ? (
              <Text style={styles.empty}>No payments yet.</Text>
            ) : (
              history.map((h) => (
                <View key={h.id} style={styles.listCard}>
                  <Text style={styles.listName}>
                    {(h as any).class_fees?.fee_types?.name || 'Payment'}
                  </Text>
                  <Text style={styles.listMeta}>
                    ₦{Number(h.amount).toLocaleString()} · {h.payment_method}
                  </Text>
                  <Text style={styles.listMeta}>
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString()
                      : ''}
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
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 12,
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  ledgerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  feeName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 8,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  meta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#64748b',
  },
  val: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#0f172a',
  },
  balance: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#dc2626',
  },
  paidBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#16a34a',
  },
  recordBtn: {
    marginTop: 10,
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  recordBtnText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  paidBtn: {
    marginTop: 10,
    backgroundColor: '#dcfce7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  paidBtnText: {
    color: '#16a34a',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  totals: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  totalLine: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    marginBottom: 4,
  },
  totalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  payAllBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payAllText: { color: '#fff', fontFamily: 'SpaceGrotesk_700Bold' },
  historyBtn: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  historyText: {
    color: '#0f172a',
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
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
  },
  closeX: { fontSize: 20, color: '#64748b', padding: 4 },
  modalBody: { padding: 16, paddingBottom: 40 },
  btn: {
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  listName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#0f172a',
  },
  listMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});

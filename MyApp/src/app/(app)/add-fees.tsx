import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

const SESSIONS = ['2025/2026', '2026/2027', '2027/2028'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

export default function AddFeesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [feeTypes, setFeeTypes] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);

  const [session, setSession] = useState('2025/2026');
  const [term, setTerm] = useState('First Term');
  const [classId, setClassId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [amount, setAmount] = useState('');

  const loadMeta = async () => {
    try {
      const [{ data: cls }, { data: types }] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('fee_types').select('id, name').order('name'),
      ]);
      setClasses(cls || []);
      setFeeTypes(types || []);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAssigned = async () => {
    if (!classId || !session || !term) {
      setAssigned([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('class_fees')
        .select('id, amount, fee_type_id, fee_types(name)')
        .eq('class_id', classId)
        .eq('session', session)
        .eq('term', term)
        .order('created_at');
      if (error) throw error;
      setAssigned(data || []);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadMeta();
    }, [])
  );

  useEffect(() => {
    loadAssigned();
  }, [classId, session, term]);

  const save = async () => {
    const amt = Number(amount);
    if (!classId || !feeTypeId || !session || !term || !amt || amt <= 0) {
      showToast('Fill class, fee type, session, term and a valid amount.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('class_fees').insert({
        class_id: classId,
        fee_type_id: feeTypeId,
        session,
        term,
        amount: amt,
      });
      if (error) throw error;
      setAmount('');
      setFeeTypeId('');
      await loadAssigned();
      showToast('Class fee added successfully.', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (fee: any) => {
    const run = async () => {
      setSaving(true);
      try {
        const { error } = await supabase.from('class_fees').delete().eq('id', fee.id);
        if (error) throw error;
        await loadAssigned();
        showToast('Class fee deleted successfully.', 'success');
      } catch (err) {
        showToast(getFriendlyError(err), 'error');
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Delete this fee?')) run();
      return;
    }
    Alert.alert('Delete fee', 'Delete this fee?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const total = assigned.reduce((s, f) => s + Number(f.amount || 0), 0);

  return (
    <View style={styles.page}>
      {(loading || saving) && (
        <LoadingSpinner visible message={saving ? 'Saving...' : 'Loading...'} />
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setLoading(true);
              loadMeta().then(loadAssigned);
            }}
          />
        }
      >
        <Text style={styles.header}>Class Fees</Text>

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

          <Text style={styles.label}>Fee Type</Text>
          <View style={styles.selectBox}>
            <Picker selectedValue={feeTypeId} onValueChange={setFeeTypeId} style={styles.picker}>
              <Picker.Item label="Select fee type" value="" color="#94a3b8" />
              {feeTypes.map((f) => (
                <Picker.Item key={f.id} label={f.name} value={f.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Amount (₦)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            value={amount}
            onChangeText={setAmount}
          />

          <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>Add Fee</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Assigned Fees</Text>
        {!classId ? (
          <Text style={styles.empty}>Select a class to view assigned fees.</Text>
        ) : !assigned.length ? (
          <Text style={styles.empty}>No fees assigned yet.</Text>
        ) : (
          <>
            {assigned.map((fee) => (
              <View key={fee.id} style={styles.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>
                    {(fee as any).fee_types?.name || 'Fee'}
                  </Text>
                  <Text style={styles.listMeta}>
                    ₦{Number(fee.amount).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(fee)}>
                  <Text style={styles.deleteLink}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={styles.total}>
              Total: ₦{total.toLocaleString()}
            </Text>
          </>
        )}
      </ScrollView>
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
    marginBottom: 20,
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
  btn: {
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#0f172a',
  },
  listMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  deleteLink: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  total: {
    marginTop: 8,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#1e40af',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

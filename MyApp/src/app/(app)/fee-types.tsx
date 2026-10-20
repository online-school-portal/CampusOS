import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

export default function FeeTypesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [feeTypes, setFeeTypes] = useState<any[]>([]);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from('fee_types')
        .select('id, name, created_at')
        .order('name');
      if (error) throw error;
      setFeeTypes(data || []);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [])
  );

  const save = async () => {
    const names = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!names.length) {
      showToast('Enter at least one fee type.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('fee_types')
        .insert(names.map((name) => ({ name })));
      if (error) throw error;
      setText('');
      await load();
      showToast('Fee types added successfully.', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: any) => {
    const run = async () => {
      setSaving(true);
      try {
        const { error } = await supabase.from('fee_types').delete().eq('id', item.id);
        if (error) throw error;
        await load();
        showToast('Fee type deleted.', 'success');
      } catch (err) {
        showToast(getFriendlyError(err), 'error');
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${item.name}"?`)) run();
      return;
    }
    Alert.alert('Delete fee type', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <View style={styles.page}>
      {(loading || saving) && (
        <LoadingSpinner
          visible
          message={saving ? 'Saving...' : 'Loading...'}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Fee Types</Text>
        <Text style={styles.count}>
          Total Fee Types:{' '}
          <Text style={styles.countBold}>{feeTypes.length}</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Enter Fee Types (one per line)</Text>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={6}
            placeholder={'School Fee\nExam Fee\nICT Fee'}
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>Save Fee Types</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Registered Fee Types</Text>
        {!feeTypes.length ? (
          <Text style={styles.empty}>No fee types registered yet.</Text>
        ) : (
          feeTypes.map((ft) => (
            <View key={ft.id} style={styles.listCard}>
              <Text style={styles.listName}>{ft.name}</Text>
              <TouchableOpacity onPress={() => remove(ft)}>
                <Text style={styles.deleteLink}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
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
    marginBottom: 8,
  },
  count: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
    marginBottom: 14,
  },
  countBold: { fontFamily: 'SpaceGrotesk_700Bold', color: '#0f172a' },
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
    marginBottom: 8,
  },
  textarea: {
    minHeight: 120,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#0f172a',
    textAlignVertical: 'top',
    marginBottom: 12,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#0f172a',
  },
  deleteLink: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 12,
  },
});

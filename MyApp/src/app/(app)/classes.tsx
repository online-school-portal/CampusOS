import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function ClassesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (err: any) {
      console.log('Load classes error:', err);
      Alert.alert('Error', err.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter at least one class name');
      return;
    }

    setSaving(true);
    try {
      const { data: schoolId } = await supabase.rpc('current_user_school_id');

      const names = text
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean);

      const rows = names.map((name) => ({
        name,
        school_id: schoolId,
      }));

      const { error } = await supabase.from('classes').insert(rows);
      if (error) throw error;

      setText('');
      await loadClasses();
      Alert.alert('Success', `${names.length} class(es) added`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save classes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Delete Class', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('classes').delete().eq('id', item.id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setClasses((prev) => prev.filter((c) => c.id !== item.id));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Classes</Text>

      <Text style={styles.count}>
        Total Classes: <Text style={styles.countBold}>{classes.length}</Text>
      </Text>

      <Text style={styles.label}>Enter Classes (one per line)</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={5}
        placeholder={'e.g.\nJSS 1\nJSS 2\nSSS 1'}
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save Classes</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 24 }]}>Registered Classes</Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowName}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No classes registered yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  header: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  count: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  countBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30,
    fontSize: 15,
  },
});

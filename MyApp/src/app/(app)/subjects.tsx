import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

export default function SubjectsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) loadSubjects(selectedClass);
    else setSubjects([]);
  }, [selectedClass]);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setClasses(data || []);
    } catch (err: any) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', classId)
        .order('name');
      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.log(err);
      setSubjects([]);
    }
  };

  const handleSave = async () => {
    if (!selectedClass) {
      showToast('Please select a class first', 'error');
      return;
    }
    if (!text.trim()) {
      showToast('Please enter at least one subject', 'error');
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
        class_id: selectedClass,
        school_id: schoolId,
      }));
      const { error } = await supabase.from('subjects').insert(rows);
      if (error) throw error;
      setText('');
      await loadSubjects(selectedClass);
      showToast(`${names.length} subject(s) added`, 'success');
    } catch (err: any) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (item: any) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', item.id);
      if (error) throw error;
      setSubjects((prev) => prev.filter((s) => s.id !== item.id));
      showToast('Subject deleted', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    const msg = `Delete "${item.name}"?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) performDelete(item);
      return;
    }
    Alert.alert('Delete Subject', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(item) },
    ]);
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {saving ? <LoadingSpinner visible message="Please wait..." /> : null}

      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Subjects</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Select Class</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={setSelectedClass}
              style={styles.picker}
            >
              <Picker.Item label="-- Select Class --" value="" color="#94a3b8" />
              {classes.map((cls) => (
                <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
              ))}
            </Picker>
          </View>

          {selectedClass ? (
            <>
              <Text style={styles.count}>
                Subjects in view:{' '}
                <Text style={styles.countBold}>{subjects.length}</Text>
              </Text>

              <Text style={styles.label}>Enter Subjects (one per line)</Text>
              <TextInput
                style={styles.textarea}
                multiline
                numberOfLines={6}
                placeholder={'e.g.\nMathematics\nEnglish\nBiology'}
                placeholderTextColor="#94a3b8"
                value={text}
                onChangeText={setText}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveText}>Save Subjects</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 20 }]}>
                Registered Subjects
              </Text>

              {subjects.length === 0 ? (
                <Text style={styles.empty}>No subjects for this class yet.</Text>
              ) : (
                <View style={styles.list}>
                  {subjects.map((item) => (
                    <View key={item.id} style={styles.row}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <TouchableOpacity onPress={() => handleDelete(item)}>
                        <Ionicons name="trash-outline" size={20} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.empty}>Select a class to manage subjects</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  pageScroll: { flex: 1 },
  pageContent: { padding: 16, paddingBottom: 48 },
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
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: { height: 48 },
  count: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  countBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
  },
  textarea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    fontSize: 15,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#0f172a',
  },
  saveBtn: {
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  list: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
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
    if (selectedClass) {
      loadSubjects(selectedClass);
    } else {
      setSubjects([]);
    }
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
      showToast(getFriendlyError(err), 'error');
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

      const className = classes.find((c) => c.id === selectedClass)?.name || null;

      const rows = names.map((name) => ({
        name,
        class_id: selectedClass,
        class: className,
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

  const handleDelete = (item: any) => {
    Alert.alert('Delete Subject', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          const { error } = await supabase.from('subjects').delete().eq('id', item.id);
          setSaving(false);
          if (error) {
            showToast(getFriendlyError(error), 'error');
          } else {
            setSubjects((prev) => prev.filter((s) => s.id !== item.id));
            showToast('Subject deleted', 'success');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {saving ? <LoadingSpinner visible={true} message="Saving..." /> : null}

      <Text style={styles.header}>Subjects</Text>

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
        <View style={{ flex: 1 }}>
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
            style={[styles.saveBtn, saving ? { opacity: 0.7 } : null]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>Save Subjects</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 24 }]}>Registered Subjects</Text>

          <FlatList
            data={subjects}
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
              <Text style={styles.empty}>No subjects for this class yet.</Text>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      ) : (
        <Text style={styles.empty}>Select a class to manage subjects</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  count: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  countBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
  },
  textarea: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 130,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 16,
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
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

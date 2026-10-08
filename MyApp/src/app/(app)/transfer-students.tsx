import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';

export default function TransferStudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [newClass, setNewClass] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudentsByClass(selectedClass);
    } else {
      setStudents([]);
      setSelectedStudent('');
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
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsByClass = async (classId: string) => {
    try {
      const { data: schoolId } = await supabase.rpc('current_user_school_id');

      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, current_class')
        .eq('school_id', schoolId)
        .eq('current_class', classId)
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
      setSelectedStudent('');
    } catch (err) {
      console.log(err);
    }
  };

  const handleTransfer = async () => {
    if (!selectedStudent || !newClass) {
      Alert.alert('Error', 'Please select a student and a new class');
      return;
    }

    if (selectedClass === newClass) {
      Alert.alert('Error', 'New class must be different from current class');
      return;
    }

    setTransferring(true);

    try {
      const { error } = await supabase
        .from('students')
        .update({ current_class: newClass })
        .eq('id', selectedStudent);

      if (error) throw error;

      const studentName =
        students.find((s) => s.id === selectedStudent)?.full_name || 'Student';

      Alert.alert('Success', `${studentName} transferred successfully`, [
        {
          text: 'OK',
          onPress: () => {
            setSelectedStudent('');
            setNewClass('');
            loadStudentsByClass(selectedClass);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Transfer Students</Text>

      <Text style={styles.label}>Current Class</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedClass}
          onValueChange={setSelectedClass}
          style={styles.picker}
        >
          <Picker.Item label="Select current class" value="" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Select Student</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedStudent}
          onValueChange={setSelectedStudent}
          style={styles.picker}
          enabled={!!selectedClass}
        >
          <Picker.Item label="Select student" value="" />
          {students.map((student) => (
            <Picker.Item
              key={student.id}
              label={`${student.full_name} (${student.student_id || 'N/A'})`}
              value={student.id}
            />
          ))}
        </Picker>
      </View>

      {selectedClass && students.length === 0 && (
        <Text style={styles.warning}>No students in this class</Text>
      )}

      <Text style={styles.label}>Transfer To (New Class)</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={newClass}
          onValueChange={setNewClass}
          style={styles.picker}
        >
          <Picker.Item label="Select new class" value="" />
          {classes
            .filter((cls) => cls.id !== selectedClass)
            .map((cls) => (
              <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
            ))}
        </Picker>
      </View>

      <TouchableOpacity
        style={[styles.button, transferring && { opacity: 0.7 }]}
        onPress={handleTransfer}
        disabled={transferring}
      >
        {transferring ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Transfer Student</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20, paddingBottom: 60 },
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
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerWrapper: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: { height: 50 },
  warning: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  button: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});

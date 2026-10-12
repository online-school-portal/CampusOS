import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

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
        .select('id, full_name, student_id, class_id, image_url')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
      setSelectedStudent('');
    } catch (err) {
      console.log('Load students error:', err);
      setStudents([]);
    }
  };

  const getClassName = (id: string) => {
    return classes.find((c) => c.id === id)?.name || null;
  };

  const selectedStudentData = students.find((s) => s.id === selectedStudent);

  const resetForm = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setNewClass('');
    setStudents([]);
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
        .update({
          class_id: newClass,
          student_class: getClassName(newClass),
        })
        .eq('id', selectedStudent);

      if (error) throw error;

      const studentName = selectedStudentData?.full_name || 'Student';

      Alert.alert('Success', `${studentName} transferred successfully`);
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading classes..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {transferring ? (
        <LoadingSpinner visible={true} message="Transferring student..." />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Transfer Students</Text>

        <Text style={styles.label}>Current Class</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedClass}
            onValueChange={(val) => {
              setSelectedClass(val);
              setSelectedStudent('');
              setNewClass('');
            }}
            style={styles.picker}
          >
            <Picker.Item label="Select current class" value="" color="#94a3b8" />
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
            enabled={!!selectedClass && students.length > 0}
          >
            <Picker.Item
              label={
                !selectedClass
                  ? 'Select class first'
                  : students.length === 0
                  ? 'No students in this class'
                  : 'Select student'
              }
              value=""
              color="#94a3b8"
            />
            {students.map((student) => (
              <Picker.Item
                key={student.id}
                label={`${student.full_name} (${student.student_id || 'N/A'})`}
                value={student.id}
              />
            ))}
          </Picker>
        </View>

        {/* Show selected student with photo */}
        {selectedStudentData ? (
          <View style={styles.studentPreview}>
            {selectedStudentData.image_url ? (
              <Image
                source={{ uri: selectedStudentData.image_url }}
                style={styles.studentAvatar}
              />
            ) : (
              <View style={[styles.studentAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {(selectedStudentData.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.studentName}>{selectedStudentData.full_name}</Text>
              <Text style={styles.studentId}>
                ID: {selectedStudentData.student_id || 'N/A'}
              </Text>
            </View>
          </View>
        ) : null}

        {selectedClass && students.length === 0 ? (
          <Text style={styles.warning}>No students in this class</Text>
        ) : null}

        <Text style={styles.label}>Transfer To (New Class)</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={newClass}
            onValueChange={setNewClass}
            style={styles.picker}
          >
            <Picker.Item label="Select new class" value="" color="#94a3b8" />
            {classes
              .filter((cls) => cls.id !== selectedClass)
              .map((cls) => (
                <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
              ))}
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, transferring ? { opacity: 0.7 } : null]}
          onPress={handleTransfer}
          disabled={transferring}
        >
          <Text style={styles.buttonText}>Transfer Student</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
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
  picker: {
    height: 50,
  },
  studentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
  },
  avatarLetter: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
  },
  studentName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
  },
  studentId: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
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

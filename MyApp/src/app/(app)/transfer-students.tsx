import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

export default function TransferStudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [newClass, setNewClass] = useState('');
  /** Web: transfer entire class when user confirms after picking source class */
  const [transferEntireClass, setTransferEntireClass] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

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
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsByClass = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, class_id, image_url')
        .eq('class_id', classId)
        .order('full_name');
      if (error) throw error;
      return data || [];
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
      return [];
    }
  };

  const askTransferEntireClass = (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return Promise.resolve(
        typeof window !== 'undefined' &&
          window.confirm('Transfer entire class?\n\nOK = Yes\nCancel = No')
      );
    }
    return new Promise((resolve) => {
      Alert.alert(
        'Transfer entire class?',
        'Move every student in this class to a new class?',
        [
          { text: 'No — one student', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Yes — entire class', onPress: () => resolve(true) },
        ]
      );
    });
  };

  const onSourceClassChange = async (classId: string) => {
    setSelectedClass(classId);
    setSelectedStudent('');
    setNewClass('');
    setTransferEntireClass(false);
    setStudents([]);

    if (!classId) return;

    const list = await loadStudentsByClass(classId);
    if (!list.length) {
      showToast('No students in this class yet!', 'error');
      setStudents([]);
      return;
    }

    const entire = await askTransferEntireClass();
    setTransferEntireClass(entire);
    setStudents(list);

    if (entire) {
      setSelectedStudent('');
      showToast('Entire class selected. Choose the new class.', 'info');
    }
  };

  const resetForm = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setNewClass('');
    setStudents([]);
    setTransferEntireClass(false);
  };

  const doTransferStudent = async (studentId: string, newClassId: string) => {
    const { error } = await supabase
      .from('students')
      .update({ class_id: newClassId })
      .eq('id', studentId);
    if (error) throw error;
  };

  const doTransferClass = async (oldClassId: string, newClassId: string) => {
    const { error } = await supabase
      .from('students')
      .update({ class_id: newClassId })
      .eq('class_id', oldClassId);
    if (error) throw error;
  };

  const handleTransfer = async () => {
    if (!newClass) {
      showToast('Please select the new class.', 'error');
      return;
    }
    if (!transferEntireClass && !selectedStudent) {
      showToast('Please select a student.', 'error');
      return;
    }
    if (selectedClass === newClass) {
      showToast('New class must be different from current class', 'error');
      return;
    }

    setTransferring(true);
    try {
      if (transferEntireClass) {
        await doTransferClass(selectedClass, newClass);
        showToast('Entire class transferred successfully.', 'success');
      } else {
        await doTransferStudent(selectedStudent, newClass);
        showToast('Student transferred successfully.', 'success');
      }
      resetForm();
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setTransferring(false);
    }
  };

  const selectedStudentData = students.find((s) => s.id === selectedStudent);

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen={false} />;
  }

  return (
    <View style={styles.page}>
      {transferring ? (
        <LoadingSpinner
          visible
          message={
            transferEntireClass
              ? 'Transferring class...'
              : 'Transferring student...'
          }
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Transfer Students</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Current Class</Text>
          <View style={styles.selectBox}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={onSourceClassChange}
              style={styles.picker}
            >
              <Picker.Item label="-- Select Class --" value="" color="#94a3b8" />
              {classes.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
          </View>

          {transferEntireClass ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Entire class selected — all students will move to the new class.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setTransferEntireClass(false);
                  showToast('Switched to single student mode.', 'info');
                }}
              >
                <Text style={styles.bannerLink}>Switch to single student</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Student</Text>
              <View style={styles.selectBox}>
                <Picker
                  selectedValue={selectedStudent}
                  onValueChange={setSelectedStudent}
                  style={styles.picker}
                  enabled={!!selectedClass && students.length > 0 && !transferEntireClass}
                >
                  <Picker.Item
                    label={
                      !selectedClass
                        ? 'Select class first'
                        : students.length === 0
                        ? 'No students'
                        : '-- Select Student --'
                    }
                    value=""
                    color="#94a3b8"
                  />
                  {students.map((s) => (
                    <Picker.Item
                      key={s.id}
                      label={`${s.full_name} (${s.student_id || 'N/A'})`}
                      value={s.id}
                    />
                  ))}
                </Picker>
              </View>

              {selectedStudentData ? (
                <View style={styles.studentPreview}>
                  {selectedStudentData.image_url ? (
                    <Image
                      source={{ uri: selectedStudentData.image_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPh]}>
                      <Text style={styles.avatarLetter}>
                        {(selectedStudentData.full_name || 'S')[0]}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.studentName}>
                      {selectedStudentData.full_name}
                    </Text>
                    <Text style={styles.studentMeta}>
                      {selectedStudentData.student_id || '—'}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}

          <Text style={styles.label}>New Class</Text>
          <View style={styles.selectBox}>
            <Picker
              selectedValue={newClass}
              onValueChange={setNewClass}
              style={styles.picker}
              enabled={!!selectedClass}
            >
              <Picker.Item label="-- Select New Class --" value="" color="#94a3b8" />
              {classes
                .filter((c) => c.id !== selectedClass)
                .map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} />
                ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={[styles.btn, transferring && { opacity: 0.7 }]}
            onPress={handleTransfer}
            disabled={transferring}
          >
            <Text style={styles.btnText}>
              {transferEntireClass ? 'Transfer Entire Class' : 'Transfer Student'}
            </Text>
          </TouchableOpacity>
        </View>
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
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: { height: 48 },
  banner: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  bannerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e40af',
    fontSize: 13,
    marginBottom: 6,
  },
  bannerLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  studentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e2e8f0' },
  avatarPh: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff' },
  avatarLetter: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
    fontSize: 18,
  },
  studentName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: '#0f172a',
  },
  studentMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#64748b',
  },
  btn: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
});

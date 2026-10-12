import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  showToast,
  getFriendlyError,
  updateStudentImage,
  deleteStudentViaEdge,
} from '@/utils/toast';

export default function ManageStudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [search, setSearch] = useState('');

  const [editVisible, setEditVisible] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .order('name');
    if (error) {
      showToast(getFriendlyError(error), 'error');
      return;
    }
    setClasses(data || []);
  };

  const loadStudents = useCallback(async () => {
    try {
      const { data: schoolId, error: schoolErr } = await supabase.rpc(
        'current_user_school_id'
      );
      if (schoolErr) throw schoolErr;

      let query = supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (selectedClass && selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.log('Load students error:', err);
      showToast(getFriendlyError(err), 'error');
    }
  }, [selectedClass]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadClasses();
      await loadStudents();
      setLoading(false);
    };
    init();

    const studentsChannel = supabase
      .channel('manage-students-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => loadStudents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
    };
  }, []);

  useEffect(() => {
    if (!loading) loadStudents();
  }, [selectedClass, loadStudents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '—';
    return classes.find((c) => c.id === classId)?.name || '—';
  };

  const openEdit = (student: any) => {
    setEditStudent(student);
    setEditPhoto(student.image_url || null);
    setForm({
      student_id: student.student_id || '',
      full_name: student.full_name || '',
      date_of_birth: student.date_of_birth || '',
      sex: student.sex || '',
      nationality: student.nationality || '',
      state_of_origin: student.state_of_origin || '',
      lga: student.lga || '',
      student_address: student.student_address || '',
      class_id: student.class_id || '',
      admission_class_id: student.admission_class_id || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
      parent_address: student.parent_address || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      guardian_email: student.guardian_email || '',
      guardian_address: student.guardian_address || '',
      sibling_name: student.sibling_name || '',
      sibling_class_id: student.sibling_class_id || '',
      sibling_sex: student.sibling_sex || '',
    });
    setEditVisible(true);
  };

  const pickEditPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled) setEditPhoto(result.assets[0].uri);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const takeEditPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('Camera permission is required', 'error');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled) setEditPhoto(result.assets[0].uri);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const saveEdit = async () => {
    if (!form.full_name?.trim() || !form.student_id?.trim()) {
      showToast('Full Name and Student ID are required', 'error');
      return;
    }

    setBusy(true);
    try {
      let imageUrl = editStudent.image_url;
      let imagePath = editStudent.image_path;

      // New local photo → edge function update-student-image
      if (
        editPhoto &&
        editPhoto !== editStudent.image_url &&
        !editPhoto.includes('supabase.co')
      ) {
        try {
          const uploaded = await updateStudentImage(
            editStudent.id,
            editPhoto,
            editStudent.image_path || ''
          );
          imageUrl = uploaded.image_url;
          imagePath = uploaded.image_path;
          showToast('Photo updated', 'success');
        } catch (uploadErr: any) {
          console.log('Upload error:', uploadErr);
          showToast(getFriendlyError(uploadErr), 'error');
        }
      }

      const className = (id: string) =>
        classes.find((c) => c.id === id)?.name || null;

      const { error } = await supabase
        .from('students')
        .update({
          student_id: form.student_id.trim(),
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth || null,
          sex: form.sex || null,
          nationality: form.nationality || null,
          state_of_origin: form.state_of_origin || null,
          lga: form.lga || null,
          student_address: form.student_address || null,
          class_id: form.class_id || null,
          admission_class_id: form.admission_class_id || null,
          student_class: form.class_id ? className(form.class_id) : null,
          admission_class: form.admission_class_id
            ? className(form.admission_class_id)
            : null,
          parent_name: form.parent_name || null,
          parent_phone: form.parent_phone || null,
          parent_email: form.parent_email || null,
          parent_address: form.parent_address || null,
          guardian_name: form.guardian_name || null,
          guardian_phone: form.guardian_phone || null,
          guardian_email: form.guardian_email || null,
          guardian_address: form.guardian_address || null,
          sibling_name: form.sibling_name || null,
          sibling_class_id: form.sibling_class_id || null,
          sibling_class: form.sibling_class_id
            ? className(form.sibling_class_id)
            : null,
          sibling_sex: form.sibling_sex || null,
          image_url: imageUrl,
          image_path: imagePath,
        })
        .eq('id', editStudent.id);

      if (error) throw error;

      setEditVisible(false);
      await loadStudents();
      showToast('Student updated successfully', 'success');
    } catch (err: any) {
      console.log('Save error:', err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (student: any) => {
    Alert.alert(
      'Delete Student',
      `Delete ${student.full_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              // Edge function uses student_id (business id), not uuid
              await deleteStudentViaEdge(student.student_id);
              setStudents((prev) => prev.filter((s) => s.id !== student.id));
              showToast('Student deleted', 'success');
            } catch (err: any) {
              console.log('Delete error:', err);
              showToast(getFriendlyError(err), 'error');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q)
    );
  });

  const setField = (key: string, value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );

  const renderStudent = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {(item.full_name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.meta}>ID: {item.student_id || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.label}>
          Sex: <Text style={styles.value}>{item.sex || '—'}</Text>
        </Text>
        <Text style={styles.label}>
          Class: <Text style={styles.value}>{getClassName(item.class_id)}</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Ionicons name="create-outline" size={16} color="#1e40af" />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={16} color="#dc2626" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <LoadingSpinner message="Loading students..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {busy ? <LoadingSpinner visible={true} message="Please wait..." /> : null}

      <Text style={styles.header}>Manage Students</Text>

      <TextInput
        style={styles.search}
        placeholder="Search by name or ID..."
        placeholderTextColor="#94a3b8"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedClass}
          onValueChange={setSelectedClass}
          style={styles.picker}
        >
          <Picker.Item label="All Classes" value="all" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.count}>
        Students in view:{' '}
        <Text style={styles.countBold}>{filtered.length}</Text>
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e40af']}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No students found</Text>
        }
      />

      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Student</Text>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.photoWrapper}>
              <TouchableOpacity style={styles.photoBox} onPress={pickEditPhoto}>
                {editPhoto ? (
                  <Image
                    source={{ uri: editPhoto }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#94a3b8" />
                    <Text style={styles.photoText}>PHOTO</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraBtn} onPress={takeEditPhoto}>
                <Ionicons name="camera" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <Field label="Student ID">
              <TextInput
                style={styles.input}
                placeholder="Student ID"
                placeholderTextColor="#94a3b8"
                value={form.student_id}
                onChangeText={(v) => setField('student_id', v)}
              />
            </Field>

            <Field label="Full Name">
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#94a3b8"
                value={form.full_name}
                onChangeText={(v) => setField('full_name', v)}
              />
            </Field>

            <Field label="Date of Birth">
              {Platform.OS === 'web' ? (
                <View style={styles.input}>
                  {/* @ts-ignore */}
                  <input
                    type="date"
                    value={form.date_of_birth || ''}
                    onChange={(e: any) => setField('date_of_birth', e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: 15,
                      width: '100%',
                      backgroundColor: 'transparent',
                    }}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={form.date_of_birth}
                  onChangeText={(v) => setField('date_of_birth', v)}
                />
              )}
            </Field>

            <Field label="Sex">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={form.sex}
                  onValueChange={(v) => setField('sex', v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Sex" value="" color="#94a3b8" />
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                </Picker>
              </View>
            </Field>

            <Field label="Nationality">
              <TextInput style={styles.input} placeholder="Nationality" placeholderTextColor="#94a3b8" value={form.nationality} onChangeText={(v) => setField('nationality', v)} />
            </Field>
            <Field label="State of Origin">
              <TextInput style={styles.input} placeholder="State of Origin" placeholderTextColor="#94a3b8" value={form.state_of_origin} onChangeText={(v) => setField('state_of_origin', v)} />
            </Field>
            <Field label="LGA">
              <TextInput style={styles.input} placeholder="LGA" placeholderTextColor="#94a3b8" value={form.lga} onChangeText={(v) => setField('lga', v)} />
            </Field>
            <Field label="Student Address">
              <TextInput style={styles.input} placeholder="Student Address" placeholderTextColor="#94a3b8" value={form.student_address} onChangeText={(v) => setField('student_address', v)} />
            </Field>

            <Text style={styles.sectionTitle}>Classes</Text>

            <Field label="Class Admitted Into">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={form.admission_class_id}
                  onValueChange={(v) => setField('admission_class_id', v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select admission class" value="" color="#94a3b8" />
                  {classes.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
            </Field>

            <Field label="Current Class">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={form.class_id}
                  onValueChange={(v) => setField('class_id', v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select current class" value="" color="#94a3b8" />
                  {classes.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
            </Field>

            <Text style={styles.sectionTitle}>Parent</Text>
            <Field label="Parent Name">
              <TextInput style={styles.input} placeholder="Parent Name" placeholderTextColor="#94a3b8" value={form.parent_name} onChangeText={(v) => setField('parent_name', v)} />
            </Field>
            <Field label="Parent Phone">
              <TextInput style={styles.input} placeholder="Parent Phone" placeholderTextColor="#94a3b8" value={form.parent_phone} onChangeText={(v) => setField('parent_phone', v)} keyboardType="phone-pad" />
            </Field>
            <Field label="Parent Email">
              <TextInput style={styles.input} placeholder="Parent Email" placeholderTextColor="#94a3b8" value={form.parent_email} onChangeText={(v) => setField('parent_email', v)} keyboardType="email-address" />
            </Field>
            <Field label="Parent Address">
              <TextInput style={styles.input} placeholder="Parent Address" placeholderTextColor="#94a3b8" value={form.parent_address} onChangeText={(v) => setField('parent_address', v)} />
            </Field>

            <Text style={styles.sectionTitle}>Guardian</Text>
            <Field label="Guardian Name">
              <TextInput style={styles.input} placeholder="Guardian Name" placeholderTextColor="#94a3b8" value={form.guardian_name} onChangeText={(v) => setField('guardian_name', v)} />
            </Field>
            <Field label="Guardian Phone">
              <TextInput style={styles.input} placeholder="Guardian Phone" placeholderTextColor="#94a3b8" value={form.guardian_phone} onChangeText={(v) => setField('guardian_phone', v)} keyboardType="phone-pad" />
            </Field>
            <Field label="Guardian Email">
              <TextInput style={styles.input} placeholder="Guardian Email" placeholderTextColor="#94a3b8" value={form.guardian_email} onChangeText={(v) => setField('guardian_email', v)} keyboardType="email-address" />
            </Field>
            <Field label="Guardian Address">
              <TextInput style={styles.input} placeholder="Guardian Address" placeholderTextColor="#94a3b8" value={form.guardian_address} onChangeText={(v) => setField('guardian_address', v)} />
            </Field>

            <Text style={styles.sectionTitle}>Sibling</Text>
            <Field label="Sibling Name">
              <TextInput style={styles.input} placeholder="Sibling Name" placeholderTextColor="#94a3b8" value={form.sibling_name} onChangeText={(v) => setField('sibling_name', v)} />
            </Field>
            <Field label="Sibling Class">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={form.sibling_class_id}
                  onValueChange={(v) => setField('sibling_class_id', v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Sibling Class" value="" color="#94a3b8" />
                  {classes.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
            </Field>
            <Field label="Sibling Sex">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={form.sibling_sex}
                  onValueChange={(v) => setField('sibling_sex', v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Sibling Sex" value="" color="#94a3b8" />
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                </Picker>
              </View>
            </Field>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20 },
  header: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#0f172a',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: { height: 50 },
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  avatarLetter: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
  },
  name: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
  },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { fontSize: 13, color: '#64748b' },
  value: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  actions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    borderRadius: 10,
  },
  editText: {
    color: '#1e40af',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteText: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 40,
    fontSize: 15,
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
  modalBody: { padding: 20, paddingBottom: 40 },
  photoWrapper: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  photoBox: {
    width: 90,
    height: 90,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center' },
  photoText: { fontSize: 9, fontWeight: '700', color: '#64748b' },
  cameraBtn: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e40af',
    marginTop: 12,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#6b7280',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
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
});

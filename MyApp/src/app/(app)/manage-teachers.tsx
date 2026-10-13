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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  showToast,
  getFriendlyError,
  updateTeacherImage,
  deleteTeacherViaEdge,
  updateTeacherAuth,
  updateTeacherClasses,
} from '@/utils/toast';

export default function ManageTeachersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('Please wait...');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [editVisible, setEditVisible] = useState(false);
  const [editTeacher, setEditTeacher] = useState<any>(null);
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

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

  const loadTeachers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.log(err);
      showToast(getFriendlyError(err), 'error');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadClasses();
      await loadTeachers();
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel('manage-teachers-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teachers' },
        () => loadTeachers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTeachers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeachers();
    setRefreshing(false);
  };

  const openEdit = async (teacher: any) => {
    setEditTeacher(teacher);
    setEditPhoto(teacher.image_url || null);
    setNewPassword('');
    setForm({
      teacher_id: teacher.teacher_id || '',
      full_name: teacher.full_name || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      qualification: teacher.qualification || '',
      subject_specialization: teacher.subject_specialization || '',
      years_of_experience: teacher.years_of_experience
        ? String(teacher.years_of_experience)
        : '',
      joining_date: teacher.joining_date || '',
      auth_id: teacher.auth_id || null,
    });

    // Load assigned classes from teacher_classes
    try {
      const { data: assigned, error } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacher.id);
      if (error) throw error;
      setSelectedClassIds((assigned || []).map((r: any) => r.class_id));
    } catch (err) {
      console.log(err);
      setSelectedClassIds([]);
    }

    setEditVisible(true);
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
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
    if (!form.full_name?.trim() || !form.teacher_id?.trim()) {
      showToast('Teacher ID and Full Name are required', 'error');
      return;
    }
    if (!selectedClassIds.length) {
      showToast('Please assign at least one class.', 'error');
      return;
    }

    setBusyMessage('Saving teacher...');
    setBusy(true);
    try {
      let image_url = editTeacher.image_url;
      let image_path = editTeacher.image_path;

      if (
        editPhoto &&
        editPhoto !== editTeacher.image_url &&
        !editPhoto.includes('supabase.co')
      ) {
        try {
          const uploaded = await updateTeacherImage(
            editTeacher.id,
            editPhoto,
            editTeacher.image_path || ''
          );
          image_url = uploaded.image_url || uploaded.url || image_url;
          image_path = uploaded.image_path || uploaded.path || image_path;
          showToast('Photo updated', 'success');
        } catch (uploadErr) {
          showToast(getFriendlyError(uploadErr), 'error');
        }
      }

      // Auth update if email or password changed
      if (form.email || newPassword.trim()) {
        try {
          await updateTeacherAuth({
            teacher_id: editTeacher.id,
            auth_id: form.auth_id || null,
            email: form.email || null,
            password: newPassword.trim() || null,
          });
        } catch (authErr) {
          showToast(getFriendlyError(authErr), 'error');
          // continue with class/profile update
        }
      }

      const teacherPayload = {
        teacher_id: form.teacher_id.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        qualification: form.qualification?.trim() || null,
        subject_specialization: form.subject_specialization?.trim() || null,
        years_of_experience: form.years_of_experience
          ? parseInt(form.years_of_experience, 10)
          : null,
        joining_date: form.joining_date || null,
        image_url,
        image_path,
      };

      await updateTeacherClasses({
        teacher_id: editTeacher.id,
        teacher: teacherPayload,
        class_ids: selectedClassIds,
      });

      setEditVisible(false);
      await loadTeachers();
      showToast('Teacher updated successfully', 'success');
    } catch (err) {
      console.log(err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const performDelete = async (teacher: any) => {
    setBusyMessage('Deleting teacher...');
    setBusy(true);
    try {
      console.log('[delete-teacher] uuid=', teacher.id);
      const result = await deleteTeacherViaEdge(teacher.id);
      console.log('[delete-teacher] response=', result);
      await loadTeachers();
      showToast('Teacher deleted successfully.', 'success');
    } catch (err) {
      console.log('[delete-teacher] FAILED', err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (teacher: any) => {
    if (!teacher?.id) {
      showToast('Cannot delete: missing teacher id', 'error');
      return;
    }
    const message = `Delete ${teacher.full_name}? This removes teacher, photo & auth.`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        performDelete(teacher);
      }
      return;
    }

    Alert.alert('Delete Teacher', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => performDelete(teacher),
      },
    ]);
  };

  const filtered = teachers.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.full_name?.toLowerCase().includes(q) ||
      t.teacher_id?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q)
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

  const renderTeacher = ({ item }: { item: any }) => (
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
              {(item.full_name || 'T')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name || 'Unknown'}</Text>
          <Text style={styles.meta}>ID: {item.teacher_id || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.label}>
          Subject:{' '}
          <Text style={styles.value}>
            {item.subject_specialization || '—'}
          </Text>
        </Text>
        <Text style={styles.label}>
          Class Teacher:{' '}
          <Text style={styles.value}>{item.class_teacher || 'None'}</Text>
        </Text>
        <Text style={styles.label}>
          Experience:{' '}
          <Text style={styles.value}>
            {item.years_of_experience
              ? `${item.years_of_experience} Years`
              : '—'}
          </Text>
        </Text>
        <Text style={styles.label}>
          Phone: <Text style={styles.value}>{item.phone || '—'}</Text>
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
    return <LoadingSpinner message="Loading teachers..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {busy ? <LoadingSpinner visible={true} message={busyMessage} /> : null}

      <Text style={styles.header}>Manage Teachers</Text>

      <TextInput
        style={styles.search}
        placeholder="Search by name, ID or email..."
        placeholderTextColor="#94a3b8"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.count}>
        Teachers: <Text style={styles.countBold}>{filtered.length}</Text>
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderTeacher}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e40af']}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No teachers found</Text>
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
            <Text style={styles.modalTitle}>Edit Teacher</Text>
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

            <Field label="Teacher ID">
              <TextInput
                style={styles.input}
                placeholder="Teacher ID"
                placeholderTextColor="#94a3b8"
                value={form.teacher_id}
                onChangeText={(v) => setField('teacher_id', v)}
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
            <Field label="Phone">
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#94a3b8"
                value={form.phone}
                onChangeText={(v) => setField('phone', v)}
                keyboardType="phone-pad"
              />
            </Field>
            <Field label="Email">
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#94a3b8"
                value={form.email}
                onChangeText={(v) => setField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label="New Password (leave blank to keep)">
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#94a3b8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </Field>
            <Field label="Qualification">
              <TextInput
                style={styles.input}
                placeholder="Qualification"
                placeholderTextColor="#94a3b8"
                value={form.qualification}
                onChangeText={(v) => setField('qualification', v)}
              />
            </Field>
            <Field label="Subject Specialization">
              <TextInput
                style={styles.input}
                placeholder="Subject Specialization"
                placeholderTextColor="#94a3b8"
                value={form.subject_specialization}
                onChangeText={(v) => setField('subject_specialization', v)}
              />
            </Field>

            <Text style={styles.sectionTitle}>Assigned Classes *</Text>
            {classes.map((cls) => {
              const checked = selectedClassIds.includes(cls.id);
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classRow, checked && styles.classRowChecked]}
                  onPress={() => toggleClass(cls.id)}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? '#1e40af' : '#94a3b8'}
                  />
                  <Text style={styles.className}>{cls.name}</Text>
                </TouchableOpacity>
              );
            })}

            <Field label="Years of Experience">
              <TextInput
                style={styles.input}
                placeholder="Years"
                placeholderTextColor="#94a3b8"
                value={form.years_of_experience}
                onChangeText={(v) => setField('years_of_experience', v)}
                keyboardType="number-pad"
              />
            </Field>
            <Field label="Joining Date">
              {Platform.OS === 'web' ? (
                <View style={styles.input}>
                  {/* @ts-ignore */}
                  <input
                    type="date"
                    value={form.joining_date || ''}
                    onChange={(e: any) => setField('joining_date', e.target.value)}
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
                  value={form.joining_date}
                  onChangeText={(v) => setField('joining_date', v)}
                />
              )}
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
  cardBody: { gap: 4, marginBottom: 12 },
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
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  classRowChecked: {
    borderColor: '#1e40af',
    backgroundColor: '#eff6ff',
  },
  className: {
    fontSize: 15,
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

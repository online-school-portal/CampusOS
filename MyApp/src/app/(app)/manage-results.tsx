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
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';
import {
  CA_TYPES,
  TERMS,
  SESSIONS,
  DOMAIN_SCORES,
  PSYCHOMOTOR_TRAITS,
  AFFECTIVE_TRAITS,
  calculateGrade,
} from '@/lib/resultsConfig';

export default function ManageResultsScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('Please wait...');
  const [refreshing, setRefreshing] = useState(false);

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);

  const [classId, setClassId] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [term, setTerm] = useState('');
  const [session, setSession] = useState('');

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editScores, setEditScores] = useState<any[]>([]);
  const [editCaType, setEditCaType] = useState('standard_20_20_60');
  const [editGender, setEditGender] = useState('');
  const [editPsychomotor, setEditPsychomotor] = useState<Record<string, number | null>>({});
  const [editAffective, setEditAffective] = useState<Record<string, number | null>>({});
  const [editAttendance, setEditAttendance] = useState({
    days_opened: '',
    days_present: '',
    days_absent: '',
  });
  const [editTermDuration, setEditTermDuration] = useState({
    term_begins: '',
    term_ends: '',
    next_term_begins: '',
  });
  const [editTeacherComment, setEditTeacherComment] = useState('');
  const [editHeadmasterComment, setEditHeadmasterComment] = useState('');
  const [originalTerm, setOriginalTerm] = useState('');
  const [originalSession, setOriginalSession] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: cls }, { data: r }] = await Promise.all([
          supabase.from('classes').select('id, name').order('name'),
          supabase.rpc('current_user_role'),
        ]);
        setClasses(cls || []);
        setRole(r || null);
      } catch (err) {
        showToast(getFriendlyError(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setResults([]);
      return;
    }
    loadStudents(classId);
    loadResults();
  }, [classId]);

  useEffect(() => {
    if (classId) loadResults();
  }, [studentFilter, term, session]);

  const loadStudents = async (cid: string) => {
    const { data } = await supabase
      .from('students')
      .select('id, student_id, full_name')
      .eq('class_id', cid)
      .order('full_name');
    setStudents(data || []);
  };

  const loadResults = useCallback(async () => {
    if (!classId) return;
    try {
      let query = supabase
        .from('results')
        .select('*, students!inner(full_name, student_id, image_url), classes(name)')
        .eq('class_id', classId);

      if (studentFilter) query = query.eq('student_id', studentFilter);
      if (term) query = query.eq('term', term);
      if (session) query = query.eq('session', session);

      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.log(err);
      showToast(getFriendlyError(err), 'error');
    }
  }, [classId, studentFilter, term, session]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults();
    setRefreshing(false);
  };

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  const openEdit = (item: any) => {
    if (item.is_locked && !isAdmin) {
      showToast('This result is locked.', 'error');
      return;
    }
    setEditItem(item);
    setOriginalTerm(item.term);
    setOriginalSession(item.session);
    setEditCaType(item.ca_type || 'standard_20_20_60');
    setEditGender(item.gender || '');
    setEditScores(
      Array.isArray(item.results)
        ? item.results
        : typeof item.results === 'string'
        ? JSON.parse(item.results)
        : []
    );
    const psycho =
      typeof item.psychomotor_domain === 'string'
        ? JSON.parse(item.psychomotor_domain)
        : item.psychomotor_domain || {};
    const aff =
      typeof item.affective_domain === 'string'
        ? JSON.parse(item.affective_domain)
        : item.affective_domain || {};
    setEditPsychomotor(psycho);
    setEditAffective(aff);
    const att =
      typeof item.attendance === 'string'
        ? JSON.parse(item.attendance)
        : item.attendance || {};
    setEditAttendance({
      days_opened: String(att.days_opened ?? ''),
      days_present: String(att.days_present ?? ''),
      days_absent: String(att.days_absent ?? ''),
    });
    const td =
      typeof item.term_duration === 'string'
        ? JSON.parse(item.term_duration)
        : item.term_duration || {};
    setEditTermDuration({
      term_begins: td.term_begins || '',
      term_ends: td.term_ends || '',
      next_term_begins: td.next_term_begins || '',
    });
    setEditTeacherComment(item.teacher_comment || '');
    setEditHeadmasterComment(item.headmaster_comment || '');
    setEditVisible(true);
  };

  const setEditPartScore = (index: number, key: string, value: string) => {
    setEditScores((prev) => {
      const next = [...prev];
      const row = { ...next[index], [key]: value === '' ? 0 : parseInt(value, 10) || 0 };
      // recalc total/grade
      const cfg = CA_TYPES[editCaType] || CA_TYPES.standard_20_20_60;
      let total = 0;
      cfg.parts.forEach((p) => {
        total += parseInt(String(row[p.key] ?? 0), 10) || 0;
      });
      row.total = total;
      row.grade = calculateGrade(total);
      next[index] = row;
      return next;
    });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setBusyMsg('Updating result...');
    setBusy(true);
    try {
      const payload = {
        results: editScores,
        psychomotor_domain: editPsychomotor,
        affective_domain: editAffective,
        teacher_comment: editTeacherComment || null,
        headmaster_comment: editHeadmasterComment || null,
        gender: editGender || null,
        term: originalTerm,
        session: originalSession,
        attendance: {
          days_opened: parseInt(editAttendance.days_opened, 10) || 0,
          days_present: parseInt(editAttendance.days_present, 10) || 0,
          days_absent: parseInt(editAttendance.days_absent, 10) || 0,
        },
        term_duration: {
          term_begins: editTermDuration.term_begins || null,
          term_ends: editTermDuration.term_ends || null,
          next_term_begins: editTermDuration.next_term_begins || null,
        },
        ca_type: editCaType,
      };

      const { error } = await supabase
        .from('results')
        .update(payload)
        .match({
          student_id: editItem.student_id,
          class_id: editItem.class_id,
          term: originalTerm,
          session: originalSession,
        });

      if (error) throw error;
      setEditVisible(false);
      await loadResults();
      showToast('Result updated successfully!', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const performDelete = async (item: any) => {
    setBusyMsg('Deleting result...');
    setBusy(true);
    try {
      const { error } = await supabase.from('results').delete().match({
        student_id: item.student_id,
        class_id: item.class_id,
        term: item.term,
        session: item.session,
      });
      if (error) throw error;
      await loadResults();
      showToast('Result deleted successfully!', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (item: any) => {
    if (item.is_locked && !isAdmin) {
      showToast('Locked results cannot be deleted.', 'error');
      return;
    }
    const msg = `Delete result for ${item.students?.full_name || 'student'} (${item.term} • ${item.session})?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) performDelete(item);
      return;
    }
    Alert.alert('Delete Result', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(item) },
    ]);
  };

  const toggleLock = async (item: any) => {
    if (!isAdmin) return;
    setBusyMsg(item.is_locked ? 'Unlocking...' : 'Locking...');
    setBusy(true);
    try {
      const { error } = await supabase
        .from('results')
        .update({ is_locked: !item.is_locked })
        .match({
          student_id: item.student_id,
          class_id: item.class_id,
          term: item.term,
          session: item.session,
        });
      if (error) throw error;
      await loadResults();
      showToast(item.is_locked ? 'Result unlocked' : 'Result locked', 'success');
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const caConfig = CA_TYPES[editCaType] || CA_TYPES.standard_20_20_60;

  const ScoreChips = ({
    value,
    onChange,
  }: {
    value: number | null | undefined;
    onChange: (v: number) => void;
  }) => (
    <View style={styles.chipRow}>
      {DOMAIN_SCORES.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.chip, value === s && styles.chipActive]}
          onPress={() => onChange(s)}
        >
          <Text style={[styles.chipText, value === s && styles.chipTextActive]}>
            {s}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const name = item.students?.full_name || 'Unknown';
    const imageUrl = item.students?.image_url;
    const isLocked = item.is_locked === true;
    const canEdit = isAdmin || (isTeacher && !isLocked);
    const canDelete = isAdmin || (isTeacher && !isLocked);
    const canLock = isAdmin;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Text style={styles.avatarLetter}>{name[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {item.term} • {item.session}
              {isLocked ? ' • Locked' : ''}
            </Text>
            <Text style={styles.meta}>
              ID: {item.students?.student_id || '—'} ·{' '}
              {item.classes?.name || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {canEdit ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
              <Ionicons name="create-outline" size={16} color="#1e40af" />
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {canDelete ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          {canLock ? (
            <TouchableOpacity style={styles.lockBtn} onPress={() => toggleLock(item)}>
              <Ionicons
                name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
                size={16}
                color="#0f172a"
              />
              <Text style={styles.lockText}>{isLocked ? 'Unlock' : 'Lock'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {busy ? <LoadingSpinner visible message={busyMsg} /> : null}

      <Text style={styles.header}>Manage Results</Text>

      <Text style={styles.fieldLabel}>Class *</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={classId} onValueChange={setClassId} style={styles.picker}>
          <Picker.Item label="Select class" value="" color="#94a3b8" />
          {classes.map((c) => (
            <Picker.Item key={c.id} label={c.name} value={c.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.fieldLabel}>Student (optional)</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={studentFilter}
          onValueChange={setStudentFilter}
          style={styles.picker}
          enabled={!!classId}
        >
          <Picker.Item label="All students" value="" />
          {students.map((s) => (
            <Picker.Item key={s.id} label={s.full_name} value={s.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.fieldLabel}>Term</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
          <Picker.Item label="All terms" value="" />
          {TERMS.map((t) => (
            <Picker.Item key={t} label={t} value={t} />
          ))}
        </Picker>
      </View>

      <Text style={styles.fieldLabel}>Session</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={session} onValueChange={setSession} style={styles.picker}>
          <Picker.Item label="All sessions" value="" />
          {SESSIONS.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>
      </View>

      <Text style={styles.count}>
        Results in view: <Text style={styles.countBold}>{results.length}</Text>
      </Text>

      <FlatList
        data={results}
        keyExtractor={(item, i) =>
          `${item.student_id}-${item.class_id}-${item.term}-${item.session}-${i}`
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {classId ? 'No results found' : 'Select a class to view results'}
          </Text>
        }
      />

      {/* EDIT MODAL */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Result</Text>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.meta}>
              {editItem?.students?.full_name} · {originalTerm} · {originalSession}
            </Text>

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={editGender}
                onValueChange={setEditGender}
                style={styles.picker}
              >
                <Picker.Item label="Select Gender" value="" color="#94a3b8" />
                <Picker.Item label="Male" value="Male" />
                <Picker.Item label="Female" value="Female" />
              </Picker>
            </View>

            <Text style={styles.sectionTitle}>Subject Scores</Text>
            {editScores.map((row, idx) => (
              <View key={row.subject_id || idx} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectName}>
                    {row.subject_name || 'Subject'}
                  </Text>
                  <Text style={styles.gradeBadge}>
                    {row.total ?? 0} · {row.grade || 'F'}
                  </Text>
                </View>
                {caConfig.parts.map((part) => (
                  <View key={part.key} style={styles.scoreRow}>
                    <Text style={styles.scoreLabel}>
                      {part.label} (max {part.max})
                    </Text>
                    <TextInput
                      style={styles.scoreInput}
                      keyboardType="number-pad"
                      value={String(row[part.key] ?? '')}
                      onChangeText={(v) => setEditPartScore(idx, part.key, v)}
                    />
                  </View>
                ))}
              </View>
            ))}

            <Text style={styles.sectionTitle}>Psychomotor</Text>
            {PSYCHOMOTOR_TRAITS.map((t) => (
              <View key={t.key} style={styles.domainRow}>
                <Text style={styles.domainLabel}>{t.label}</Text>
                <ScoreChips
                  value={editPsychomotor[t.key]}
                  onChange={(v) =>
                    setEditPsychomotor((p) => ({ ...p, [t.key]: v }))
                  }
                />
              </View>
            ))}

            <Text style={styles.sectionTitle}>Affective</Text>
            {AFFECTIVE_TRAITS.map((t) => (
              <View key={t.key} style={styles.domainRow}>
                <Text style={styles.domainLabel}>{t.label}</Text>
                <ScoreChips
                  value={editAffective[t.key]}
                  onChange={(v) =>
                    setEditAffective((p) => ({ ...p, [t.key]: v }))
                  }
                />
              </View>
            ))}

            <Text style={styles.sectionTitle}>Attendance</Text>
            <TextInput
              style={styles.input}
              placeholder="Days opened"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={editAttendance.days_opened}
              onChangeText={(v) =>
                setEditAttendance((a) => ({ ...a, days_opened: v }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Days present"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={editAttendance.days_present}
              onChangeText={(v) =>
                setEditAttendance((a) => ({ ...a, days_present: v }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Days absent"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={editAttendance.days_absent}
              onChangeText={(v) =>
                setEditAttendance((a) => ({ ...a, days_absent: v }))
              }
            />

            <Text style={styles.sectionTitle}>Comments</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
              placeholder="Teacher comment"
              placeholderTextColor="#94a3b8"
              value={editTeacherComment}
              onChangeText={setEditTeacherComment}
            />
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
              placeholder="Headmaster comment"
              placeholderTextColor="#94a3b8"
              value={editHeadmasterComment}
              onChangeText={setEditHeadmasterComment}
            />

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
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748b',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e40af',
    marginTop: 16,
    marginBottom: 10,
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
    marginBottom: 12,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  avatarPh: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  avatarLetter: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
  },
  name: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
  },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  editText: {
    color: '#1e40af',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  deleteText: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  lockText: {
    color: '#0f172a',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
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
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    flex: 1,
  },
  gradeBadge: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreLabel: { fontSize: 13, color: '#64748b', flex: 1 },
  scoreInput: {
    width: 72,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    textAlign: 'center',
  },
  domainRow: { marginBottom: 10 },
  domainLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  chipText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  chipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
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
  },
});

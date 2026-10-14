import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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

type ScoreMap = Record<string, Record<string, string>>; // subjectId -> partKey -> value

export default function AddResultScreen() {
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [term, setTerm] = useState('');
  const [session, setSession] = useState('');
  const [gender, setGender] = useState('');
  const [caType, setCaType] = useState('standard_20_20_60');

  const [scores, setScores] = useState<ScoreMap>({});
  const [psychomotor, setPsychomotor] = useState<Record<string, number | null>>({});
  const [affective, setAffective] = useState<Record<string, number | null>>({});

  const [daysOpened, setDaysOpened] = useState('');
  const [daysPresent, setDaysPresent] = useState('');
  const [daysAbsent, setDaysAbsent] = useState('');
  const [termBegins, setTermBegins] = useState('');
  const [termEnds, setTermEnds] = useState('');
  const [nextTermBegins, setNextTermBegins] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [headmasterComment, setHeadmasterComment] = useState('');

  const caConfig = CA_TYPES[caType] || CA_TYPES.standard_20_20_60;

  useEffect(() => {
    (async () => {
      setLoadingClasses(true);
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
        setLoadingClasses(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setSubjects([]);
      setStudentId('');
      return;
    }
    loadStudentsAndSubjects(classId);
  }, [classId]);

  // When CA type changes, keep scores but restructure isn't needed — keys stay
  useEffect(() => {
    setScores({});
  }, [caType, subjects]);

  const loadStudentsAndSubjects = async (cid: string) => {
    setBusyMsg('Loading class data...');
    setBusy(true);
    try {
      const [stuRes, subRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_id, full_name, sex, image_url, class_id')
          .eq('class_id', cid)
          .order('full_name'),
        supabase
          .from('subjects')
          .select('id, name, class_id')
          .eq('class_id', cid)
          .order('name'),
      ]);
      if (stuRes.error) throw stuRes.error;
      if (subRes.error) throw subRes.error;
      setStudents(stuRes.data || []);
      setSubjects(subRes.data || []);
      setStudentId('');
      setScores({});
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSelectStudent = (id: string) => {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    if (s?.sex) setGender(s.sex);
  };

  const setScore = (subjectId: string, partKey: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [subjectId]: { ...(prev[subjectId] || {}), [partKey]: value },
    }));
  };

  const subjectTotals = useMemo(() => {
    const map: Record<string, { total: number; grade: string }> = {};
    subjects.forEach((sub) => {
      let total = 0;
      caConfig.parts.forEach((p) => {
        total += parseInt(scores[sub.id]?.[p.key] || '0', 10) || 0;
      });
      map[sub.id] = { total, grade: calculateGrade(total) };
    });
    return map;
  }, [subjects, scores, caConfig]);

  const resetForm = () => {
    setStudentId('');
    setTerm('');
    setSession('');
    setGender('');
    setScores({});
    setPsychomotor({});
    setAffective({});
    setDaysOpened('');
    setDaysPresent('');
    setDaysAbsent('');
    setTermBegins('');
    setTermEnds('');
    setNextTermBegins('');
    setTeacherComment('');
    setHeadmasterComment('');
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!classId) missing.push('Class');
    if (!studentId) missing.push('Student');
    if (!term) missing.push('Term');
    if (!session) missing.push('Session');
    if (!gender) missing.push('Gender');
    if (!caType) missing.push('CA Type');
    if (missing.length) {
      showToast(`Please fill/select: ${missing.join(', ')}`, 'error');
      return;
    }
    if (!subjects.length) {
      showToast('No subjects available to save.', 'error');
      return;
    }

    const resultsArray = subjects.map((sub) => {
      const breakdown: Record<string, number> = {};
      let total = 0;
      caConfig.parts.forEach((p) => {
        const v = parseInt(scores[sub.id]?.[p.key] || '0', 10) || 0;
        breakdown[p.key] = v;
        total += v;
      });
      return {
        subject_id: sub.id,
        subject_name: sub.name,
        ...breakdown,
        total,
        grade: calculateGrade(total),
      };
    });

    const payload = {
      student_id: studentId,
      class_id: classId,
      term: term.trim(),
      session: session.trim(),
      gender,
      results: resultsArray,
      psychomotor_domain: psychomotor,
      affective_domain: affective,
      attendance: {
        days_opened: parseInt(daysOpened, 10) || 0,
        days_present: parseInt(daysPresent, 10) || 0,
        days_absent: parseInt(daysAbsent, 10) || 0,
      },
      term_duration: {
        term_begins: termBegins || null,
        term_ends: termEnds || null,
        next_term_begins: nextTermBegins || null,
      },
      teacher_comment: teacherComment.trim() || null,
      headmaster_comment: headmasterComment.trim() || null,
      ca_type: caType,
    };

    setBusyMsg('Saving result...');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('save_result_with_credit', {
        payload,
      });
      if (error) {
        if (error.message?.includes('NO_CREDITS')) {
          showToast(
            'No credits remaining. Please purchase more credits before saving another result.',
            'error'
          );
          return;
        }
        throw error;
      }
      showToast('Result saved successfully!', 'success');
      resetForm();
    } catch (err) {
      console.log(err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

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

  if (loadingClasses) {
    return <LoadingSpinner message="Loading classes..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {busy ? <LoadingSpinner visible message={busyMsg} /> : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Add Result</Text>

        <Text style={styles.fieldLabel}>Class *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={classId}
            onValueChange={setClassId}
            style={styles.picker}
          >
            <Picker.Item label="Select class" value="" color="#94a3b8" />
            {classes.map((c) => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.fieldLabel}>Student *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={studentId}
            onValueChange={onSelectStudent}
            style={styles.picker}
            enabled={!!classId && students.length > 0}
          >
            <Picker.Item
              label={
                !classId
                  ? 'Select class first'
                  : students.length === 0
                  ? 'No students in class'
                  : 'Select student'
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

        <Text style={styles.fieldLabel}>Term *</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
            <Picker.Item label="Select Term" value="" color="#94a3b8" />
            {TERMS.map((t) => (
              <Picker.Item key={t} label={t} value={t} />
            ))}
          </Picker>
        </View>

        <Text style={styles.fieldLabel}>Academic Session *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={session}
            onValueChange={setSession}
            style={styles.picker}
          >
            <Picker.Item label="Select Session" value="" color="#94a3b8" />
            {SESSIONS.map((s) => (
              <Picker.Item key={s} label={s} value={s} />
            ))}
          </Picker>
        </View>

        <Text style={styles.fieldLabel}>Gender *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={gender}
            onValueChange={setGender}
            style={styles.picker}
          >
            <Picker.Item label="Select Gender" value="" color="#94a3b8" />
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
          </Picker>
        </View>

        <Text style={styles.fieldLabel}>Continuous Assessment Type *</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={caType}
            onValueChange={setCaType}
            style={styles.picker}
          >
            {Object.entries(CA_TYPES).map(([key, cfg]) => (
              <Picker.Item key={key} label={cfg.label} value={key} />
            ))}
          </Picker>
        </View>

        <Text style={styles.sectionTitle}>Subjects & Scores</Text>
        {subjects.length === 0 ? (
          <Text style={styles.hint}>
            {classId
              ? 'No subjects for this class. Add subjects first.'
              : 'Select a class to load subjects.'}
          </Text>
        ) : (
          subjects.map((sub) => (
            <View key={sub.id} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <Text style={styles.subjectName}>{sub.name}</Text>
                <Text style={styles.gradeBadge}>
                  {subjectTotals[sub.id]?.total ?? 0} ·{' '}
                  {subjectTotals[sub.id]?.grade ?? 'F'}
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
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    value={scores[sub.id]?.[part.key] || ''}
                    onChangeText={(v) => {
                      const n = parseInt(v, 10);
                      if (v === '' || (!isNaN(n) && n >= 0 && n <= part.max)) {
                        setScore(sub.id, part.key, v);
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Psychomotor Domain</Text>
        {PSYCHOMOTOR_TRAITS.map((t) => (
          <View key={t.key} style={styles.domainRow}>
            <Text style={styles.domainLabel}>{t.label}</Text>
            <ScoreChips
              value={psychomotor[t.key]}
              onChange={(v) =>
                setPsychomotor((prev) => ({ ...prev, [t.key]: v }))
              }
            />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Affective Domain</Text>
        {AFFECTIVE_TRAITS.map((t) => (
          <View key={t.key} style={styles.domainRow}>
            <Text style={styles.domainLabel}>{t.label}</Text>
            <ScoreChips
              value={affective[t.key]}
              onChange={(v) =>
                setAffective((prev) => ({ ...prev, [t.key]: v }))
              }
            />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Attendance</Text>
        <Text style={styles.fieldLabel}>Days Opened</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Days opened"
          placeholderTextColor="#94a3b8"
          value={daysOpened}
          onChangeText={setDaysOpened}
        />
        <Text style={styles.fieldLabel}>Days Present</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Days present"
          placeholderTextColor="#94a3b8"
          value={daysPresent}
          onChangeText={setDaysPresent}
        />
        <Text style={styles.fieldLabel}>Days Absent</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Days absent"
          placeholderTextColor="#94a3b8"
          value={daysAbsent}
          onChangeText={setDaysAbsent}
        />

        <Text style={styles.sectionTitle}>Term Duration</Text>
        <Text style={styles.fieldLabel}>Term Begins</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.input, { position: 'relative' }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={termBegins}
              onChange={(e: any) => setTermBegins(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: 15,
                background: 'transparent',
              }}
            />
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={termBegins}
            onChangeText={setTermBegins}
          />
        )}
        <Text style={styles.fieldLabel}>Term Ends</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.input}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={termEnds}
              onChange={(e: any) => setTermEnds(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: 15,
                background: 'transparent',
              }}
            />
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={termEnds}
            onChangeText={setTermEnds}
          />
        )}
        <Text style={styles.fieldLabel}>Next Term Begins</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.input}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={nextTermBegins}
              onChange={(e: any) => setNextTermBegins(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: 15,
                background: 'transparent',
              }}
            />
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={nextTermBegins}
            onChangeText={setNextTermBegins}
          />
        )}

        <Text style={styles.sectionTitle}>Comments</Text>
        <Text style={styles.fieldLabel}>Teacher Comment</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Teacher comment"
          placeholderTextColor="#94a3b8"
          value={teacherComment}
          onChangeText={setTeacherComment}
        />
        <Text style={styles.fieldLabel}>Headmaster Comment</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Headmaster comment"
          placeholderTextColor="#94a3b8"
          value={headmasterComment}
          onChangeText={setHeadmasterComment}
        />

        <TouchableOpacity
          style={[styles.button, busy && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Save Result</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20, paddingBottom: 60 },
  header: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748b',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e40af',
    marginTop: 20,
    marginBottom: 12,
  },
  input: {
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: { height: 50 },
  hint: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
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
    alignItems: 'center',
    marginBottom: 10,
  },
  subjectName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
    flex: 1,
  },
  gradeBadge: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#1e40af',
    fontSize: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  scoreInput: {
    width: 72,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    textAlign: 'center',
    fontSize: 15,
    color: '#0f172a',
  },
  domainRow: { marginBottom: 12 },
  domainLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 6,
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
  chipActive: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  chipText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  chipTextActive: { color: '#fff' },
  button: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});

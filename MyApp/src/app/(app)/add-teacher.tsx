import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  showToast,
  getFriendlyError,
  uploadTeacherImage,
  createTeacherViaEdge,
} from '@/utils/toast';

export default function AddTeacherScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [teacherId, setTeacherId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qualification, setQualification] = useState('');
  const [subjectSpecialization, setSubjectSpecialization] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
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
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setTeacherId('');
    setFullName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setQualification('');
    setSubjectSpecialization('');
    setYearsOfExperience('');
    setJoiningDate('');
    setSelectedClassIds([]);
    setPhoto(null);
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Photo library permission is required', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled) setPhoto(result.assets[0].uri);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const takePhoto = async () => {
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
      if (!result.canceled) setPhoto(result.assets[0].uri);
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  const handleSubmit = async () => {
    if (!teacherId.trim() || !fullName.trim() || !email.trim() || !password.trim()) {
      showToast('Teacher ID, Full Name, Email and Password are required.', 'error');
      return;
    }
    if (!selectedClassIds.length) {
      showToast('Please assign at least one class.', 'error');
      return;
    }

    setLoading(true);
    try {
      let image_url: string | null = null;
      let image_path: string | null = null;

      if (photo) {
        try {
          const uploaded = await uploadTeacherImage(photo);
          // web returns { url, path }
          image_url = uploaded.url || uploaded.image_url || null;
          image_path = uploaded.path || uploaded.image_path || null;
        } catch (uploadErr) {
          showToast(getFriendlyError(uploadErr), 'error');
        }
      }

      const payload = {
        teacher_id: teacherId.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim(),
        password: password.trim(),
        qualification: qualification.trim() || null,
        subject_specialization: subjectSpecialization.trim() || null,
        class_ids: selectedClassIds,
        years_of_experience: yearsOfExperience
          ? parseInt(yearsOfExperience, 10)
          : null,
        joining_date: joiningDate || null,
        image_url,
        image_path,
      };

      const data = await createTeacherViaEdge(payload);
      resetForm();
      showToast(
        `Teacher added successfully! Email: ${data?.email || email}`,
        'success'
      );
    } catch (err) {
      console.log(err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingClasses) {
    return <LoadingSpinner message="Loading classes..." fullScreen={false} />;
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <LoadingSpinner visible={true} message="Adding teacher..." />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Add Teacher</Text>

        <View style={styles.photoWrapper}>
          <TouchableOpacity style={styles.photoBox} onPress={pickFromGallery}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={28} color="#94a3b8" />
                <Text style={styles.photoText}>PHOTO</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Teacher ID *</Text>
        <TextInput
          style={styles.input}
          placeholder="Teacher ID"
          placeholderTextColor="#94a3b8"
          value={teacherId}
          onChangeText={setTeacherId}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#94a3b8"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#94a3b8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>Qualification</Text>
        <TextInput
          style={styles.input}
          placeholder="Qualification"
          placeholderTextColor="#94a3b8"
          value={qualification}
          onChangeText={setQualification}
        />

        <Text style={styles.fieldLabel}>Subject Specialization</Text>
        <TextInput
          style={styles.input}
          placeholder="Subject Specialization"
          placeholderTextColor="#94a3b8"
          value={subjectSpecialization}
          onChangeText={setSubjectSpecialization}
        />

        <Text style={styles.sectionTitle}>Assigned Classes *</Text>
        {classes.length === 0 ? (
          <Text style={styles.warning}>No classes found. Add classes first.</Text>
        ) : (
          classes.map((cls) => {
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
          })
        )}

        <Text style={styles.fieldLabel}>Years of Experience</Text>
        <TextInput
          style={styles.input}
          placeholder="Years"
          placeholderTextColor="#94a3b8"
          value={yearsOfExperience}
          onChangeText={setYearsOfExperience}
          keyboardType="number-pad"
        />

        <Text style={styles.fieldLabel}>Joining Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.input, styles.dateBox]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={joiningDate}
              onChange={(e: any) => setJoiningDate(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: 15,
                width: '100%',
                backgroundColor: 'transparent',
                color: joiningDate ? '#0f172a' : '#94a3b8',
              }}
            />
            {!joiningDate ? (
              <Text style={styles.datePlaceholderOverlay} pointerEvents="none">
                Joining Date
              </Text>
            ) : null}
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Joining Date (YYYY-MM-DD)"
            placeholderTextColor="#94a3b8"
            value={joiningDate}
            onChangeText={setJoiningDate}
          />
        )}

        <TouchableOpacity
          style={[styles.button, loading ? { opacity: 0.7 } : null]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Add Teacher</Text>
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
    marginBottom: 24,
  },
  photoWrapper: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', gap: 4 },
  photoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  cameraBtn: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e40af',
    marginTop: 16,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
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

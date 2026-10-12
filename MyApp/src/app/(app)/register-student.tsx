import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

export default function RegisterStudentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState('');
  const [stateOfOrigin, setStateOfOrigin] = useState('');
  const [nationality, setNationality] = useState('');
  const [lga, setLga] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [password, setPassword] = useState('');
  const [admissionClassId, setAdmissionClassId] = useState('');
  const [currentClassId, setCurrentClassId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentAddress, setParentAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [siblingName, setSiblingName] = useState('');
  const [siblingClassId, setSiblingClassId] = useState('');
  const [siblingSex, setSiblingSex] = useState('');

  useEffect(() => {
    loadClasses();
    const channel = supabase
      .channel('register-classes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () =>
        loadClasses()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingClasses(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setStudentId('');
    setDateOfBirth('');
    setSex('');
    setStateOfOrigin('');
    setNationality('');
    setLga('');
    setStudentAddress('');
    setPassword('');
    setAdmissionClassId('');
    setCurrentClassId('');
    setParentName('');
    setParentPhone('');
    setParentEmail('');
    setParentAddress('');
    setGuardianName('');
    setGuardianPhone('');
    setGuardianEmail('');
    setGuardianAddress('');
    setSiblingName('');
    setSiblingClassId('');
    setSiblingSex('');
    setPhoto(null);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const onNativeDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(selectedDate.toISOString().split('T')[0]);
    }
  };

  const getClassName = (id: string) =>
    classes.find((c) => c.id === id)?.name || null;

  const handleRegister = async () => {
    if (!fullName.trim() || !studentId.trim()) {
      Alert.alert('Error', 'Full Name and Student ID are required');
      return;
    }

    setLoading(true);
    try {
      const { data: schoolId, error: schoolError } =
        await supabase.rpc('current_user_school_id');
      if (schoolError) throw schoolError;

      let imageUrl: string | null = null;
      let imagePath: string | null = null;

      if (photo) {
        const ext = photo.split('.').pop() || 'jpg';
        const fileName = `${studentId}_${Date.now()}.${ext}`;
        const response = await fetch(photo);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(fileName, blob);
        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('student-photos')
            .getPublicUrl(fileName);
          imageUrl = publicUrl.publicUrl;
          imagePath = fileName;
        }
      }

      const { error } = await supabase.from('students').insert({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        date_of_birth: dateOfBirth || null,
        sex: sex || null,
        state_of_origin: stateOfOrigin || null,
        nationality: nationality || null,
        lga: lga || null,
        student_address: studentAddress || null,
        class_id: currentClassId || null,
        admission_class_id: admissionClassId || null,
        sibling_class_id: siblingClassId || null,
        student_class: currentClassId ? getClassName(currentClassId) : null,
        admission_class: admissionClassId ? getClassName(admissionClassId) : null,
        sibling_class: siblingClassId ? getClassName(siblingClassId) : null,
        sibling_name: siblingName || null,
        sibling_sex: siblingSex || null,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        parent_email: parentEmail || null,
        parent_address: parentAddress || null,
        guardian_name: guardianName || null,
        guardian_phone: guardianPhone || null,
        guardian_email: guardianEmail || null,
        guardian_address: guardianAddress || null,
        image_url: imageUrl,
        image_path: imagePath,
        school_id: schoolId,
      });

      if (error) throw error;

      resetForm();
      Alert.alert('Success', 'Student registered successfully');
    } catch (err: any) {
      console.log(err);
      Alert.alert('Error', err.message || 'Failed to register student');
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
        <LoadingSpinner visible={true} message="Registering student..." />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Register Student</Text>

        <View style={styles.photoWrapper}>
          <TouchableOpacity style={styles.photoBox} onPress={pickFromGallery}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
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

        <Text style={styles.sectionTitle}>Student Details</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name *"
          placeholderTextColor="#94a3b8"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Student ID *"
          placeholderTextColor="#94a3b8"
          value={studentId}
          onChangeText={setStudentId}
          autoCapitalize="characters"
        />

        {/* DOB looks like Select Sex — same picker-style box with placeholder inside */}
        {Platform.OS === 'web' ? (
          <View style={styles.pickerWrapper}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e: any) => setDateOfBirth(e.target.value)}
              style={{
                width: '100%',
                height: 50,
                border: 'none',
                outline: 'none',
                paddingLeft: 14,
                paddingRight: 14,
                fontSize: 15,
                backgroundColor: 'transparent',
                color: dateOfBirth ? '#0f172a' : '#94a3b8',
                fontFamily: 'inherit',
              }}
            />
            {!dateOfBirth ? (
              <Text style={styles.datePlaceholderOverlay} pointerEvents="none">
                Date of Birth
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.pickerStyleBox}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={dateOfBirth ? styles.dateText : styles.placeholderText}>
                {dateOfBirth || 'Date of Birth'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </TouchableOpacity>
            {showDatePicker && DateTimePicker ? (
              <DateTimePicker
                value={dateOfBirth ? new Date(dateOfBirth) : new Date(2010, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onNativeDateChange}
                maximumDate={new Date()}
              />
            ) : null}
          </>
        )}

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={sex} onValueChange={setSex} style={styles.picker}>
            <Picker.Item label="Select Sex" value="" color="#94a3b8" />
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
          </Picker>
        </View>

        <TextInput style={styles.input} placeholder="State of Origin" placeholderTextColor="#94a3b8" value={stateOfOrigin} onChangeText={setStateOfOrigin} />
        <TextInput style={styles.input} placeholder="Nationality" placeholderTextColor="#94a3b8" value={nationality} onChangeText={setNationality} />
        <TextInput style={styles.input} placeholder="LGA" placeholderTextColor="#94a3b8" value={lga} onChangeText={setLga} />
        <TextInput style={styles.input} placeholder="Student Address" placeholderTextColor="#94a3b8" value={studentAddress} onChangeText={setStudentAddress} />
        <TextInput style={styles.input} placeholder="Passkey (optional)" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.sectionTitle}>Classes</Text>

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={admissionClassId} onValueChange={setAdmissionClassId} style={styles.picker}>
            <Picker.Item label="Class Admitted Into" value="" color="#94a3b8" />
            {classes.map((cls) => (
              <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={currentClassId} onValueChange={setCurrentClassId} style={styles.picker}>
            <Picker.Item label="Current Class" value="" color="#94a3b8" />
            {classes.map((cls) => (
              <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
            ))}
          </Picker>
        </View>

        {classes.length === 0 ? (
          <Text style={styles.warning}>No classes found. Please add classes first.</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Parent Details</Text>
        <TextInput style={styles.input} placeholder="Parent's Name" placeholderTextColor="#94a3b8" value={parentName} onChangeText={setParentName} />
        <TextInput style={styles.input} placeholder="Parent Phone" placeholderTextColor="#94a3b8" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Parent Email" placeholderTextColor="#94a3b8" value={parentEmail} onChangeText={setParentEmail} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Parent Address" placeholderTextColor="#94a3b8" value={parentAddress} onChangeText={setParentAddress} />

        <Text style={styles.sectionTitle}>Guardian Details</Text>
        <TextInput style={styles.input} placeholder="Guardian Name" placeholderTextColor="#94a3b8" value={guardianName} onChangeText={setGuardianName} />
        <TextInput style={styles.input} placeholder="Guardian Phone" placeholderTextColor="#94a3b8" value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Guardian Email" placeholderTextColor="#94a3b8" value={guardianEmail} onChangeText={setGuardianEmail} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Guardian Address" placeholderTextColor="#94a3b8" value={guardianAddress} onChangeText={setGuardianAddress} />

        <Text style={styles.sectionTitle}>Sibling (Optional)</Text>
        <TextInput style={styles.input} placeholder="Sibling Name" placeholderTextColor="#94a3b8" value={siblingName} onChangeText={setSiblingName} />

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={siblingClassId} onValueChange={setSiblingClassId} style={styles.picker}>
            <Picker.Item label="Sibling Class" value="" color="#94a3b8" />
            {classes.map((cls) => (
              <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={siblingSex} onValueChange={setSiblingSex} style={styles.picker}>
            <Picker.Item label="Sibling Sex" value="" color="#94a3b8" />
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading ? { opacity: 0.7 } : null]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Register Student</Text>
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
    marginTop: 20,
    marginBottom: 12,
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
  pickerStyleBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#0f172a',
  },
  placeholderText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94a3b8',
  },
  datePlaceholderOverlay: {
    position: 'absolute',
    left: 14,
    top: 15,
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  pickerWrapper: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
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

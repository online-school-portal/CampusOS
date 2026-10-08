import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';

export default function RegisterStudentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);

  // Form fields
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
  const [siblingGender, setSiblingGender] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.log('Failed to load classes:', err);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !studentId.trim()) {
      Alert.alert('Error', 'Full Name and Student ID are required');
      return;
    }

    setLoading(true);

    try {
      const { data: schoolId, error: schoolError } = await supabase.rpc('current_user_school_id');
      if (schoolError) throw schoolError;

      let imageUrl: string | null = null;

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
        admission_class: admissionClassId || null,
        current_class: currentClassId || null,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        parent_email: parentEmail || null,
        parent_address: parentAddress || null,
        guardian_name: guardianName || null,
        guardian_phone: guardianPhone || null,
        guardian_email: guardianEmail || null,
        guardian_address: guardianAddress || null,
        sibling_name: siblingName || null,
        sibling_class: siblingClassId || null,
        sibling_gender: siblingGender || null,
        image_url: imageUrl,
        school_id: schoolId,
      });

      if (error) throw error;

      Alert.alert('Success', 'Student registered successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.log(err);
      Alert.alert('Error', err.message || 'Failed to register student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Register Student</Text>

      <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <Text style={styles.photoText}>Tap to upload photo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Student Details</Text>

      <TextInput style={styles.input} placeholder="Full Name *" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Student ID *" value={studentId} onChangeText={setStudentId} autoCapitalize="characters" />
      <TextInput style={styles.input} placeholder="Date of Birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} />

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={sex} onValueChange={setSex} style={styles.picker}>
          <Picker.Item label="Select Sex" value="" />
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
        </Picker>
      </View>

      <TextInput style={styles.input} placeholder="State of Origin" value={stateOfOrigin} onChangeText={setStateOfOrigin} />
      <TextInput style={styles.input} placeholder="Nationality" value={nationality} onChangeText={setNationality} />
      <TextInput style={styles.input} placeholder="LGA" value={lga} onChangeText={setLga} />
      <TextInput style={styles.input} placeholder="Student Address" value={studentAddress} onChangeText={setStudentAddress} />
      <TextInput style={styles.input} placeholder="Passkey (optional)" value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.sectionTitle}>Classes</Text>

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={admissionClassId} onValueChange={setAdmissionClassId} style={styles.picker}>
          <Picker.Item label="Class Admitted Into" value="" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={currentClassId} onValueChange={setCurrentClassId} style={styles.picker}>
          <Picker.Item label="Current Class" value="" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      {classes.length === 0 && (
        <Text style={styles.warning}>
          No classes found. Please add classes first in the Classes section.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Parent Details</Text>
      <TextInput style={styles.input} placeholder="Parent's Name" value={parentName} onChangeText={setParentName} />
      <TextInput style={styles.input} placeholder="Parent Phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Parent Email" value={parentEmail} onChangeText={setParentEmail} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Parent Address" value={parentAddress} onChangeText={setParentAddress} />

      <Text style={styles.sectionTitle}>Guardian Details</Text>
      <TextInput style={styles.input} placeholder="Guardian Name" value={guardianName} onChangeText={setGuardianName} />
      <TextInput style={styles.input} placeholder="Guardian Phone" value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Guardian Email" value={guardianEmail} onChangeText={setGuardianEmail} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Guardian Address" value={guardianAddress} onChangeText={setGuardianAddress} />

      <Text style={styles.sectionTitle}>Sibling (Optional)</Text>
      <TextInput style={styles.input} placeholder="Sibling Name" value={siblingName} onChangeText={setSiblingName} />

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={siblingClassId} onValueChange={setSiblingClassId} style={styles.picker}>
          <Picker.Item label="Sibling Class" value="" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={siblingGender} onValueChange={setSiblingGender} style={styles.picker}>
          <Picker.Item label="Sibling Sex" value="" />
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
        </Picker>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Student</Text>}
      </TouchableOpacity>
    </ScrollView>
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
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 10 },
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
  },
  pickerWrapper: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
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

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function ManageStudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [search, setSearch] = useState('');

  const loadClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .order('name');
    setClasses(data || []);
  };

  const loadStudents = useCallback(async () => {
    try {
      const { data: schoolId } = await supabase.rpc('current_user_school_id');

      let query = supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (selectedClass && selectedClass !== 'all') {
        query = query.eq('current_class', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.log('Load students error:', err);
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
  }, []);

  useEffect(() => {
    loadStudents();
  }, [selectedClass, loadStudents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '—';
    const found = classes.find((c) => c.id === classId);
    return found ? found.name : '—';
  };

  const handleDelete = (student: any) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('students')
              .delete()
              .eq('id', student.id);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              setStudents((prev) => prev.filter((s) => s.id !== student.id));
              Alert.alert('Success', 'Student deleted');
            }
          },
        },
      ]
    );
  };

  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q)
    );
  });

  const renderStudent = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
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
          Class: <Text style={styles.value}>{getClassName(item.current_class)}</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => Alert.alert('Coming soon', 'Edit student will be available soon')}
        >
          <Ionicons name="create-outline" size={16} color="#1e40af" />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={16} color="#dc2626" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Students</Text>

      <TextInput
        style={styles.search}
        placeholder="Search by name or ID..."
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedClass}
          onValueChange={(value) => setSelectedClass(value)}
          style={styles.picker}
        >
          <Picker.Item label="All Classes" value="all" />
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.count}>
        Students in view: <Text style={styles.countBold}>{filteredStudents.length}</Text>
      </Text>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No students found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
  },
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
    marginBottom: 16,
  },
  search: {
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
    backgroundColor: '#ffffff',
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
  name: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0f172a',
  },
  meta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
  },
  value: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
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
});

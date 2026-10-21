import { useEffect, useState } from 'react';
import { Drawer, DrawerContentScrollView } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

function CustomDrawerContent(props: any) {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('CampusOS');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      const [{ data: admin }, { data: teacher }, { data: student }] =
        await Promise.all([
          supabase.from('admins').select('id').eq('auth_id', userId).maybeSingle(),
          supabase.from('teachers').select('id').eq('auth_id', userId).maybeSingle(),
          supabase.from('students').select('id').eq('auth_id', userId).maybeSingle(),
        ]);

      if (admin) setRole('admin');
      else if (teacher) setRole('teacher');
      else if (student) setRole('student');

      try {
        const { data: logo } = await supabase.rpc('get_my_school_logo');
        if (logo) setSchoolLogo(logo);
      } catch {}

      try {
        const { data: schoolId } = await supabase.rpc('current_user_school_id');
        if (schoolId) {
          const { data: school } = await supabase
            .from('schools')
            .select('name')
            .eq('id', schoolId)
            .maybeSingle();
          if (school?.name) setSchoolName(school.name);
        }
      } catch {}
    };
    load();
  }, []);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.log('Logout error:', err);
      setLoggingOut(false);
    }
  };

  const MenuItem = ({
    label,
    icon,
    onPress,
    isSub = false,
  }: {
    label: string;
    icon: any;
    onPress: () => void;
    isSub?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.menuItem, isSub && styles.subMenuItem]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={isSub ? 18 : 20} color="#334155" />
      <Text style={[styles.menuText, isSub && styles.subMenuText]}>{label}</Text>
    </TouchableOpacity>
  );

  const SectionHeader = ({
    title,
    icon,
    sectionKey,
  }: {
    title: string;
    icon: any;
    sectionKey: string;
  }) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(sectionKey)}
    >
      <View style={styles.sectionLeft}>
        <Ionicons name={icon} size={20} color="#1e40af" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Ionicons
        name={openSection === sectionKey ? 'chevron-up' : 'chevron-down'}
        size={18}
        color="#64748b"
      />
    </TouchableOpacity>
  );

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawer}>
      <View style={styles.logoBox}>
        {schoolLogo ? (
          <Image source={{ uri: schoolLogo }} style={styles.logoImage} />
        ) : null}
        <Text style={styles.logoText} numberOfLines={2}>
          {schoolName}
        </Text>
        <Text style={styles.logoSub}>School Management</Text>
      </View>

      <MenuItem
        label="Overview"
        icon="grid-outline"
        onPress={() => props.navigation.navigate('overview')}
      />

      {(role === 'admin' || role === 'teacher') && (
        <>
          <SectionHeader
            title="Students"
            icon="people-outline"
            sectionKey="students"
          />
          {openSection === 'students' && (
            <View style={styles.subMenu}>
              {role === 'admin' && (
                <MenuItem
                  label="Register Student"
                  icon="person-add-outline"
                  onPress={() => props.navigation.navigate('register-student')}
                  isSub
                />
              )}
              <MenuItem
                label="Manage Students"
                icon="list-outline"
                onPress={() => props.navigation.navigate('manage-students')}
                isSub
              />
              {role === 'admin' && (
                <MenuItem
                  label="Transfer Students"
                  icon="swap-horizontal-outline"
                  onPress={() =>
                    props.navigation.navigate('transfer-students')
                  }
                  isSub
                />
              )}
            </View>
          )}
        </>
      )}

      {role === 'admin' && (
        <>
          <MenuItem
            label="Classes"
            icon="library-outline"
            onPress={() => props.navigation.navigate('classes')}
          />
          <MenuItem
            label="Subjects"
            icon="book-outline"
            onPress={() => props.navigation.navigate('subjects')}
          />
        </>
      )}

      {role === 'admin' && (
        <>
          <SectionHeader
            title="Teachers"
            icon="school-outline"
            sectionKey="teachers"
          />
          {openSection === 'teachers' && (
            <View style={styles.subMenu}>
              <MenuItem
                label="Add Teachers"
                icon="person-add-outline"
                onPress={() => props.navigation.navigate('add-teacher')}
                isSub
              />
              <MenuItem
                label="Manage Teachers"
                icon="list-outline"
                onPress={() => props.navigation.navigate('manage-teachers')}
                isSub
              />
            </View>
          )}
        </>
      )}

      <SectionHeader
        title="Results"
        icon="document-text-outline"
        sectionKey="results"
      />
      {openSection === 'results' && (
        <View style={styles.subMenu}>
          {(role === 'admin' || role === 'teacher') && (
            <MenuItem
              label="Add Results"
              icon="create-outline"
              onPress={() => props.navigation.navigate('add-result')}
              isSub
            />
          )}
          <MenuItem
            label="Manage Results"
            icon="folder-open-outline"
            onPress={() => props.navigation.navigate('manage-results')}
            isSub
          />
        </View>
      )}

      {role === 'admin' && (
        <>
          <SectionHeader title="Fees" icon="cash-outline" sectionKey="fees" />
          {openSection === 'fees' && (
            <View style={styles.subMenu}>
              <MenuItem
                label="Fee Types"
                icon="pricetag-outline"
                onPress={() => props.navigation.navigate('fee-types')}
                isSub
              />
              <MenuItem
                label="Add Fees"
                icon="add-circle-outline"
                onPress={() => props.navigation.navigate('add-fees')}
                isSub
              />
              <MenuItem
                label="Fee Ledger"
                icon="book-outline"
                onPress={() => props.navigation.navigate('fee-ledger')}
                isSub
              />
              <MenuItem
                label="Financial Report"
                icon="stats-chart-outline"
                onPress={() => props.navigation.navigate('financial-reports')}
                isSub
              />
            </View>
          )}
          <MenuItem
            label="Credit Tracking"
            icon="card-outline"
            onPress={() => props.navigation.navigate('credit-tracking')}
          />
        </>
      )}

      <View style={styles.logoutContainer}>
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && { opacity: 0.7 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          )}
          <Text style={styles.logoutText}>
            {loggingOut ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

export default function AppLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }
      setChecking(false);
    };
    checkSession();
  }, []);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#1e40af',
        headerTitleStyle: {
          fontFamily: 'SpaceGrotesk_700Bold',
          color: '#0f172a',
          fontSize: 18,
        },
        drawerStyle: {
          backgroundColor: '#ffffff',
          width: 290,
        },
      }}
    >
      <Drawer.Screen name="overview" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="register-student" options={{ title: 'Register Student' }} />
      <Drawer.Screen name="manage-students" options={{ title: 'Manage Students' }} />
      <Drawer.Screen name="transfer-students" options={{ title: 'Transfer Students' }} />
      <Drawer.Screen name="classes" options={{ title: 'Classes' }} />
      <Drawer.Screen name="subjects" options={{ title: 'Subjects' }} />
      <Drawer.Screen name="add-teacher" options={{ title: 'Add Teacher' }} />
      <Drawer.Screen name="manage-teachers" options={{ title: 'Manage Teachers' }} />
      <Drawer.Screen name="add-result" options={{ title: 'Add Result' }} />
      <Drawer.Screen name="manage-results" options={{ title: 'Manage Results' }} />
      <Drawer.Screen name="results" options={{ title: 'Results' }} />
      <Drawer.Screen name="fee-types" options={{ title: 'Fee Types' }} />
      <Drawer.Screen name="add-fees" options={{ title: 'Add Fees' }} />
      <Drawer.Screen name="fee-ledger" options={{ title: 'Fee Ledger' }} />
      <Drawer.Screen name="financial-reports" options={{ title: 'Financial Reports' }} />
      <Drawer.Screen name="credit-tracking" options={{ title: 'Credit Tracking' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: { flex: 1, paddingTop: 10 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  logoBox: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'flex-start',
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#e2e8f0',
  },
  logoText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#0f172a',
  },
  logoSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 14,
  },
  subMenuItem: {
    paddingLeft: 48,
    paddingVertical: 11,
  },
  menuText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#334155',
  },
  subMenuText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1e40af',
  },
  subMenu: {
    backgroundColor: '#f8fafc',
    marginBottom: 4,
  },
  logoutContainer: {
    marginTop: 'auto',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  logoutBtn: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  logoutText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
});

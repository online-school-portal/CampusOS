import { Alert, Platform } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

/**
 * Cross-platform toast — Space Grotesk font (matches CampusOS web).
 */
export function showToast(message: string, type: ToastType = 'info') {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const existing = document.getElementById('campusos-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'campusos-toast';
    el.textContent = message;

    const bg =
      type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#1e40af';

    Object.assign(el.style, {
      position: 'fixed',
      top: '1.25rem',
      right: '1.25rem',
      zIndex: '99999',
      padding: '0.75rem 1.25rem',
      borderRadius: '0.5rem',
      color: '#fff',
      fontWeight: '700',
      fontFamily: "'Space Grotesk', 'SpaceGrotesk_700Bold', system-ui, sans-serif",
      fontSize: '0.9rem',
      background: bg,
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
      maxWidth: '90vw',
      transition: 'opacity 0.3s',
      letterSpacing: '-0.01em',
    });

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);

    return;
  }

  const title =
    type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info';
  Alert.alert(title, message);
}

export function getFriendlyError(err: any): string {
  if (!err) return 'Something went wrong. Please try again.';

  const msg =
    typeof err === 'string'
      ? err
      : err.message || err.error || err.error_description || err.msg || '';

  const lower = String(msg).toLowerCase();

  if (lower.includes('bucket') || lower.includes('storage') || lower.includes('upload')) {
    if (lower.includes('not found') || lower.includes('does not exist')) {
      return 'Photo storage not found. Check edge function / bucket config.';
    }
    if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
      return 'Photo action blocked by policy. Check storage/edge function auth.';
    }
    if (lower.includes('payload') || lower.includes('too large') || lower.includes('413')) {
      return 'Photo is too large. Try a smaller image.';
    }
    return `Photo error: ${msg}`;
  }

  if (
    lower.includes('row-level security') ||
    lower.includes('violates row-level') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return 'Permission denied by database policy (RLS).';
  }

  if (
    lower.includes('duplicate') ||
    lower.includes('unique') ||
    lower.includes('already exists') ||
    lower.includes('23505')
  ) {
    return 'This record already exists (duplicate ID).';
  }

  if (lower.includes('foreign key') || lower.includes('23503')) {
    return 'Related record missing (e.g. class or school).';
  }

  if (lower.includes('not found') || lower.includes('0 rows') || lower.includes('pgrst116')) {
    return 'Record not found. It may have been deleted.';
  }

  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout')
  ) {
    return 'Network error. Check your connection.';
  }

  if (lower.includes('jwt') || lower.includes('token') || lower.includes('session') || lower.includes('authenticated')) {
    return 'Session expired. Please log in again.';
  }

  return msg || 'Something went wrong. Please try again.';
}

/** Get current session access token for edge functions */
export async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await (await import('@/lib/supabase')).supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Not authenticated. Please log in again.');
  }
  return session.access_token;
}

const FUNCTIONS_BASE =
  'https://irelkjvppoisvjpopdpb.supabase.co/functions/v1';

/** Upload new student image via edge function (matches web) */
export async function uploadStudentImage(uri: string): Promise<{
  image_url: string;
  image_path: string;
}> {
  const token = await getAccessToken();
  const response = await fetch(uri);
  const blob = await response.blob();

  const formData = new FormData();
  // Web + RN: append as File-like blob with name
  formData.append('image', blob as any, 'photo.jpg');

  const res = await fetch(`${FUNCTIONS_BASE}/upload-student-images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await res.json();
  if (!res.ok) throw result;
  return {
    image_url: result.image_url,
    image_path: result.image_path,
  };
}

/** Replace student image via edge function (matches web edit) */
export async function updateStudentImage(
  studentRowId: string,
  uri: string,
  existingPath: string = ''
): Promise<{ image_url: string; image_path: string }> {
  const token = await getAccessToken();
  const response = await fetch(uri);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('student_id', studentRowId);
  formData.append('file', blob as any, 'photo.jpg');
  formData.append('existing_path', existingPath || '');

  const res = await fetch(`${FUNCTIONS_BASE}/update-student-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await res.json();
  if (!res.ok) throw result;
  return {
    image_url: result.image_url,
    image_path: result.image_path,
  };
}

/** Delete student via edge function (matches web — cleans auth + image) */
export async function deleteStudentViaEdge(studentId: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(`${FUNCTIONS_BASE}/delete-student`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ student_id: studentId }),
  });

  const data = await res.json();
  if (!res.ok) throw data.error ?? data;
}

/** Create student via edge function (matches web create-student-auth) */
export async function createStudentViaEdge(payload: Record<string, any>): Promise<any> {
  const token = await getAccessToken();

  const res = await fetch(`${FUNCTIONS_BASE}/create-student-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (!res.ok) throw result;
  return result;
}

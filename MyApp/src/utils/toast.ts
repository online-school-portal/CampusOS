import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type ToastType = 'success' | 'error' | 'info';

const SUPABASE_URL = 'https://irelkjvppoisvjpopdpb.supabase.co';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

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
      : err.message ||
        err.error ||
        err.error_description ||
        err.msg ||
        (typeof err === 'object' ? JSON.stringify(err) : String(err));

  const lower = String(msg).toLowerCase();
  const name = (err?.name || '').toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('cors') ||
    lower.includes('access-control') ||
    (name === 'typeerror' && lower.includes('fetch'))
  ) {
    return 'Request blocked (CORS or network). Headers must match the web app (Authorization only).';
  }

  if (lower.includes('teachers_email_key') || lower.includes('email') && lower.includes('already')) {
    return 'A teacher with this email address already exists.';
  }
  if (lower.includes('teachers_teacher_id_key') || (lower.includes('teacher') && lower.includes('already exists'))) {
    return 'A teacher with this Teacher ID already exists.';
  }

  if (lower.includes('bucket') || lower.includes('storage') || lower.includes('upload')) {
    return `Photo error: ${msg}`;
  }
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return 'Permission denied by database policy (RLS).';
  }
  if (lower.includes('duplicate') || lower.includes('unique') || lower.includes('23505')) {
    return 'This record already exists (duplicate ID or email).';
  }
  if (lower.includes('not found') || lower.includes('pgrst116')) {
    return 'Record not found. It may have been deleted.';
  }
  if (
    lower.includes('jwt') ||
    lower.includes('token') ||
    lower.includes('session') ||
    lower.includes('authenticated')
  ) {
    return 'Session expired. Please log in again.';
  }

  if (msg && msg !== '{}' && msg !== '[object Object]') return msg;
  return 'Something went wrong. Please try again.';
}

async function getSessionToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw { message: 'Admin not authenticated' };
  }
  return session.access_token;
}

async function edgeHeaders(json = true): Promise<Record<string, string>> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function parseEdgeResponse(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || `HTTP ${res.status}` };
  }
  console.log('[edge]', res.status, data);
  if (!res.ok) {
    throw data?.error ?? data ?? { message: `Request failed (${res.status})` };
  }
  return data;
}

// ─── Student helpers (kept for existing screens) ───

export async function uploadStudentImage(uri: string) {
  const token = await getSessionToken();
  const blob = await (await fetch(uri)).blob();
  const formData = new FormData();
  formData.append('image', blob as any, 'photo.jpg');
  const res = await fetch(`${FUNCTIONS_BASE}/upload-student-images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseEdgeResponse(res);
}

export async function updateStudentImage(
  studentRowId: string,
  uri: string,
  existingPath: string = ''
) {
  const token = await getSessionToken();
  const blob = await (await fetch(uri)).blob();
  const formData = new FormData();
  formData.append('student_id', studentRowId);
  formData.append('file', blob as any, 'photo.jpg');
  formData.append('existing_path', existingPath || '');
  const res = await fetch(`${FUNCTIONS_BASE}/update-student-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseEdgeResponse(res);
}

export async function deleteStudentViaEdge(studentBusinessId: string) {
  if (!studentBusinessId) throw { message: 'Missing student_id' };
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/delete-student`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ student_id: studentBusinessId }),
  });
  const data = await parseEdgeResponse(res);
  if (data && data.success === false) throw data.error ?? data.message ?? data;
  return data;
}

export async function createStudentViaEdge(payload: Record<string, any>) {
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/create-student-auth`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseEdgeResponse(res);
}

// ─── Teacher helpers (match web) ───

/** Web: upload-teacher-images → returns { url, path } */
export async function uploadTeacherImage(uri: string) {
  const token = await getSessionToken();
  const blob = await (await fetch(uri)).blob();
  const formData = new FormData();
  formData.append('file', blob as any, 'photo.jpg');
  const res = await fetch(`${FUNCTIONS_BASE}/upload-teacher-images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseEdgeResponse(res);
}

/** Web: update-teacher-image */
export async function updateTeacherImage(
  teacherUuid: string,
  uri: string,
  existingPath: string = ''
) {
  const token = await getSessionToken();
  const blob = await (await fetch(uri)).blob();
  const formData = new FormData();
  formData.append('teacher_id', teacherUuid);
  formData.append('file', blob as any, 'photo.jpg');
  formData.append('existing_path', existingPath || '');
  const res = await fetch(`${FUNCTIONS_BASE}/update-teacher-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseEdgeResponse(res);
}

/** Web: create-teacher */
export async function createTeacherViaEdge(payload: Record<string, any>) {
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/create-teacher`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseEdgeResponse(res);
}

/** Web: delete-teacher — body { teacher_id: uuid } */
export async function deleteTeacherViaEdge(teacherUuid: string) {
  if (!teacherUuid) throw { message: 'Missing teacher id' };
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/delete-teacher`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ teacher_id: teacherUuid }),
  });
  return parseEdgeResponse(res);
}

/** Web: update-teacher-auth */
export async function updateTeacherAuth(payload: {
  teacher_id: string;
  auth_id?: string | null;
  email?: string | null;
  password?: string | null;
}) {
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/update-teacher-auth`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseEdgeResponse(res);
}

/** Web: update-teacher-classes */
export async function updateTeacherClasses(payload: {
  teacher_id: string;
  teacher: Record<string, any>;
  class_ids: string[];
}) {
  const headers = await edgeHeaders(true);
  const res = await fetch(`${FUNCTIONS_BASE}/update-teacher-classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseEdgeResponse(res);
}

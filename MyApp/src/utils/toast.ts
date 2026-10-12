import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type ToastType = 'success' | 'error' | 'info';

const SUPABASE_URL = 'https://irelkjvppoisvjpopdpb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZWxranZwcG9pc3ZqcG9wZHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTUwMDAsImV4cCI6MjA4MTkzMTAwMH0.osF4wEZ-zm3cXScD1W8gMOkG81O2TbDJ8L47YvIIryw';
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
      : err.message || err.error || err.error_description || err.msg || JSON.stringify(err);

  const lower = String(msg).toLowerCase();

  if (lower.includes('bucket') || lower.includes('storage') || lower.includes('upload')) {
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
  if (lower.includes('duplicate') || lower.includes('unique') || lower.includes('23505')) {
    return 'This record already exists (duplicate ID).';
  }
  if (lower.includes('not found') || lower.includes('pgrst116')) {
    return 'Record not found. It may have been deleted.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'Network error. Check your connection.';
  }
  if (
    lower.includes('jwt') ||
    lower.includes('token') ||
    lower.includes('session') ||
    lower.includes('authenticated')
  ) {
    return 'Session expired. Please log in again.';
  }

  return msg || 'Something went wrong. Please try again.';
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

/** Shared headers for edge functions (matches web + apikey) */
async function edgeHeaders(json = true): Promise<Record<string, string>> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
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

/** Upload new student image — web: upload-student-images */
export async function uploadStudentImage(uri: string) {
  const token = await getSessionToken();
  const response = await fetch(uri);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('image', blob as any, 'photo.jpg');

  const res = await fetch(`${FUNCTIONS_BASE}/upload-student-images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: formData,
  });

  return parseEdgeResponse(res);
}

/** Replace student image — web: update-student-image */
export async function updateStudentImage(
  studentRowId: string,
  uri: string,
  existingPath: string = ''
) {
  const token = await getSessionToken();
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
      apikey: SUPABASE_ANON_KEY,
    },
    body: formData,
  });

  return parseEdgeResponse(res);
}

/**
 * Delete student — exact web payload.
 * Edge function uses service role to:
 *  - delete storage image (private bucket)
 *  - delete auth user if any
 *  - delete students row
 *
 * Body: { student_id: "<business id e.g. 02>" }
 */
export async function deleteStudentViaEdge(studentBusinessId: string) {
  if (!studentBusinessId) {
    throw { message: 'Missing student_id' };
  }

  const headers = await edgeHeaders(true);

  const res = await fetch(`${FUNCTIONS_BASE}/delete-student`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      student_id: studentBusinessId,
    }),
  });

  const data = await parseEdgeResponse(res);

  // Some functions return { success: false } with HTTP 200
  if (data && data.success === false) {
    throw data.error ?? data.message ?? data;
  }

  return data;
}

/** Create student — web: create-student-auth */
export async function createStudentViaEdge(payload: Record<string, any>) {
  const headers = await edgeHeaders(true);

  const res = await fetch(`${FUNCTIONS_BASE}/create-student-auth`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return parseEdgeResponse(res);
}

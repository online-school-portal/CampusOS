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

/**
 * Friendlier errors — closer to web getFriendlyError.
 * Handles CORS / Failed to fetch which browsers surface only as TypeError.
 */
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

  // CORS / browser blocked the request (common with extra headers)
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('cors') ||
    lower.includes('access-control') ||
    (name === 'typeerror' && lower.includes('fetch'))
  ) {
    return 'Request blocked (CORS or network). Check edge function headers match the web app (Authorization only — no extra apikey header).';
  }

  if (lower.includes('bucket') || lower.includes('storage') || lower.includes('upload')) {
    if (lower.includes('not found') || lower.includes('does not exist')) {
      return 'Photo storage not found. Check edge function / bucket config.';
    }
    if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
      return 'Photo action blocked by storage policy.';
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

  if (lower.includes('timeout')) {
    return 'Request timed out. Try again.';
  }

  if (
    lower.includes('jwt') ||
    lower.includes('token') ||
    lower.includes('session') ||
    lower.includes('authenticated') ||
    lower.includes('admin not authenticated')
  ) {
    return 'Session expired. Please log in again.';
  }

  // Prefer real server message when we have one
  if (msg && msg !== '{}' && msg !== '[object Object]') {
    return msg;
  }

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

/**
 * Headers match the web dashboard exactly:
 * Authorization: Bearer <access_token>
 * Content-Type: application/json  (for JSON bodies only)
 * NO apikey header — that triggers CORS preflight rejection on your edge functions.
 */
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
      // no apikey — matches web
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
    },
    body: formData,
  });

  return parseEdgeResponse(res);
}

/**
 * Delete student — exact web headers + body.
 * Body: { student_id: "<business id>" }
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

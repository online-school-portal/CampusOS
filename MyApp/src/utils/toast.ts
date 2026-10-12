import { Alert, Platform } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

/**
 * Simple cross-platform toast.
 * On web we inject a temporary DOM element (like your web .toast).
 * On native we fall back to Alert for reliability.
 */
export function showToast(message: string, type: ToastType = 'info') {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // Remove existing toast
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
      fontWeight: '600',
      fontFamily: 'inherit',
      fontSize: '0.9rem',
      background: bg,
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
      maxWidth: '90vw',
      transition: 'opacity 0.3s',
    });

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);

    return;
  }

  // Native fallback
  const title =
    type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info';
  Alert.alert(title, message);
}

/**
 * Map Supabase / network errors to readable messages
 * (same idea as getFriendlyError on the web).
 */
export function getFriendlyError(err: any): string {
  if (!err) return 'Something went wrong. Please try again.';

  const msg =
    typeof err === 'string'
      ? err
      : err.message || err.error_description || err.msg || '';

  const lower = msg.toLowerCase();

  // Storage
  if (lower.includes('bucket') || lower.includes('storage')) {
    if (lower.includes('not found') || lower.includes('does not exist')) {
      return 'Photo storage bucket not found. Check Supabase Storage → student-photos.';
    }
    if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
      return 'Photo upload blocked by storage policy. Allow INSERT for authenticated users on student-photos.';
    }
    if (lower.includes('payload') || lower.includes('too large') || lower.includes('413')) {
      return 'Photo is too large. Try a smaller image.';
    }
    if (lower.includes('mime') || lower.includes('content-type') || lower.includes('invalid')) {
      return 'Invalid image format. Please use JPG or PNG.';
    }
    return `Photo upload failed: ${msg}`;
  }

  // RLS / permissions
  if (
    lower.includes('row-level security') ||
    lower.includes('violates row-level') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return 'Permission denied by database policy (RLS). You may not have rights for this action.';
  }

  // Unique / duplicate
  if (
    lower.includes('duplicate') ||
    lower.includes('unique') ||
    lower.includes('already exists') ||
    lower.includes('23505')
  ) {
    return 'This record already exists (duplicate ID or unique field).';
  }

  // Foreign key
  if (lower.includes('foreign key') || lower.includes('23503')) {
    return 'Related record missing (e.g. class or school). Check linked data.';
  }

  // Not found
  if (lower.includes('not found') || lower.includes('0 rows') || lower.includes('pgrst116')) {
    return 'Record not found. It may have been deleted already.';
  }

  // Network
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout')
  ) {
    return 'Network error. Check your connection and try again.';
  }

  // Auth
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('session')) {
    return 'Session expired. Please log in again.';
  }

  // Fallback — show original so you can still debug
  return msg || 'Something went wrong. Please try again.';
}

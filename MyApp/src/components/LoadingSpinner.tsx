import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';

type LoadingSpinnerProps = {
  visible?: boolean;
  message?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
  color?: string;
};

/**
 * Reusable loading spinner for CampusOS.
 *
 * Usage:
 * 1. Full-screen overlay (blocks UI while loading):
 *    <LoadingSpinner visible={loading} message="Loading students..." />
 *
 * 2. Inline (inside a screen, non-blocking):
 *    {loading ? <LoadingSpinner fullScreen={false} /> : <YourContent />}
 */
export default function LoadingSpinner({
  visible = true,
  message = 'Loading...',
  fullScreen = true,
  size = 'large',
  color = '#1e40af',
}: LoadingSpinnerProps) {
  if (!visible) return null;

  // Inline version (no Modal)
  if (!fullScreen) {
    return (
      <View style={styles.inline}>
        <ActivityIndicator size={size} color={color} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  // Full-screen overlay
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <ActivityIndicator size={size} color={color} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  inline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 40,
  },
  message: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    textAlign: 'center',
  },
});

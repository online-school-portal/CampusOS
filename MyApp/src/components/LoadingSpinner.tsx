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

export default function LoadingSpinner({
  visible = true,
  message = 'Loading...',
  fullScreen = true,
  size = 'large',
  color = '#1e40af',
}: LoadingSpinnerProps) {
  if (!visible) {
    return null;
  }

  if (!fullScreen) {
    return (
      <View style={styles.inline}>
        <ActivityIndicator size={size} color={color} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

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
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#334155',
    textAlign: 'center',
  },
});

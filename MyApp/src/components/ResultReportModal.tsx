import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PreparedReport,
  printReport,
  buildWebReportHTML,
} from '@/lib/reportHelpers';
import { showToast, getFriendlyError } from '@/utils/toast';

type Props = {
  visible: boolean;
  report: PreparedReport | null;
  onClose: () => void;
};

/**
 * Renders the SAME HTML/CSS as the web dashboard report card.
 * On web: iframe with srcDoc.
 * On native: opens print/HTML window is limited — still uses HTML string via WebView fallback message.
 */
export default function ResultReportModal({ visible, report, onClose }: Props) {
  const { height } = useWindowDimensions();

  const html = useMemo(() => {
    if (!report) return '';
    return report.html || buildWebReportHTML(report);
  }, [report]);

  if (!report) return null;

  const primary = report.school?.primary_color || '#1a3d7c';

  const handlePrint = () => {
    try {
      if (Platform.OS === 'web') {
        printReport(report);
      } else {
        showToast('Print is available on web. Showing report layout here.', 'info');
      }
    } catch (err) {
      showToast(getFriendlyError(err), 'error');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.toolBtn}>
            <Ionicons name="close" size={22} color="#64748b" />
            <Text style={styles.toolBtnText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={[styles.printBtn, { backgroundColor: primary }]}
          >
            <Ionicons name="print-outline" size={20} color="#fff" />
            <Text style={styles.printText}>Print</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          // @ts-ignore — iframe is valid on react-native-web
          <iframe
            title="Report Card"
            srcDoc={html}
            style={{
              width: '100%',
              height: height - 56,
              border: 'none',
              background: '#e0e0e0',
            }}
          />
        ) : (
          <View style={styles.nativeFallback}>
            <Text style={styles.fallbackTitle}>Report card</Text>
            <Text style={styles.fallbackBody}>
              Full styled report matches the website when viewed on web (Expo
              web / browser). Open Manage Results → View on web for the exact
              layout, or use Print there.
            </Text>
            <Text style={styles.fallbackMeta}>
              {report.row?.students?.full_name} · {report.row?.term} ·{' '}
              {report.row?.session}
            </Text>
            <Text style={styles.fallbackMeta}>
              Average {report.average}% · {report.overallGrade} · Position{' '}
              {report.position}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e0e0e0' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 2,
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolBtnText: {
    color: '#64748b',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  printText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  nativeFallback: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  fallbackTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  fallbackBody: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  fallbackMeta: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 6,
  },
});

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
  openPrintPlaceholder,
} from '@/lib/reportHelpers';
import { showToast, getFriendlyError } from '@/utils/toast';

type Props = {
  visible: boolean;
  report: PreparedReport | null;
  onClose: () => void;
};

/**
 * On-screen: mobile stacked layout (report.html).
 * Print / PDF: A4 web layout (report.printHtml) — 1 page per student.
 */
export default function ResultReportModal({ visible, report, onClose }: Props) {
  const { height } = useWindowDimensions();

  const mobileHtml = useMemo(() => {
    if (!report) return '';
    return report.html || '';
  }, [report]);

  if (!report) return null;

  const primary = report.school?.primary_color || '#1a3d7c';

  const handlePrint = () => {
    try {
      if (Platform.OS !== 'web') {
        showToast(
          'Open this on web (browser) to print / Save as PDF with the A4 layout.',
          'info'
        );
        return;
      }
      // Open placeholder immediately (user gesture) so print is not blocked
      const win = openPrintPlaceholder('Preparing Report...');
      printReport(report, win);
      if (!win) {
        // iframe path used — still OK
        showToast('Print dialog opening…', 'info');
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
            <Text style={styles.printText}>Print / PDF</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          // @ts-ignore
          <iframe
            title="Report Card"
            srcDoc={mobileHtml}
            style={{
              width: '100%',
              height: height - 56,
              border: 'none',
              background: '#e8ecf1',
            }}
          />
        ) : (
          <View style={styles.nativeFallback}>
            <Text style={styles.fallbackTitle}>Report card</Text>
            <Text style={styles.fallbackBody}>
              Mobile layout is best viewed on web. Use Print / PDF on browser for
              the official 1-page A4 sheet (same as the website).
            </Text>
            <Text style={styles.fallbackMeta}>
              {report.row?.students?.full_name} · {report.row?.term} ·{' '}
              {report.row?.session}
            </Text>
            <Text style={styles.fallbackMeta}>
              Average {report.average}% · {report.overallGrade} · Position{' '}
              {report.position}
            </Text>
            <Text style={styles.fallbackMeta}>
              Headmaster: {report.headmasterComment}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8ecf1' },
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
  nativeFallback: { flex: 1, padding: 24, justifyContent: 'center' },
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

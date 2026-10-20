import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import { showToast, getFriendlyError } from '@/utils/toast';

/**
 * Credit tracking — summary + buy flow (web parity).
 * Fee payment screens no longer deduct credits on the frontend.
 */
export default function CreditTrackingScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('INACTIVE');
  const [credits, setCredits] = useState(0);
  const [amount, setAmount] = useState('');
  const [payStatus, setPayStatus] = useState('');

  const loadCredits = async () => {
    try {
      const { data, error } = await supabase.rpc('get_credit_summary');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setCredits(Number(row?.total_credits || 0));
      setStatus(row?.status || 'INACTIVE');
    } catch (err) {
      console.log('loadCredits', err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCredits();
    }, [])
  );

  const payNow = async () => {
    const naira = Number(amount);
    if (!naira || naira <= 0) {
      setPayStatus('Enter a valid amount');
      showToast('Enter a valid amount', 'error');
      return;
    }

    setBusy(true);
    setPayStatus('Initializing payment...');
    try {
      const { data: schoolId } = await supabase.rpc('current_user_school_id');
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!schoolId || !session) {
        setPayStatus('Auth error');
        showToast('Auth error', 'error');
        return;
      }

      // Same edge function as web dashboard
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/initiate-paystack`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            school_id: schoolId,
            email: session.user.email,
            amount: naira,
            origin,
          }),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw {
          message:
            result?.error ||
            result?.message ||
            'Payment failed. Check CORS allowed origins on initiate-paystack.',
        };
      }

      if (result?.authorization_url) {
        setPayStatus('Redirecting to payment...');
        setAmount('');
        if (typeof window !== 'undefined') {
          window.location.href = result.authorization_url;
        }
        return;
      }

      setPayStatus(result?.message || 'Payment initialized.');
      showToast(result?.message || 'Payment initialized.', 'success');
      await loadCredits();
    } catch (err) {
      setPayStatus(getFriendlyError(err));
      showToast(getFriendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      {(loading || busy) && (
        <LoadingSpinner visible message={busy ? 'Processing...' : 'Loading...'} />
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setLoading(true);
              loadCredits();
            }}
          />
        }
      >
        <Text style={styles.header}>Credit Tracking</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Credit Status</Text>
          <View style={styles.row}>
            <Text style={styles.meta}>Status</Text>
            <Text
              style={[
                styles.val,
                { color: status === 'ACTIVE' ? '#16a34a' : '#dc2626' },
              ]}
            >
              {status}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>Credits Left</Text>
            <Text style={styles.credits}>{credits}</Text>
          </View>
          <Text style={styles.price}>₦200 per credit</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buy Credits</Text>
          <Text style={styles.label}>Amount (₦)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            placeholderTextColor="#94a3b8"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity style={styles.btn} onPress={payNow} disabled={busy}>
            <Text style={styles.btnText}>Buy Credits</Text>
          </TouchableOpacity>
          {payStatus ? <Text style={styles.payStatus}>{payStatus}</Text> : null}
        </View>
</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 48 },
  header: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: '#0f172a',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  meta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
    fontSize: 14,
  },
  val: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  credits: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#1e40af',
  },
  price: {
    marginTop: 8,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 12,
    color: '#0f172a',
  },
  btn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  payStatus: {
    marginTop: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
    fontSize: 13,
  },
});

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import {
  getTableBill,
  createPaymentIntent,
  settlePayment,
  type TableBill,
  type PaymobMethod,
} from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'GuestBill'>;

type PayMethod = { key: PaymobMethod | 'cash'; label: string; icon: string; gateway: boolean };
const METHODS: PayMethod[] = [
  { key: 'card', label: 'Card', icon: '💳', gateway: true },
  { key: 'apple_pay', label: 'Apple Pay', icon: ' Pay', gateway: true },
  { key: 'instapay', label: 'InstaPay', icon: '⚡', gateway: true },
  { key: 'cash', label: 'Cash', icon: '💵', gateway: false },
];

export default function GuestBillScreen({ route, navigation }: Props) {
  const { tableId, orderId, guestName, payerCount } = route.params;
  const [bill, setBill] = useState<TableBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await getTableBill(tableId);
      setBill(b);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not load the bill.');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const currency = bill?.currency || 'EGP';
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`;

  // Even split: table balance divided across all approved guests (incl. host).
  const divisors = Math.max(1, payerCount);
  const myShare = bill && (bill.is_paid || bill.balance_due <= 0)
    ? 0
    : bill
      ? Number((bill.balance_due / divisors).toFixed(2))
      : 0;

  const handlePay = async (method: PayMethod) => {
    if (!orderId) {
      Alert.alert('No order', 'You need to place an order before paying.');
      return;
    }
    if (myShare <= 0) {
      Alert.alert('Nothing to pay', 'Your share is already settled.');
      return;
    }
    setProcessing(method.key);
    try {
      if (method.gateway) {
        const intent = await createPaymentIntent({
          orderId,
          amount: myShare,
          method: method.key as PaymobMethod,
        });
        navigation.navigate('PaymentProcessing', {
          orderId,
          iframeUrl: intent.iframe_url,
          method: method.key as PaymobMethod,
        });
      } else {
        await settlePayment({ orderId, amount: myShare, method: 'cash' });
        navigation.navigate('PaymentResult', { orderId, success: true, method: 'cash' });
      }
    } catch (err: any) {
      Alert.alert(
        'Payment error',
        err?.response?.data?.error || err?.message || 'Could not start payment.',
      );
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your share…</Text>
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error || 'Bill unavailable'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Share</Text>
      <Text style={styles.subtitle}>{guestName} · Table bill split</Text>

      <View style={styles.shareCard}>
        <Text style={styles.shareLabel}>You owe</Text>
        <Text style={styles.shareValue}>{fmt(myShare)}</Text>
        <View style={styles.tableMeta}>
          <Text style={styles.metaText}>Table total: {fmt(bill.total)}</Text>
          <Text style={styles.metaText}>Already paid: {fmt(bill.amount_paid)}</Text>
        </View>
      </View>

      {bill.is_paid || myShare <= 0 ? (
        <View style={styles.paidBanner}>
          <Text style={styles.paidBannerText}>✓ Your share is settled — enjoy!</Text>
        </View>
      ) : (
        <>
          <Text style={styles.payHeading}>Choose how to pay</Text>
          <View style={styles.methodGrid}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodBtn, !!processing && styles.methodDisabled]}
                onPress={() => handlePay(m)}
                disabled={!!processing}
                activeOpacity={0.85}
              >
                {processing === m.key ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <>
                    <Text style={styles.methodIcon}>{m.icon}</Text>
                    <Text style={styles.methodLabel}>{m.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.blueBg },
  center: { justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  loadingText: { marginTop: SPACING.md, color: COLORS.text, fontSize: 15 },
  errorIcon: { fontSize: 48 },
  errorText: { marginTop: SPACING.md, color: COLORS.text, fontSize: 16, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingVertical: 12,
    paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },
  heading: { fontFamily: FONTS.serif, fontSize: 30, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textVariant, fontSize: 14, marginTop: 2, marginBottom: SPACING.md },
  shareCard: {
    backgroundColor: COLORS.goldLight, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', marginTop: SPACING.md,
  },
  shareLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textVariant, textTransform: 'uppercase', letterSpacing: 1 },
  shareValue: { fontSize: 44, fontWeight: '900', color: COLORS.goldDark, marginTop: SPACING.xs },
  tableMeta: { marginTop: SPACING.md, alignItems: 'center' },
  metaText: { fontSize: 13, color: COLORS.textVariant, marginTop: 2 },
  payHeading: {
    fontFamily: FONTS.serif, fontSize: 20, fontWeight: '800', color: COLORS.text,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  methodBtn: {
    width: '48%', backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: SPACING.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, minHeight: 92,
  },
  methodDisabled: { opacity: 0.5 },
  methodIcon: { fontSize: 26, color: COLORS.text, fontWeight: '700' },
  methodLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xs },
  paidBanner: {
    marginTop: SPACING.lg, backgroundColor: COLORS.greenBg, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  paidBannerText: { color: COLORS.green, fontWeight: '800', fontSize: 16 },
});
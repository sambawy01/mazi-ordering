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
  getBill,
  createPaymentIntent,
  settlePayment,
  type Bill,
  type PaymobMethod,
} from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Bill'>;

type PayMethod = {
  key: PaymobMethod | 'cash';
  label: string;
  icon: string;
  gateway: boolean; // true => goes through Paymob first
};

const METHODS: PayMethod[] = [
  { key: 'card', label: 'Card', icon: '💳', gateway: true },
  { key: 'apple_pay', label: 'Apple Pay', icon: '', gateway: true },
  { key: 'instapay', label: 'InstaPay', icon: '⚡', gateway: true },
  { key: 'cash', label: 'Cash', icon: '💵', gateway: false },
];

export default function BillScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadBill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await getBill(orderId);
      setBill(b);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not load your bill.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Reload whenever the screen regains focus (e.g. returning from payment).
  useFocusEffect(
    useCallback(() => {
      loadBill();
    }, [loadBill]),
  );

  const currency = bill?.currency || 'EGP';
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`;

  const handlePay = async (method: PayMethod) => {
    if (!bill) return;
    if (bill.balance_due <= 0) {
      Alert.alert('Already settled', 'This bill has been fully paid.');
      return;
    }
    setProcessing(method.key);
    try {
      if (method.gateway) {
        // Card / Apple Pay / InstaPay → Paymob hosted iframe.
        const intent = await createPaymentIntent({
          orderId,
          amount: bill.balance_due,
          method: method.key as PaymobMethod,
        });
        navigation.navigate('PaymentProcessing', {
          orderId,
          iframeUrl: intent.iframe_url,
          method: method.key as PaymobMethod,
        });
      } else {
        // Cash → record directly in Foodics, pay at counter.
        await settlePayment({ orderId, amount: bill.balance_due, method: 'cash' });
        navigation.navigate('PaymentResult', {
          orderId,
          success: true,
          method: 'cash',
        });
      }
    } catch (err: any) {
      Alert.alert(
        'Payment error',
        err?.response?.data?.error || err?.message || 'Could not start payment. Please try again.',
      );
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your bill…</Text>
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error || 'Bill unavailable'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadBill}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Your Bill</Text>
        {bill.reference ? <Text style={styles.reference}>Order #{bill.reference}</Text> : null}

        <View style={styles.card}>
          {bill.items.length === 0 ? (
            <Text style={styles.emptyItems}>No items on this order yet.</Text>
          ) : (
            bill.items.map((item, idx) => (
              <View key={`${item.product_id ?? idx}`} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemQty}>{item.quantity}×</Text>
                  <View style={styles.itemNameWrap}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemUnit}>{fmt(item.unit_price)} each</Text>
                  </View>
                </View>
                <Text style={styles.itemTotal}>{fmt(item.line_total)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <SummaryRow label="Subtotal" value={fmt(bill.subtotal)} />
          {bill.discount > 0 && <SummaryRow label="Discount" value={`- ${fmt(bill.discount)}`} />}
          <SummaryRow label="Taxes" value={fmt(bill.taxes)} />
          {bill.charges > 0 && <SummaryRow label="Charges" value={fmt(bill.charges)} />}
          <View style={styles.divider} />
          <SummaryRow label="Total" value={fmt(bill.total)} strong />
          {bill.amount_paid > 0 && (
            <SummaryRow label="Amount paid" value={`- ${fmt(bill.amount_paid)}`} />
          )}
          <View style={[styles.balanceRow]}>
            <Text style={styles.balanceLabel}>Balance due</Text>
            <Text style={styles.balanceValue}>{fmt(bill.balance_due)}</Text>
          </View>
        </View>

        {bill.is_paid ? (
          <View style={styles.paidBanner}>
            <Text style={styles.paidBannerText}>✓ This bill is fully settled</Text>
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
                      <Text style={styles.methodIcon}>
                        {m.key === 'apple_pay' ? ' Pay' : m.icon}
                      </Text>
                      <Text style={styles.methodLabel}>{m.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong]}>{value}</Text>
    </View>
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
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },
  heading: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
  },
  reference: { color: COLORS.text, opacity: 0.7, marginBottom: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  emptyItems: { color: COLORS.textVariant, textAlign: 'center', paddingVertical: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.outline,
  },
  itemLeft: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  itemQty: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginRight: SPACING.sm, minWidth: 30 },
  itemNameWrap: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemUnit: { fontSize: 12, color: COLORS.textVariant, marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginLeft: SPACING.sm },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: { fontSize: 15, color: COLORS.textVariant },
  summaryLabelStrong: { fontWeight: '800', color: COLORS.text, fontSize: 16 },
  summaryValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  summaryValueStrong: { fontWeight: '800', fontSize: 16 },
  divider: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginVertical: SPACING.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    backgroundColor: COLORS.goldLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  balanceLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  balanceValue: { fontSize: 20, fontWeight: '900', color: COLORS.goldDark },
  payHeading: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  methodBtn: {
    width: '48%',
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    minHeight: 92,
  },
  methodDisabled: { opacity: 0.5 },
  methodIcon: { fontSize: 26, color: COLORS.text, fontWeight: '700' },
  methodLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xs },
  paidBanner: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.greenBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  paidBannerText: { color: COLORS.green, fontWeight: '800', fontSize: 16 },
});

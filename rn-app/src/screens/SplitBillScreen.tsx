import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { getTableBill, settlePayment, type TableBill } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SplitBill'>;

export default function SplitBillScreen({ navigation, route }: Props) {
  const { tableId } = route.params;
  const { tableGuests, myOrderId, billOwnerName } = useApp();
  const [bill, setBill] = useState<TableBill | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const { bill: b, demo: isDemo } = await getTableBill(tableId);
      setBill(b);
      setDemo(isDemo);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not load the table bill.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tableId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Approved guests = tableGuests with approved === true (host is id '0').
  const approvedGuests = tableGuests.filter((g) => g.approved);
  const payerCount = Math.max(1, approvedGuests.length);

  const currency = bill?.currency || 'EGP';
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`;

  const balanceDue = bill?.balance_due ?? 0;
  const evenShare = balanceDue / payerCount;

  const handlePayMyShare = async () => {
    if (!myOrderId) {
      Alert.alert('No order yet', 'You need to place an order before you can pay your share.');
      return;
    }
    if (evenShare <= 0) {
      Alert.alert('Nothing to pay', 'The bill is already settled.');
      return;
    }
    setPaying(true);
    try {
      // Host pays their share in cash as a direct settle against their own order.
      await settlePayment({ orderId: myOrderId, amount: evenShare, method: 'cash' });
      Alert.alert('Share recorded', `Your share of ${fmt(evenShare)} was recorded as cash.`, [
        { text: 'OK', onPress: () => load() },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Payment failed',
        err?.response?.data?.error || err?.message || 'Could not record your share.',
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading the table bill…</Text>
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Split the Bill</Text>
      <Text style={styles.subtitle}>
        {payerCount} {payerCount === 1 ? 'person' : 'people'} sharing · even split
      </Text>

      {demo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            DEMO BILL — sample data. Real bill appears once Foodics is connected.
          </Text>
        </View>
      )}

      {/* Totals card */}
      <View style={styles.card}>
        <Row label="Total" value={fmt(bill.total)} />
        <Row label="Already paid" value={`- ${fmt(bill.amount_paid)}`} />
        <View style={styles.divider} />
        <Row label="Balance due" value={fmt(bill.balance_due)} strong />
        <View style={styles.shareRow}>
          <Text style={styles.shareLabel}>Each person pays</Text>
          <Text style={styles.shareValue}>{fmt(evenShare)}</Text>
        </View>
      </View>

      {/* Itemized */}
      {bill.items.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ordered at this table</Text>
          {bill.items.map((item, idx) => (
            <View key={`${item.product_id ?? idx}-${item.order_id ?? idx}`} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <View style={styles.itemNameWrap}>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
              </View>
              <Text style={styles.itemTotal}>{fmt(item.line_total)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Payer breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Who's paying</Text>
        {approvedGuests.map((g) => (
          <View key={g.id} style={styles.payerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{g.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.payerInfo}>
              <Text style={styles.payerName}>
                {g.name}
                {g.role === 'owner' ? ' · host' : ''}
              </Text>
              <Text style={styles.payerPhone}>{g.phone}</Text>
            </View>
            <Text style={styles.payerShare}>{fmt(evenShare)}</Text>
          </View>
        ))}
      </View>

      {/* Host pay own share */}
      {bill.is_paid ? (
        <View style={styles.paidBanner}>
          <Text style={styles.paidBannerText}>✓ This bill is fully settled</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.payBtn, paying && styles.payBtnDisabled]}
          onPress={handlePayMyShare}
          disabled={paying}
          activeOpacity={0.85}
        >
          {paying ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.payBtnText}>Pay my share ({fmt(evenShare)}) · Cash</Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.note}>
        Approved guests can open "Your Share" on their own device to pay with card, Apple Pay, or InstaPay.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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
  heading: { fontFamily: FONTS.serif, fontSize: 30, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textVariant, fontSize: 14, marginTop: 2, marginBottom: SPACING.md },
  demoBanner: {
    backgroundColor: COLORS.goldLight, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.gold,
  },
  demoBannerText: { color: COLORS.goldDark, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textVariant, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  summaryLabel: { fontSize: 15, color: COLORS.textVariant },
  summaryLabelStrong: { fontWeight: '800', color: COLORS.text, fontSize: 16 },
  summaryValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  summaryValueStrong: { fontWeight: '800', fontSize: 16 },
  divider: { height: 1, backgroundColor: COLORS.outline, marginVertical: SPACING.sm },
  shareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.sm, backgroundColor: COLORS.goldLight, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  shareLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  shareValue: { fontSize: 20, fontWeight: '900', color: COLORS.goldDark },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.outline,
  },
  itemLeft: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  itemQty: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginRight: SPACING.sm, minWidth: 30 },
  itemNameWrap: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemTotal: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginLeft: SPACING.sm },
  payerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.outline },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  payerInfo: { flex: 1, marginLeft: SPACING.sm },
  payerName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  payerPhone: { fontSize: 13, color: COLORS.textVariant, marginTop: 2 },
  payerShare: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  payBtn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: SPACING.lg,
    alignItems: 'center', marginTop: SPACING.lg,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  paidBanner: {
    marginTop: SPACING.lg, backgroundColor: COLORS.greenBg, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  paidBannerText: { color: COLORS.green, fontWeight: '800', fontSize: 16 },
  note: { fontSize: 12, color: COLORS.textVariant, textAlign: 'center', marginTop: SPACING.md, lineHeight: 18 },
});
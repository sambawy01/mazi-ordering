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
import { getTableBill, settleTable, type TableBill } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SettleBill'>;

export default function SettleBillScreen({ navigation, route }: Props) {
  const { tableId } = route.params;
  const { tableGuests } = useApp();
  const [bill, setBill] = useState<TableBill | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

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

  const approvedGuests = tableGuests.filter((g) => g.approved);
  const payerCount = Math.max(1, approvedGuests.length);

  const currency = bill?.currency || 'EGP';
  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`;
  const balanceDue = bill?.balance_due ?? 0;
  const evenShare = balanceDue / payerCount;

  // PRIMARY: one-tap settle the full bill (cash by default)
  const handleSettleFull = async () => {
    if (balanceDue <= 0) {
      Alert.alert('Already settled', 'This bill has been fully paid.');
      return;
    }
    setSettling(true);
    try {
      const { settled } = await settleTable({ tableId, method: 'cash' });
      if (settled) {
        Alert.alert(
          'Bill settled',
          `The full bill of ${fmt(balanceDue)} was recorded as cash.`,
          [{ text: 'Done', onPress: () => navigation.navigate('ClientMenu') }],
        );
        load();
      }
    } catch (err: any) {
      Alert.alert(
        'Settle failed',
        err?.response?.data?.error || err?.message || 'Could not settle the bill.',
      );
    } finally {
      setSettling(false);
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
      <Text style={styles.heading}>Settle the Bill</Text>
      <Text style={styles.subtitle}>
        {payerCount} {payerCount === 1 ? 'person' : 'people'} at this table
      </Text>

      {demo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            DEMO BILL — sample data. Real bill appears once Foodics is connected.
          </Text>
        </View>
      )}

      {/* Bill summary */}
      <View style={styles.card}>
        <Row label="Total" value={fmt(bill.total)} />
        {bill.amount_paid > 0 && <Row label="Already paid" value={`- ${fmt(bill.amount_paid)}`} />}
        <View style={styles.divider} />
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Balance due</Text>
          <Text style={styles.balanceValue}>{fmt(bill.balance_due)}</Text>
        </View>
      </View>

      {/* PRIMARY — one-tap settle */}
      <Text style={styles.sectionLabel}>How would you like to pay?</Text>
      <TouchableOpacity
        style={[styles.primaryBtn, settling && styles.primaryBtnDisabled]}
        onPress={handleSettleFull}
        disabled={settling}
        activeOpacity={0.85}
      >
        {settling ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <View style={styles.primaryBtnInner}>
            <Text style={styles.primaryBtnIcon}>💳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryBtnTitle}>Settle the full bill</Text>
              <Text style={styles.primaryBtnSub}>Pay {fmt(balanceDue)} now · Cash</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* SECONDARY — split into separate checks */}
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate('SplitBill', { tableId })}
        activeOpacity={0.85}
      >
        <View style={styles.secondaryBtnInner}>
          <Text style={styles.secondaryBtnIcon}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryBtnTitle}>Split into separate checks</Text>
            <Text style={styles.secondaryBtnSub}>
              Even split · {fmt(evenShare)} per person across {payerCount}
            </Text>
          </View>
          <Text style={styles.secondaryBtnChevron}>›</Text>
        </View>
      </TouchableOpacity>

      {bill.is_paid && (
        <View style={styles.paidBanner}>
          <Text style={styles.paidBannerText}>✓ This bill is fully settled</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
    marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingVertical: 12,
    paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },
  heading: { fontFamily: FONTS.serif, fontSize: 30, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textVariant, fontSize: 14, marginTop: 2, marginBottom: SPACING.md },
  demoBanner: {
    backgroundColor: COLORS.goldLight, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.gold,
  },
  demoBannerText: { color: COLORS.goldDark, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.outline,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  summaryLabel: { fontSize: 15, color: COLORS.textVariant },
  summaryValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.outline, marginVertical: SPACING.sm },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.goldLight, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  balanceLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  balanceValue: { fontSize: 20, fontWeight: '900', color: COLORS.goldDark },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textVariant, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnInner: { flexDirection: 'row', alignItems: 'center' },
  primaryBtnIcon: { fontSize: 28, marginRight: SPACING.md },
  primaryBtnTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  primaryBtnSub: { color: COLORS.primaryLight, fontSize: 13, marginTop: 2 },
  secondaryBtn: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.outline,
  },
  secondaryBtnInner: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtnIcon: { fontSize: 28, marginRight: SPACING.md },
  secondaryBtnTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  secondaryBtnSub: { color: COLORS.textVariant, fontSize: 13, marginTop: 2 },
  secondaryBtnChevron: { fontSize: 24, fontWeight: '700', color: COLORS.outline },
  paidBanner: {
    marginTop: SPACING.lg, backgroundColor: COLORS.greenBg, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  paidBannerText: { color: COLORS.green, fontWeight: '800', fontSize: 16 },
});
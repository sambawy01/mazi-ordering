import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { getOrder, listOrders } from '../services/api';
import type { Order } from '../types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;

const STATUS_STEPS = [
  { key: 1, label: 'Placed', icon: 'P' },
  { key: 2, label: 'Sent to Kitchen', icon: 'S' },
  { key: 3, label: 'Preparing', icon: 'K' },
  { key: 4, label: 'Ready', icon: 'R' },
  { key: 5, label: 'Served', icon: 'V' },
];

export default function OrderStatusScreen({ navigation, route }: Props) {
  const { qrPayload, myOrderId, isHostSet, billOwnerPhone, guestPhone, tableGuests, guestName } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingBill, setRequestingBill] = useState(false);

  const orderId = route.params?.orderId;
  const isHost = isHostSet && billOwnerPhone === guestPhone;
  const approvedGuests = tableGuests.filter((g) => g.approved);
  const payerCount = Math.max(1, approvedGuests.length);

  const load = useCallback(async () => {
    try {
      if (orderId) {
        const o = await getOrder(orderId);
        setOrder(o);
      } else {
        const orders = await listOrders(qrPayload?.branch_id);
        const mine = orders.find((o) => o.table_id === qrPayload?.table_id) || orders[0];
        setOrder(mine || null);
      }
    } catch (err: any) {
      if (loading) {
        Alert.alert('Could not load order', err?.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, qrPayload?.branch_id, qrPayload?.table_id, loading]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const requestBill = () => {
    if (!qrPayload?.table_id) {
      Alert.alert('No table', 'Table information is missing.');
      return;
    }
    if (isHost) {
      navigation.navigate('SplitBill', { tableId: qrPayload.table_id });
    } else if (myOrderId) {
      navigation.navigate('GuestBill', {
        tableId: qrPayload.table_id,
        orderId: myOrderId,
        guestName: guestName || 'Guest',
        payerCount,
      });
    } else {
      Alert.alert('No order yet', 'Place an order first, then settle your share.');
    }
  };

  const currentStep = order?.status ?? 1;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading order</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No order found.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('ClientMenu')}>
          <Text style={styles.primaryBtnText}>Back to menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderLabel}>Order</Text>
            <Text style={styles.orderId}>{'#' + order.id.slice(-6).toUpperCase()}</Text>
          </View>
          <View style={styles.tablePill}>
            <Text style={styles.tablePillText}>{order.table_name || qrPayload?.reservation_name || 'Table'}</Text>
          </View>
        </View>

        {order.products && order.products.length > 0 && (
          <View style={styles.productsList}>
            {order.products.map((p, i) => (
              <View key={i} style={styles.productRow}>
                <Text style={styles.productQty}>{p.quantity}x</Text>
                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.productPrice}>EUR {(p.total_price ?? (p.unit_price ?? 0) * p.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {order.total != null && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>EUR {order.total.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Order Status</Text>
        {STATUS_STEPS.map((step, idx) => {
          const isDone = currentStep >= step.key;
          const isCurrent = currentStep === step.key;
          const isLast = idx === STATUS_STEPS.length - 1;
          return (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, isDone && styles.dotDone, isCurrent && styles.dotCurrent]}>
                  <Text style={styles.dotIcon}>{isDone ? step.icon : 'o'}</Text>
                </View>
                {!isLast && <View style={[styles.line, isDone && styles.lineDone]} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.stepLabel, isDone && styles.stepLabelDone, isCurrent && styles.stepLabelCurrent]}>
                  {step.label}
                </Text>
                {isCurrent && <Text style={styles.stepSub}>In progress</Text>}
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.billBtn}
        onPress={requestBill}
        activeOpacity={0.85}
      >
        <Text style={styles.billBtnText}>
          {isHost ? 'View & Split the Bill' : 'View & Pay My Share'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuLink} onPress={() => navigation.navigate('ClientMenu')}>
        <Text style={styles.menuLinkText}>Back to menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.blueBg },
  content: { padding: SPACING.lg, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: COLORS.blueBg, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  loadingText: { color: COLORS.primary, marginTop: SPACING.sm },
  emptyText: { fontSize: 18, color: COLORS.textVariant, marginBottom: SPACING.lg },
  orderCard: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  orderLabel: { color: COLORS.gold, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  orderId: { color: COLORS.white, fontFamily: FONTS.serif, fontSize: 24, fontWeight: '700' },
  tablePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 4, paddingHorizontal: SPACING.md, borderRadius: 12 },
  tablePillText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  productsList: { marginTop: SPACING.xs },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  productQty: { color: COLORS.gold, fontWeight: '700', width: 32 },
  productName: { flex: 1, color: COLORS.white, fontSize: 14 },
  productPrice: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', marginTop: SPACING.sm, paddingTop: SPACING.sm },
  totalLabel: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  totalValue: { color: COLORS.gold, fontSize: 18, fontWeight: '800' },
  timelineCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  timelineTitle: { fontFamily: FONTS.serif, fontSize: 20, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.md },
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 44 },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceVariant, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.outline },
  dotDone: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  dotCurrent: { backgroundColor: COLORS.gold, borderColor: COLORS.goldDark },
  dotIcon: { fontSize: 16, fontWeight: '700' },
  line: { width: 2, flex: 1, backgroundColor: COLORS.outline, marginVertical: 2 },
  lineDone: { backgroundColor: COLORS.primary },
  timelineContent: { flex: 1, paddingBottom: SPACING.lg },
  stepLabel: { fontSize: 15, color: COLORS.textVariant, marginTop: 8 },
  stepLabelDone: { color: COLORS.text, fontWeight: '600' },
  stepLabelCurrent: { color: COLORS.primary, fontWeight: '700' },
  stepSub: { fontSize: 12, color: COLORS.goldDark, fontStyle: 'italic', marginTop: 2 },
  billBtn: { backgroundColor: COLORS.gold, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', marginBottom: SPACING.md },
  billBtnDisabled: { opacity: 0.6 },
  billBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  menuLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  menuLinkText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md },
  primaryBtnText: { color: COLORS.white, fontWeight: '700' },
});

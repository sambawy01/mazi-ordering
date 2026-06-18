import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme';
import type { Table } from '../types';
import { createOrder } from '../services/api';

interface Props {
  route: { params: { tableId: string } };
  navigation: any;
}

export default function StaffTableDetailScreen({ route, navigation }: Props) {
  // In production, fetch table by ID from API. For now use a placeholder.
  const table: Table = { id: route.params.tableId, name: route.params.tableId, status: 'free', seats: 4, section: 'Indoor' };
  const [loading, setLoading] = useState(false);

  const statusColor =
    table.status === 'free' ? COLORS.green :
    table.status === 'occupied' ? COLORS.red : COLORS.primary;

  const statusLabel =
    table.status === 'free' ? 'Free' :
    table.status === 'occupied' ? 'Occupied' : 'Reserved';

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const order = await createOrder({
        branch_id: table.section || '',
        table_id: table.id,
        type: 1,
        guests: table.seats || 1,
        source: 'waiter',
      });
      Alert.alert('Success', `Order created for ${table.name}`);
      navigation.navigate('Menu', { order, mode: 'waiter', tableId: table.id });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Table info header */}
      <View style={styles.header}>
        <Text style={styles.headerTable}>{table.name}</Text>
        <Text style={styles.headerMeta}>{table.section} · {table.seats} seats</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Details card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Table Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Section</Text>
          <Text style={styles.detailValue}>{table.section || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacity</Text>
          <Text style={styles.detailValue}>{table.seats} guests</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Text style={styles.detailValue}>{statusLabel}</Text>
        </View>
        {table.accepts_reservations && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reservations</Text>
            <Text style={styles.detailValue}>Accepted</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {table.status === 'free' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateOrder} disabled={loading}>
            <Text style={styles.primaryBtnText}>
              {loading ? 'Creating...' : '➕ Create Order'}
            </Text>
          </TouchableOpacity>
        )}
        {table.status === 'occupied' && (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('OrderStatus', { tableId: table.id })}
            >
              <Text style={styles.primaryBtnText}>📋 View Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Menu', { mode: 'waiter', tableId: table.id })}
            >
              <Text style={styles.secondaryBtnText}>➕ Add Items</Text>
            </TouchableOpacity>
          </>
        )}
        {table.status === 'reserved' && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateOrder} disabled={loading}>
              <Text style={styles.primaryBtnText}>
                {loading ? 'Starting...' : '➕ Start Service'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface, padding: SPACING.md },
  header: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  headerTable: { color: COLORS.white, fontSize: 32, fontWeight: '800' },
  headerMeta: { color: COLORS.white, opacity: 0.8, fontSize: 14, marginTop: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, alignSelf: 'flex-start', marginTop: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: COLORS.textVariant, fontSize: 14 },
  detailValue: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  actions: { gap: 10 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.primaryDark, fontSize: 16, fontWeight: '600' },
});
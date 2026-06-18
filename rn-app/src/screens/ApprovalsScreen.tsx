import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';

export default function ApprovalsScreen() {
  const { pendingRequests, approveRequest, denyRequest } = useApp();

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.phone} · {item.time}</Text>
        <Text style={styles.waiting}>⏳ Waiting for your approval</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => approveRequest(item.id)}
        >
          <Text style={styles.approveText}>✓ Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.denyBtn}
          onPress={() => denyRequest(item.id)}
        >
          <Text style={styles.denyText}>✕ Deny</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (pendingRequests.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={styles.emptyTitle}>No pending requests</Text>
        <Text style={styles.emptyText}>
          When guests scan the table QR and verify their phone, their requests will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={pendingRequests}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.md, backgroundColor: COLORS.surface },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.textVariant, marginTop: 2 },
  waiting: { fontSize: 11, color: COLORS.goldDark, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    backgroundColor: COLORS.green, borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 10,
  },
  approveText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  denyBtn: {
    backgroundColor: COLORS.red, borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 10,
  },
  denyText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.surface },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textVariant, textAlign: 'center', lineHeight: 20 },
});
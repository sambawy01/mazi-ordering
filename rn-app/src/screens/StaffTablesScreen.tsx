import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { getTables } from '../services/api';
import type { Table, TableStatus } from '../types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffTables'>;

const STATUS_META: Record<TableStatus, { label: string; bg: string; dot: string; text: string }> = {
  free: { label: 'Free', bg: COLORS.greenBg, dot: COLORS.green, text: COLORS.green },
  occupied: { label: 'Occupied', bg: COLORS.redBg, dot: COLORS.red, text: COLORS.red },
  reserved: { label: 'Reserved', bg: COLORS.primaryLight, dot: COLORS.primary, text: COLORS.primary },
};

interface Section {
  title: string;
  data: Table[];
}

export default function StaffTablesScreen({ navigation }: Props) {
  const { staffName, pendingRequests, reset, setStaffToken } = useApp();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getTables();
      setTables(data);
    } catch (err: any) {
      if (loading) {
        Alert.alert('Could not load tables', err?.response?.data?.error || err?.message || 'Check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Group by section
  const sections: Section[] = (() => {
    const map = new Map<string, Table[]>();
    tables.forEach((t) => {
      const key = t.section || 'Main';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  })();

  const openTable = (t: Table) => {
    navigation.navigate('StaffTableDetail', { tableId: t.id });
  };

  const logout = () => {
    Alert.alert('Sign out', 'Sign out of staff mode?', [
      { text: 'Cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setStaffToken(null);
          reset();
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        },
      },
    ]);
  };

  const renderTable = (t: Table) => {
    const meta = STATUS_META[t.status] || STATUS_META.free;
    return (
      <TouchableOpacity
        style={[styles.tableCard, { backgroundColor: meta.bg }]}
        onPress={() => openTable(t)}
        activeOpacity={0.85}
      >
        <View style={styles.tableTop}>
          <Text style={styles.tableName}>{t.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
        </View>
        <Text style={[styles.statusLabel, { color: meta.text }]}>{meta.label}</Text>
        <Text style={styles.seats}>{t.seats} seats</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>MAZI Staff</Text>
          <Text style={styles.headerName}>{staffName || 'Staff'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.approvalsBtn}
            onPress={() => navigation.navigate('Approvals')}
          >
            <Text style={styles.approvalsIcon}>!</Text>
            {pendingRequests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ flex: 1, marginTop: SPACING.xl }} />
      ) : tables.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tables found.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: section }) => (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.grid}>
                {section.data.map((t) => (
                  <View key={t.id} style={styles.gridItem}>
                    {renderTable(t)}
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLabel: {
    color: COLORS.gold,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerName: {
    color: COLORS.white,
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approvalsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  approvalsIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.red,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  logoutText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  sectionWrap: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tableCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tableTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONTS.serif,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  seats: {
    fontSize: 12,
    color: COLORS.textVariant,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textVariant,
    marginBottom: SPACING.md,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});

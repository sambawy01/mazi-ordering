import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { getMenu } from '../services/api';
import type { Product } from '../types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientMenu'>;

export default function ClientMenuScreen({ navigation }: Props) {
  const { billOwnerName, billOwnerPhone, guestPhone, isHostSet, pendingRequests, tableGuests, reset, qrPayload, myOrderId, guestName } = useApp();
  const [popular, setPopular] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isHost = isHostSet && billOwnerPhone === guestPhone;
  const approvedGuests = tableGuests.filter((g) => g.approved);
  const payerCount = Math.max(1, approvedGuests.length);

  const loadPopular = useCallback(async () => {
    try {
      const { products } = await getMenu();
      // Take a handful as "popular"
      const sorted = [...products]
        .sort((a, b) => (b.calories ?? 0) - (a.calories ?? 0))
        .slice(0, 6);
      setPopular(sorted.length ? sorted : products.slice(0, 6));
    } catch (err: any) {
      // Keep silent on refresh; alert on initial
      if (loading) {
        Alert.alert('Could not load menu', err?.message || 'Please check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadPopular();
  }, [loadPopular]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPopular();
  };

  const pendingCount = pendingRequests.length;

  const callWaiter = () => {
    Alert.alert('Waiter called', 'A member of staff will be with you shortly.', [
      { text: 'OK' },
    ]);
  };

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.popularCard}
      onPress={() => navigation.navigate('Menu')}
      activeOpacity={0.85}
    >
      <View style={styles.popularImageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.popularImage} resizeMode="cover" />
        ) : (
          <View style={[styles.popularImage, styles.popularImagePlaceholder]}>
            <Text style={styles.placeholderText}>{item.name.charAt(0)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.popularName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.popularPrice}>€{item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* Bill owner banner — blue gradient look */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.bannerLabel}>Table host</Text>
            <Text style={styles.bannerName}>{billOwnerName || 'You'}</Text>
            <Text style={styles.bannerSub}>
              {tableGuests.length} {tableGuests.length === 1 ? 'guest' : 'guests'} at this table
            </Text>
          </View>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>BILL OWNER</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={popular}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Menu')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>Browse Menu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Approvals')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>👥</Text>
              <Text style={styles.actionLabel}>Device Requests</Text>
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={callWaiter}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>🔔</Text>
              <Text style={styles.actionLabel}>Call Waiter</Text>
            </TouchableOpacity>
          </View>

          {/* Bill / split-bill entry */}
          {isHost ? (
            <TouchableOpacity
              style={styles.billBtn}
              onPress={() => {
                if (!qrPayload?.table_id) {
                  Alert.alert('No table', 'Table information is missing.');
                  return;
                }
                navigation.navigate('SplitBill', { tableId: qrPayload.table_id });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.billIcon}>🧾</Text>
              <View style={styles.billTextWrap}>
                <Text style={styles.billTitle}>View & Split Bill</Text>
                <Text style={styles.billSub}>
                  Even split across {payerCount} {payerCount === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <Text style={styles.billChevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.billBtn}
              onPress={() => {
                if (!qrPayload?.table_id || !myOrderId) {
                  Alert.alert('No order yet', 'Place an order first, then settle your share.');
                  return;
                }
                navigation.navigate('GuestBill', {
                  tableId: qrPayload.table_id,
                  orderId: myOrderId,
                  guestName: guestName || 'Guest',
                  payerCount,
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.billIcon}>🧾</Text>
              <View style={styles.billTextWrap}>
                <Text style={styles.billTitle}>View My Share</Text>
                <Text style={styles.billSub}>Pay your part of the table bill</Text>
              </View>
              <Text style={styles.billChevron}>›</Text>
            </TouchableOpacity>
          )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
          ) : (
            <Text style={styles.emptyText}>No popular items available.</Text>
          )
        }
        renderItem={renderItem}
      />

      <View style={styles.tableBar}>
        <Text style={styles.tableText}>
          {qrPayload?.reservation_name ? `Table ${qrPayload.reservation_name}` : 'MAZI'}
        </Text>
        <TouchableOpacity onPress={() => { reset(); navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); }}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  banner: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLabel: {
    color: COLORS.gold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  bannerName: {
    color: COLORS.white,
    fontFamily: FONTS.serif,
    fontSize: 26,
    fontWeight: '700',
  },
  bannerSub: {
    color: COLORS.primaryLight,
    fontSize: 13,
    marginTop: 2,
  },
  bannerBadge: {
    backgroundColor: COLORS.gold,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 6,
  },
  bannerBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 80,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  billBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  billIcon: { fontSize: 26, marginRight: SPACING.md },
  billTextWrap: { flex: 1 },
  billTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  billSub: { fontSize: 12, color: COLORS.primaryLight, marginTop: 2 },
  billChevron: { fontSize: 24, fontWeight: '700', color: COLORS.gold },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.red,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  popularCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outline,
    maxWidth: '48%',
  },
  popularImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceVariant,
  },
  popularImage: {
    width: '100%',
    height: '100%',
  },
  popularImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 36,
    color: COLORS.outline,
    fontFamily: FONTS.serif,
  },
  popularName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: SPACING.sm,
    paddingBottom: 0,
    minHeight: 38,
  },
  popularPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    padding: SPACING.sm,
    paddingTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textVariant,
    marginTop: SPACING.xl,
  },
  tableBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tableText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  exitText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
});

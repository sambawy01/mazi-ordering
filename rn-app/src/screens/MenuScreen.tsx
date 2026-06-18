import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { getMenu } from '../services/api';
import type { Product, Category, CartItem } from '../types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

const ALL = '__all__';

export default function MenuScreen({ navigation }: Props) {
  const { cart, addToCart, qrPayload } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const { products: p, categories: c } = await getMenu();
      setProducts(p);
      setCategories(c);
    } catch (err: any) {
      Alert.alert('Could not load menu', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (activeCat === ALL) return products;
    return products.filter((p) => p.category_id === activeCat);
  }, [products, activeCat]);

  const cartCount = cart.reduce((sum, c) => sum + (c.quantity ?? 0), 0);

  const openProduct = (p: Product) => {
    setSelected(p);
    setQty(1);
    setNotes('');
  };

  const confirmAdd = () => {
    if (!selected) return;
    const item: CartItem = {
      product: selected,
      quantity: qty,
      kitchenNotes: notes.trim() || undefined,
    };
    addToCart(item);
    setSelected(null);
    Alert.alert('Added', `${qty} × ${selected.name} added to your cart.`);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.card} onPress={() => openProduct(item)} activeOpacity={0.85}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <Text style={styles.cardPrice}>€{item.price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeCat === ALL && styles.tabActive]}
          onPress={() => setActiveCat(ALL)}
        >
          <Text style={[styles.tabText, activeCat === ALL && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.tab, activeCat === c.id && styles.tabActive]}
            onPress={() => setActiveCat(c.id)}
          >
            <Text style={[styles.tabText, activeCat === c.id && styles.tabTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ flex: 1, marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items in this category.</Text>
          }
          renderItem={renderProduct}
        />
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.85}
        >
          <Text style={styles.cartIcon}>🛒</Text>
          <Text style={styles.cartCount}>{cartCount}</Text>
          <Text style={styles.cartLabel}>View cart</Text>
        </TouchableOpacity>
      )}

      {/* Product detail bottom sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setSelected(null)} />
          <View style={styles.sheet}>
            {selected && (
              <>
                {selected.image ? (
                  <Image source={{ uri: selected.image }} style={styles.sheetImage} resizeMode="cover" />
                ) : null}
                <ScrollView style={{ maxHeight: 280 }}>
                  <Text style={styles.sheetName}>{selected.name}</Text>
                  {selected.description ? (
                    <Text style={styles.sheetDesc}>{selected.description}</Text>
                  ) : null}
                  <Text style={styles.sheetPrice}>€{selected.price.toFixed(2)}</Text>

                  <Text style={styles.fieldLabel}>Notes for the kitchen (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="e.g. no onions, extra lemon"
                    placeholderTextColor={COLORS.textVariant}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  <View style={styles.qtyRow}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQty((q) => Math.max(1, q - 1))}
                      >
                        <Text style={styles.qtyBtnText}>–</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQty((q) => q + 1)}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.addBtn} onPress={confirmAdd} activeOpacity={0.85}>
                    <Text style={styles.addBtnText}>
                      Add {qty} to cart · €{(selected.price * qty).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  tabsBar: {
    flexGrow: 0,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
    maxHeight: 52,
  },
  tabsContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  tab: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    marginHorizontal: SPACING.xs,
    backgroundColor: COLORS.surfaceVariant,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outline,
    maxWidth: '48%',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: COLORS.surfaceVariant,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  placeholderText: {
    fontSize: 40,
    color: COLORS.primary,
    fontFamily: FONTS.serif,
  },
  cardBody: {
    padding: SPACING.sm,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    minHeight: 38,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textVariant,
    marginTop: 2,
    lineHeight: 16,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textVariant,
    marginTop: SPACING.xl,
  },
  cartBtn: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: 30,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  cartIcon: {
    fontSize: 20,
  },
  cartCount: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
    marginHorizontal: SPACING.xs,
  },
  cartLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '80%',
  },
  sheetImage: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  sheetName: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sheetDesc: {
    fontSize: 14,
    color: COLORS.textVariant,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  sheetPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    minWidth: 24,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  addBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
});

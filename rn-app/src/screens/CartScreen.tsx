import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { createOrder } from '../services/api';
import type { CartItem } from '../types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

const VAT_RATE = 0.10;

export default function CartScreen({ navigation }: Props) {
  const { cart, updateCartQty, removeFromCart, clearCart, qrPayload, guestName, guestPhone, setMyOrderId, billOwnerPhone, isHostSet } = useApp();
  const [submitting, setSubmitting] = useState(false);

  const subtotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  const isHost = isHostSet && billOwnerPhone === guestPhone;

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const productsPayload = cart.map((c: CartItem) => ({
        product_id: c.product.id,
        quantity: c.quantity,
        kitchen_notes: c.kitchenNotes,
      }));
      const order = await createOrder({
        branch_id: qrPayload?.branch_id || '',
        table_id: qrPayload?.table_id,
        products: productsPayload,
        source: 'guest',
        reservation_name: qrPayload?.reservation_name,
        customer_phone: guestPhone,
        customer_name: guestName,
      });
      setMyOrderId(order.id);
      clearCart();
      navigation.replace('OrderStatus', { orderId: order.id, isHost });
    } catch (err: any) {
      Alert.alert(
        'Order failed',
        err?.response?.data?.error || err?.message || 'Could not submit. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {cart.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Menu')}
            >
              <Text style={styles.browseBtnText}>Browse menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cart.map((c: CartItem, index: number) => (
            <View key={c.product.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{c.product.name}</Text>
                {c.kitchenNotes ? (
                  <Text style={styles.itemNotes}>Notes: {c.kitchenNotes}</Text>
                ) : null}
                <Text style={styles.itemPrice}>EGP {c.product.price.toFixed(2)} each</Text>
              </View>
              <View style={styles.itemControls}>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateCartQty(index, c.quantity - 1)}
                  >
                    <Text style={styles.qtyBtnText}>–</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{c.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateCartQty(index, c.quantity + 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>EGP {(c.product.price * c.quantity).toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {cart.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>EGP {subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT (10%)</Text>
            <Text style={styles.summaryValue}>EGP {vat.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>EGP {total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Order</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 280,
  },
  empty: {
    alignItems: 'center',
    marginTop: SPACING.xl * 2,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textVariant,
    marginTop: SPACING.md,
  },
  browseBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  browseBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemNotes: {
    fontSize: 12,
    color: COLORS.textVariant,
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 12,
    color: COLORS.textVariant,
    marginTop: 2,
  },
  itemControls: {
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: SPACING.sm,
    minWidth: 20,
    textAlign: 'center',
  },
  removeText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 70,
    textAlign: 'right',
  },
  summaryCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 15,
    color: COLORS.textVariant,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  totalLabel: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  submitBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
});

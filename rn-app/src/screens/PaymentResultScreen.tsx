import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentResult'>;

export default function PaymentResultScreen({ route, navigation }: Props) {
  const { orderId, success, method } = route.params;
  const isCash = method === 'cash';

  return (
    <View style={[styles.root, { backgroundColor: success ? COLORS.green : COLORS.red }]}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: success ? COLORS.greenBg : COLORS.redBg }]}>
          <Text style={[styles.icon, { color: success ? COLORS.green : COLORS.red }]}>
            {success ? '✓' : '✕'}
          </Text>
        </View>

        <Text style={styles.title}>
          {success ? (isCash ? 'Pay at Counter' : 'Bill Settled') : 'Payment Failed'}
        </Text>

        <Text style={styles.message}>
          {success
            ? isCash
              ? 'Your cash payment has been recorded. Please settle the amount with our staff at the counter. Efharisto!'
              : 'Thank you! Your payment was successful and your bill has been settled. Efharisto!'
            : 'We could not process your payment. No charge was made — please try again or choose another method.'}
        </Text>

        {success ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Bill', { orderId })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>View Bill</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Bill', { orderId })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  icon: { fontSize: 52, fontWeight: '900', lineHeight: 58 },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: COLORS.textVariant,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  secondaryBtn: { marginTop: SPACING.md, paddingVertical: SPACING.sm },
  secondaryBtnText: { color: COLORS.textVariant, fontSize: 15, fontWeight: '600' },
});

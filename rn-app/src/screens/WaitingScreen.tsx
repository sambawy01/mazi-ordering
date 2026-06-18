import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Waiting'>;

export default function WaitingScreen({ navigation, route }: Props) {
  const { isHostSet, billOwnerName, billOwnerPhone, guestName, guestPhone } = useApp();
  const name = route.params?.name ?? guestName ?? billOwnerName;
  const phone = route.params?.phone ?? guestPhone ?? billOwnerPhone;

  // Host (bill owner) skips approval — go straight to client menu
  React.useEffect(() => {
    if (isHostSet && billOwnerPhone === phone) {
      // small delay to render the spinner briefly for UX
      const t = setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: 'ClientMenu' }] });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isHostSet, billOwnerPhone, phone, navigation]);

  const handleContinueAnyway = () => {
    // Fallback for demo/testing — proceed to menu even if not approved yet
    navigation.reset({ index: 0, routes: [{ name: 'ClientMenu' }] });
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.title}>Waiting for host approval</Text>
        <Text style={styles.subtitle}>
          {isHostSet && billOwnerPhone === phone
            ? 'Setting up your table…'
            : 'The bill owner will approve you shortly. Hang tight!'}
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Your details</Text>
          <Text style={styles.infoName}>{name}</Text>
          <Text style={styles.infoPhone}>{phone}</Text>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>

        {/* Hidden testing escape — long-press area */}
        <TouchableOpacity
          style={styles.escRow}
          onLongPress={handleContinueAnyway}
          activeOpacity={1}
        >
          <Text style={styles.escText}>MAZI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textVariant,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  infoPhone: {
    fontSize: 14,
    color: COLORS.textVariant,
    marginTop: 2,
  },
  backBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  escRow: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  escText: {
    fontSize: 11,
    color: COLORS.outline,
    letterSpacing: 2,
  },
});

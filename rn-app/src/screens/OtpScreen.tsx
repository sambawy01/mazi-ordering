import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { verifyPhoneCode, sendPhoneCode } from '../services/api';
import { useApp } from '../services/AppContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const CODE_LENGTH = 4;

export default function OtpScreen({ navigation, route }: Props) {
  const { isHostSet, billOwnerPhone } = useApp();
  const name = route.params?.name ?? '';
  const phone = route.params?.phone ?? '';
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
    // Auto-submit when complete
    if (next.every((d) => d !== '') && digit) {
      submit(next.join(''));
    }
  };

  const handleKey = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const submit = async (value?: string) => {
    const entered = (value ?? code.join('')).trim();
    if (entered.length !== CODE_LENGTH) {
      Alert.alert('Enter the code', `Please enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneCode(phone, entered);
      Keyboard.dismiss();
      // First guest (host) goes straight to the menu; subsequent guests wait for approval
      if (!isHostSet || billOwnerPhone === phone) {
        navigation.reset({ index: 0, routes: [{ name: 'ClientMenu' }] });
      } else {
        navigation.replace('Waiting', { name, phone });
      }
    } catch (err: any) {
      Alert.alert(
        'Verification failed',
        err?.response?.data?.error || 'The code is incorrect or expired. Try again.',
      );
      setCode(Array(CODE_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await sendPhoneCode(phone);
      setCooldown(30);
      Alert.alert('Code sent', `A new code was sent to ${phone}.`);
    } catch (err: any) {
      Alert.alert('Could not resend', err?.response?.data?.error || 'Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Enter the code</Text>
      <Text style={styles.subheading}>
        We sent a 4-digit code to{'\n'}
        <Text style={styles.phone}>{phone}</Text>
      </Text>

      <View style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              refs.current[i] = r;
            }}
            style={[styles.codeInput, code[i] ? styles.codeInputFilled : undefined]}
            value={code[i]}
            onChangeText={(v) => handleChange(i, v)}
            onKeyPress={(e) => handleKey(i, e.nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            textAlign="center"
            editable={!loading}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => submit()}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Confirm</Text>}
      </TouchableOpacity>

      <View style={styles.resendRow}>
        <Text style={styles.resendPrompt}>Didn't get it? </Text>
        {cooldown > 0 ? (
          <Text style={styles.cooldownText}>Resend in {cooldown}s</Text>
        ) : (
          <TouchableOpacity onPress={resend} disabled={resending}>
            {resending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.resendLink}>Resend code</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  heading: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.xl,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.textVariant,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    lineHeight: 21,
  },
  phone: {
    fontWeight: '700',
    color: COLORS.text,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  codeInput: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.md,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xs,
  },
  codeInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  resendPrompt: {
    fontSize: 14,
    color: COLORS.textVariant,
  },
  resendLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  cooldownText: {
    fontSize: 14,
    color: COLORS.textVariant,
  },
});

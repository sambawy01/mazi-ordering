import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { sendPhoneCode } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEntry'>;

const COUNTRY_CODES = [
  { code: '+30', label: '🇬🇷 +30 (GR)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+1', label: '🇺🇸 +1 (US)' },
  { code: '+49', label: '🇩🇪 +49 (DE)' },
  { code: '+33', label: '🇫🇷 +33 (FR)' },
  { code: '+31', label: '🇳🇱 +31 (NL)' },
  { code: '+357', label: '🇨🇾 +357 (CY)' },
];

export default function PhoneEntryScreen({ navigation, route }: Props) {
  const { setBillOwner, isHostSet, guestName, guestPhone } = useApp();
  const [name, setName] = useState(guestName || '');
  const [countryCode, setCountryCode] = useState('+30');
  const [phone, setPhone] = useState(guestPhone.replace(/^\+\d+/, '') || '');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fullPhone = `${countryCode}${phone.replace(/\s/g, '')}`;
  const qrPayloadString = route.params?.qrPayloadString;

  const canSubmit =
    name.trim().length >= 2 && phone.trim().length >= 6 && agreed;

  const handleSend = async () => {
    if (!canSubmit) {
      Alert.alert('Please check', 'Enter your name, a valid phone number, and accept the disclaimer.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneCode(fullPhone);
      // Persist as bill owner if first guest, otherwise as plain guest info
      if (!isHostSet) {
        setBillOwner(name.trim(), fullPhone);
      }
      navigation.navigate('Otp', {
        name: name.trim(),
        phone: fullPhone,
        qrPayloadString,
      });
    } catch (err: any) {
      Alert.alert(
        'Could not send code',
        err?.response?.data?.error || err?.message || 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>
          {isHostSet ? 'Welcome back' : 'Welcome to MAZI'}
        </Text>
        <Text style={styles.subheading}>
          {isHostSet
            ? 'Confirm your details to join the table'
            : 'You\'re the bill owner for this table. Enter your details to start ordering.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maria Papadopoulou"
            placeholderTextColor={COLORS.textVariant}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone number</Text>
          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={styles.countryPicker}
              onPress={() => setPickerOpen((v) => !v)}
            >
              <Text style={styles.countryText}>{countryCode} ▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              placeholder="6941234567"
              placeholderTextColor={COLORS.textVariant}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          {pickerOpen && (
            <View style={styles.picker}>
              {COUNTRY_CODES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={styles.pickerItem}
                  onPress={() => {
                    setCountryCode(c.code);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.disclaimer}>
            I consent to receive a verification SMS and agree to MAZI's terms of service and privacy policy.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Send Verification Code</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: SPACING.lg,
  },
  heading: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.textVariant,
    marginBottom: SPACING.xl,
    lineHeight: 21,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  countryPicker: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
    minWidth: 84,
  },
  countryText: {
    fontSize: 16,
    color: COLORS.text,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  picker: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.outline,
  },
  pickerItemText: {
    fontSize: 15,
    color: COLORS.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: SPACING.sm,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  disclaimer: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textVariant,
    lineHeight: 18,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

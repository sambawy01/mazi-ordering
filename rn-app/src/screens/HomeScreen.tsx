import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { loginStaff } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { setStaffToken, setStaffName } = useApp();
  const [staffMode, setStaffMode] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScan = () => {
    navigation.navigate('Scanner');
  };

  const handleStaffLogin = async () => {
    if (!staffId.trim() || !pin.trim()) {
      Alert.alert('Missing', 'Please enter your App ID and PIN.');
      return;
    }
    setLoading(true);
    try {
      const data = await loginStaff(staffId.trim(), pin.trim());
      if (data?.token) {
        setStaffToken(data.token);
        setStaffName(data?.name || data?.waiter_name || 'Staff');
        navigation.reset({ index: 0, routes: [{ name: 'StaffTables' }] });
      } else {
        Alert.alert('Login failed', 'No token returned. Check credentials.');
      }
    } catch (err: any) {
      Alert.alert(
        'Login failed',
        err?.response?.data?.error || err?.message || 'Could not reach server.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/mazi_logo_clean.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="MAZI logo"
          />
          <Text style={styles.tagline}>Greek mezé · order from your table</Text>
        </View>

        {!staffMode ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleScan} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Scan Table QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStaffMode(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Staff login (ID + PIN)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.staffCard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Text style={styles.staffTitle}>Staff Login</Text>
            <TextInput
              style={styles.input}
              placeholder="App ID"
              placeholderTextColor={COLORS.textVariant}
              value={staffId}
              onChangeText={setStaffId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN"
              placeholderTextColor={COLORS.textVariant}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.primaryBtn, styles.staffLoginBtn]}
              onPress={handleStaffLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStaffMode(false)} activeOpacity={0.7}>
              <Text style={styles.cancelLink}>← Back to guest</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.blueBg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: SPACING.md,
  },
  tagline: {
    fontSize: 18,
    fontFamily: FONTS.serif,
    fontStyle: 'italic',
    color: COLORS.primary,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  staffCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
  },
  staffTitle: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.sm,
  },
  staffLoginBtn: {
    marginBottom: SPACING.sm,
  },
  cancelLink: {
    color: COLORS.textVariant,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

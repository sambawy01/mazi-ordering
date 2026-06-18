import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { useApp } from '../services/AppContext';
import { loginStaff } from '../services/api';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffLogin'>;

export default function StaffLoginScreen({ navigation }: Props) {
  const { setStaffToken, setStaffName } = useApp();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require('../../assets/mazi_logo_clean.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Staff Sign In</Text>
          <Text style={styles.subtitle}>Enter your Foodics waiter credentials</Text>

          <View style={styles.field}>
            <Text style={styles.label}>App ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12345"
              placeholderTextColor={COLORS.textVariant}
              value={staffId}
              onChangeText={setStaffId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="****"
              placeholderTextColor={COLORS.textVariant}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.backText}>Back to guest mode</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.blueBg,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textVariant,
    marginBottom: SPACING.xl,
  },
  field: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
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
  backLink: {
    marginTop: SPACING.lg,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

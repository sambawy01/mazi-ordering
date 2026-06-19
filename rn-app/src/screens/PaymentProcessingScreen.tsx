import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentProcessing'>;

/**
 * Parse the Paymob transaction-result redirect URL.
 * Paymob appends ?success=true|false&txn_response_code=...&id=... when the
 * hosted iframe finishes processing. Returns null while still mid-flow.
 */
function resolveResult(url: string): boolean | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  // Only the post-processing callback carries a `success` flag.
  if (!lower.includes('success=')) return null;
  const match = lower.match(/[?&]success=([^&]+)/);
  if (!match) return null;
  return match[1] === 'true';
}

export default function PaymentProcessingScreen({ route, navigation }: Props) {
  const { orderId, iframeUrl, method } = route.params;
  const [loading, setLoading] = useState(true);
  const handled = useRef(false);

  const finish = (success: boolean) => {
    if (handled.current) return;
    handled.current = true;
    navigation.replace('PaymentResult', { orderId, success, method });
  };

  const onNavChange = (nav: WebViewNavigation) => {
    const result = resolveResult(nav.url);
    if (result !== null) {
      finish(result);
    }
  };

  return (
    <View style={styles.root}>
      <WebView
        source={{ uri: iframeUrl }}
        onNavigationStateChange={onNavChange}
        onLoadEnd={() => setLoading(false)}
        onError={() => finish(false)}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
      {loading && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.overlayText}>Connecting to secure payment…</Text>
        </View>
      )}
      <TouchableOpacity style={styles.cancelBtn} onPress={() => finish(false)} activeOpacity={0.85}>
        <Text style={styles.cancelText}>Cancel payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  webview: { flex: 1, backgroundColor: COLORS.surface },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontFamily: FONTS.serif,
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  cancelText: { color: COLORS.red, fontWeight: '700', fontSize: 15 },
});

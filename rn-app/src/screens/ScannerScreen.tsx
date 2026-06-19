import React, { useState, useEffect, Platform } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS } from '../theme';
import { decodeQRPayload } from '../services/api';
import { useApp } from '../services/AppContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation }: Props) {
  const { setQRPayload } = useApp();

  // Web fallback: manual table code entry
  if (Platform.OS === 'web') {
    return <WebScannerFallback navigation={navigation} setQRPayload={setQRPayload} />;
  }

  // Native: use camera scanner
  return <NativeScanner navigation={navigation} setQRPayload={setQRPayload} />;
}

// --- Web fallback ---
function WebScannerFallback({ navigation, setQRPayload }: any) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      // Simulate scanning a table QR
      const fakePayload = JSON.stringify({ t: 'table-5', r: 'Terrace', b: 'branch-1' });
      const payload = await decodeQRPayload(fakePayload);
      setQRPayload(payload);
      navigation.replace('PhoneEntry', { qrPayloadString: fakePayload });
    } catch {
      // If API fails, use raw payload
      const fakePayload = { table_id: 'table-5', reservation_name: 'Terrace', branch_id: 'branch-1' };
      setQRPayload(fakePayload);
      navigation.replace('PhoneEntry', { qrPayloadString: JSON.stringify(fakePayload) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.webContainer}>
      <View style={styles.webCard}>
        <Text style={styles.webIcon}>📷</Text>
        <Text style={styles.webTitle}>Scan Table QR</Text>
        <Text style={styles.webText}>
          On a phone, this opens the camera to scan the QR code on your table.
          For web demo, click below to simulate scanning Table 5.
        </Text>
        <TouchableOpacity style={styles.webButton} onPress={handleSimulate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.webButtonText}>Simulate Scan · Table 5</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.webBack}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Native scanner ---
function NativeScanner({ navigation, setQRPayload }: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [decoding, setDecoding] = useState(false);

  useEffect(() => {
    (async () => {
      const { BarCodeScanner } = await import('expo-barcode-scanner');
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setDecoding(true);
    try {
      const payload = await decodeQRPayload(data);
      setQRPayload(payload);
      navigation.replace('PhoneEntry', { qrPayloadString: data });
    } catch (err: any) {
      Alert.alert(
        'Invalid QR',
        'This QR code could not be read. Make sure it is a MAZI table code.',
        [{ text: 'Try again', onPress: () => setScanned(false) }],
      );
    } finally {
      setDecoding(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.white} />
        <Text style={styles.info}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Camera permission was denied.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <DynamicBarCodeScanner scanned={scanned} onScanned={handleBarCodeScanned} />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
      </View>
      {decoding && (
        <View style={styles.decoding}>
          <ActivityIndicator color={COLORS.white} />
          <Text style={styles.decodingText}>Reading table…</Text>
        </View>
      )}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        {scanned && !decoding && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>Scan again</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Point the camera at the QR code on your table</Text>
    </View>
  );
}

// Dynamically import BarCodeScanner only on native
function DynamicBarCodeScanner({ scanned, onScanned }: { scanned: boolean; onScanned: (data: any) => void }) {
  const [Scanner, setScanner] = useState<any>(null);

  useEffect(() => {
    import('expo-barcode-scanner').then((mod) => {
      setScanner(() => mod.BarCodeScanner);
    });
  }, []);

  if (!Scanner) return null;

  return (
    <Scanner
      onBarCodeScanned={scanned ? undefined : onScanned}
      barCodeTypes={[Scanner.Constants.BarCodeType.qr]}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  webContainer: {
    flex: 1, backgroundColor: COLORS.blueBg,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  webCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', maxWidth: 400, width: '100%',
  },
  webIcon: { fontSize: 64, marginBottom: SPACING.md },
  webTitle: { fontSize: 24, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm },
  webText: { fontSize: 14, color: COLORS.textVariant, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.lg },
  webButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16,
    paddingHorizontal: 32, marginBottom: SPACING.md, width: '100%', alignItems: 'center',
  },
  webButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  webBack: { color: COLORS.primary, fontSize: 14, marginTop: SPACING.sm },
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  info: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderWidth: 3,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    backgroundColor: 'transparent',
  },
  decoding: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -40 }],
    alignItems: 'center',
  },
  decodingText: {
    color: COLORS.white,
    marginTop: SPACING.sm,
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  cancelBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  cancelText: {
    color: COLORS.white,
    fontSize: 16,
  },
  rescanBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
  },
  rescanText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.gold,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.85,
  },
});

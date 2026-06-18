import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS } from '../theme';
import { decodeQRPayload } from '../services/api';
import { useApp } from '../services/AppContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const { setQRPayload } = useApp();

  useEffect(() => {
    (async () => {
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
      // First guest becomes the bill owner → goes to phone entry
      navigation.replace('PhoneEntry', { qrPayloadString: data });
    } catch (err: any) {
      Alert.alert(
        'Invalid QR',
        'This QR code could not be read. Make sure it is a MAZI table code.',
        [
          {
            text: 'Try again',
            onPress: () => setScanned(false),
          },
        ],
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
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
        style={StyleSheet.absoluteFillObject}
      />
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

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
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

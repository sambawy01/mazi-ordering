import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'dart:convert';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'client_menu_screen.dart';

/// Client QR scan screen: customer scans the QR code on their table.
class ClientScanScreen extends ConsumerStatefulWidget {
  const ClientScanScreen({super.key});

  @override
  ConsumerState<ClientScanScreen> createState() => _ClientScanScreenState();
}

class _ClientScanScreenState extends ConsumerState<ClientScanScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  bool _navigated = false;
  bool _error = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_navigated) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final raw = barcodes.first.rawValue;
    if (raw == null) return;

    // Try to parse as JSON (our QR format: {"t":"...","r":"...","b":"..."})
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final payload = QRPayload.fromJson(json);
      
      if (payload.tableId.isEmpty || payload.branchId.isEmpty) {
        setState(() => _error = true);
        return;
      }

      _navigated = true;
      ref.read(qrPayloadProvider.notifier).state = payload;
      
      // Stop scanner before navigating
      _scannerController.stop();
      
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ClientMenuScreen()),
      );
    } catch (e) {
      // Try decoding via backend API
      _decodeViaBackend(raw);
    }
  }

  Future<void> _decodeViaBackend(String payload) async {
    if (_navigated) return;
    try {
      final api = ref.read(apiClientProvider);
      final decoded = await api.decodeQRCode(payload);
      _navigated = true;
      ref.read(qrPayloadProvider.notifier).state = decoded;
      _scannerController.stop();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ClientMenuScreen()),
        );
      }
    } catch (e) {
      setState(() => _error = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Table QR')),
      body: Stack(
        children: [
          // Camera scanner
          MobileScanner(
            controller: _scannerController,
            onDetect: _onDetect,
          ),

          // Overlay with scan frame
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),

          // Instructions
          Positioned(
            bottom: 100,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _error
                        ? 'Invalid QR code. Please scan the QR on your table.'
                        : 'Point the camera at the QR code on your table',
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                ),
                if (_error)
                  const SizedBox(height: 12),
                if (_error)
                  TextButton(
                    onPressed: () => setState(() => _error = false),
                    child: const Text('Try Again', style: TextStyle(color: Colors.white)),
                  ),
              ],
            ),
          ),

          // Flashlight toggle
          Positioned(
            top: 16,
            right: 16,
            child: IconButton(
              icon: const Icon(Icons.flash_on, color: Colors.white),
              onPressed: () => _scannerController.toggleTorch(),
            ),
          ),
        ],
      ),
    );
  }
}
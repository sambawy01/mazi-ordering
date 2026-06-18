import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import 'waiter_login_screen.dart';
import 'client_scan_screen.dart';

/// Home screen: choose between waiter mode and client mode.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo / Title
              Icon(
                Icons.restaurant_menu,
                size: 80,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                'Foodics Ordering',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose your mode',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 48),

              // Waiter button
              SizedBox(
                width: double.infinity,
                height: 64,
                child: FilledButton.icon(
                  onPressed: () {
                    ref.read(appModeProvider.notifier).state = AppMode.waiter;
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const WaiterLoginScreen()),
                    );
                  },
                  icon: const Icon(Icons.badge, size: 28),
                  label: const Text('Waiter', style: TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(height: 16),

              // Client button
              SizedBox(
                width: double.infinity,
                height: 64,
                child: OutlinedButton.icon(
                  onPressed: () {
                    ref.read(appModeProvider.notifier).state = AppMode.client;
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ClientScanScreen()),
                    );
                  },
                  icon: const Icon(Icons.qr_code_scanner, size: 28),
                  label: const Text('Customer', style: TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(height: 32),

              Text(
                'Scan the QR code on your table to start ordering',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[500],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
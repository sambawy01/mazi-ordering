import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'menu_screen.dart';
import 'order_status_screen.dart';

/// Client menu screen: shown after scanning QR.
/// Shows reservation info + menu browse + cart.
class ClientMenuScreen extends ConsumerWidget {
  const ClientMenuScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qrPayload = ref.watch(qrPayloadProvider);

    if (qrPayload == null) {
      return const Scaffold(body: Center(child: Text('No table selected')));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Table ${qrPayload.tableId}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const OrderStatusScreen()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Reservation banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Row(
              children: [
                const Icon(Icons.event_seat, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Reservation: ${qrPayload.reservationName}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      Text('Table ID: ${qrPayload.tableId}'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Quick actions
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const MenuScreen(mode: 'client'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.restaurant_menu),
                    label: const Text('Browse Menu'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      // Call waiter via WebSocket
                      final ws = ref.read(webSocketServiceProvider);
                      ws.callWaiter(qrPayload.tableId);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Waiter has been called')),
                      );
                    },
                    icon: const Icon(Icons.handshake),
                    label: const Text('Call Waiter'),
                  ),
                ),
              ],
            ),
          ),

          // Menu preview
          const Expanded(child: _MenuPreview()),
        ],
      ),
    );
  }
}

class _MenuPreview extends ConsumerWidget {
  const _MenuPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(menuProvider);
    return menuAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
            const SizedBox(height: 16),
            Text('Cannot load menu\n$err', textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => ref.invalidate(menuProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (menu) {
        // Show featured/popular products (first 6)
        final featured = menu.products.take(6).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Popular Items',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 200,
                  childAspectRatio: 0.75,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: featured.length,
                itemBuilder: (context, index) {
                  final p = featured[index];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const MenuScreen(mode: 'client'),
                          ),
                        );
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: p.image != null
                                ? Image.network(p.image!, fit: BoxFit.cover, width: double.infinity)
                                : Container(color: Colors.grey[200], child: const Icon(Icons.fastfood)),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 2),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
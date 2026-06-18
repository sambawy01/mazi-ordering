import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'menu_screen.dart';

/// Waiter table detail: shows table info, current orders, and actions.
class WaiterTableDetailScreen extends ConsumerStatefulWidget {
  final TableModel table;

  const WaiterTableDetailScreen({required this.table, super.key});

  @override
  ConsumerState<WaiterTableDetailScreen> createState() => _WaiterTableDetailScreenState();
}

class _WaiterTableDetailScreenState extends ConsumerState<WaiterTableDetailScreen> {
  bool _creatingOrder = false;

  Future<void> _createOrder() async {
    setState(() => _creatingOrder = true);
    try {
      final api = ref.read(apiClientProvider);
      final order = await api.createOrder(
        branchId: widget.table.sectionId ?? '',
        tableId: widget.table.id,
        type: 1, // dine-in
        guests: widget.table.seats > 0 ? widget.table.seats : 1,
        source: 'waiter',
      );
      ref.read(currentOrderProvider.notifier).state = order;
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => MenuScreen(order: order, mode: 'waiter')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create order: $e')),
        );
      }
    } finally {
      setState(() => _creatingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.table;
    final color = Color(t.statusColor);

    return Scaffold(
      appBar: AppBar(title: Text(t.name)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Table status card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Icon(Icons.table_restaurant, color: color, size: 48),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text(t.statusLabel, style: TextStyle(color: color, fontSize: 16)),
                          if (t.sectionName != null)
                            Text('Section: ${t.sectionName}', style: TextStyle(color: Colors.grey[600])),
                          Text('Seats: ${t.seats}', style: TextStyle(color: Colors.grey[600])),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Actions
            if (t.status == TableStatus.free || t.status == TableStatus.unknown)
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton.icon(
                  onPressed: _creatingOrder ? null : _createOrder,
                  icon: _creatingOrder
                      ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.add_shopping_cart),
                  label: const Text('Create New Order', style: TextStyle(fontSize: 18)),
                ),
              )
            else ...[
              // Table is occupied — show order actions
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton.icon(
                  onPressed: () {
                    // View current order — would fetch from API
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Loading current order...')),
                    );
                  },
                  icon: const Icon(Icons.receipt_long),
                  label: const Text('View Current Order', style: TextStyle(fontSize: 18)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton.icon(
                  onPressed: () {
                    // Add items to existing order
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => MenuScreen(order: null, mode: 'waiter', tableId: t.id)),
                    );
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add Items', style: TextStyle(fontSize: 18)),
                ),
              ),
            ],

            const SizedBox(height: 32),

            // Reservation info
            if (t.acceptsReservations) ...[
              Text('Reservations', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.event_available),
                  title: const Text('Accepts reservations'),
                  subtitle: Text(t.status == TableStatus.reserved ? 'Currently reserved' : 'Available for reservation'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
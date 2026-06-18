import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';

/// Order status screen: shows real-time order status via WebSocket.
class OrderStatusScreen extends ConsumerStatefulWidget {
  final Order? order;

  const OrderStatusScreen({this.order, super.key});

  @override
  ConsumerState<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends ConsumerState<OrderStatusScreen> {
  Order? _order;
  String _lastEvent = '';

  @override
  void initState() {
    super.initState();
    _order = widget.order ?? ref.read(currentOrderProvider);

    // Connect WebSocket for real-time updates
    final ws = ref.read(webSocketServiceProvider);
    final qrPayload = ref.read(qrPayloadProvider);
    
    ws.onMessage = (event, data) {
      setState(() {
        _lastEvent = event;
        if (data['order_id'] == _order?.id || event == 'order:status' || event == 'order:updated') {
          // Update order status from webhook data
          if (data['data'] != null) {
            try {
              _order = Order.fromJson({...?data['data'], 'id': data['order_id'] ?? _order?.id});
            } catch (_) {}
          }
        }
      });
    };

    if (!ws.isConnected && qrPayload != null) {
      ws.connect(role: 'client', tableId: qrPayload.tableId);
    } else if (!ws.isConnected) {
      ws.connect(role: 'waiter');
    }
  }

  @override
  void dispose() {
    // Don't disconnect WS — it may be used by other screens
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final qrPayload = ref.watch(qrPayloadProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Order Status')),
      body: _order == null
          ? const Center(child: Text('No active order'))
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Order info card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.receipt_long, size: 32),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Order #${_order!.id.substring(0, 8)}',
                                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                                    if (qrPayload != null)
                                      Text('Table: ${qrPayload.tableId} • Reservation: ${qrPayload.reservationName}',
                                          style: TextStyle(color: Colors.grey[600])),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          _StatusBadge(status: _order!.status),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Status timeline
                  Text('Progress', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  _StatusTimeline(currentStatus: _order!.status ?? 1),

                  const SizedBox(height: 24),

                  // Order items
                  if (_order!.products != null && _order!.products!.isNotEmpty) ...[
                    Text('Items', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...(_order!.products!.map((p) => ListTile(
                      leading: const Icon(Icons.fastfood),
                      title: Text(p.name ?? 'Unknown item'),
                      subtitle: Text('Qty: ${p.quantity} • ${(p.totalPrice ?? 0).toStringAsFixed(2)} SAR'),
                    ))),
                  ],

                  const Spacer(),

                  // Actions
                  if (qrPayload != null)
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          final ws = ref.read(webSocketServiceProvider);
                          ws.requestCheck(qrPayload.tableId, _order?.id ?? '');
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Check requested from waiter')),
                          );
                        },
                        icon: const Icon(Icons.receipt),
                        label: const Text('Request Check', style: TextStyle(fontSize: 18)),
                      ),
                    ),

                  if (_lastEvent.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text('Last update: $_lastEvent', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                    ),
                ],
              ),
            ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final int? status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final label = _statusLabel(status);
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color),
      ),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
    );
  }

  String _statusLabel(int? s) => switch (s) {
    1 => 'Open',
    2 => 'Sent to Kitchen',
    3 => 'Preparing',
    4 => 'Ready',
    5 => 'Served',
    6 => 'Closed',
    7 => 'Cancelled',
    _ => 'Unknown',
  };

  Color _statusColor(int? s) => switch (s) {
    1 => Colors.blue,
    2 => Colors.orange,
    3 => Colors.orange,
    4 => Colors.green,
    5 => Colors.teal,
    6 => Colors.grey,
    7 => Colors.red,
    _ => Colors.grey,
  };
}

class _StatusTimeline extends StatelessWidget {
  final int currentStatus;

  const _StatusTimeline({required this.currentStatus});

  @override
  Widget build(BuildContext context) {
    final steps = [
      (1, 'Order Placed', Icons.shopping_cart),
      (2, 'Sent to Kitchen', Icons.send),
      (3, 'Preparing', Icons.local_fire_department),
      (4, 'Ready', Icons.check_circle),
      (5, 'Served', Icons.restaurant),
    ];

    return Column(
      children: steps.map((step) {
        final isDone = currentStatus >= step.$1;
        final isCurrent = currentStatus == step.$1;
        final color = isDone ? (isCurrent ? Colors.orange : Colors.green) : Colors.grey[300];

        return Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(step.$3, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 12),
            Text(
              step.$2,
              style: TextStyle(
                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                color: isDone ? Colors.black : Colors.grey,
              ),
            ),
          ],
        );
      }).toList(),
    );
  }
}
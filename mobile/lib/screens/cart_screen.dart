import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'order_status_screen.dart';

class CartScreen extends ConsumerWidget {
  final Order? order;
  final String mode;
  final String? tableId;

  const CartScreen({
    this.order,
    required this.mode,
    this.tableId,
    super.key,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final cartNotifier = ref.read(cartProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cart'),
        actions: [
          if (cart.isNotEmpty)
            TextButton(
              onPressed: () => cartNotifier.clear(),
              child: const Text('Clear'),
            ),
        ],
      ),
      body: cart.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('Your cart is empty'),
                  SizedBox(height: 8),
                  Text('Browse the menu to add items', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: cart.length,
                    itemBuilder: (context, index) {
                      final item = cart[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              // Product image
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: item.product.image != null
                                    ? Image.network(item.product.image!, width: 56, height: 56, fit: BoxFit.cover)
                                    : Container(width: 56, height: 56, color: Colors.grey[200], child: const Icon(Icons.fastfood)),
                              ),
                              const SizedBox(width: 12),
                              // Info
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                                    if (item.product.price != null)
                                      Text('${item.product.price!.toStringAsFixed(2)} SAR each',
                                          style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                    if (item.kitchenNotes != null)
                                      Text('Note: ${item.kitchenNotes}', style: TextStyle(color: Colors.orange[700], fontSize: 12)),
                                  ],
                                ),
                              ),
                              // Quantity controls
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => cartNotifier.updateQuantity(index, item.quantity - 1),
                                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                                  ),
                                  Text('${item.quantity}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                  IconButton(
                                    onPressed: () => cartNotifier.updateQuantity(index, item.quantity + 1),
                                    icon: const Icon(Icons.add_circle_outline, size: 20),
                                  ),
                                ],
                              ),
                              // Total
                              SizedBox(
                                width: 70,
                                child: Text(
                                  '${item.totalPrice.toStringAsFixed(2)} SAR',
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                // Total bar
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -2)),
                    ],
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text('${cartNotifier.total.toStringAsFixed(2)} SAR',
                                style: TextStyle(fontSize: 20, color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: FilledButton.icon(
                            onPressed: () => _submitOrder(context, ref),
                            icon: const Icon(Icons.send),
                            label: Text(
                              order != null ? 'Add to Order' : 'Submit Order',
                              style: const TextStyle(fontSize: 18),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Future<void> _submitOrder(BuildContext context, WidgetRef ref) async {
    final cart = ref.read(cartProvider);
    final cartNotifier = ref.read(cartProvider.notifier);
    final api = ref.read(apiClientProvider);
    final qrPayload = ref.read(qrPayloadProvider);

    try {
      Order order;
      if (this.order != null) {
        // Add products to existing order
        order = await api.addProductsToOrder(this.order!.id, cart);
      } else {
        // Create new order
        order = await api.createOrder(
          branchId: qrPayload?.branchId ?? '',
          tableId: qrPayload?.tableId ?? tableId,
          type: 1, // dine-in
          cartItems: cart,
          source: mode == 'client' ? 'client_qr' : 'waiter',
          reservationName: qrPayload?.reservationName,
        );
      }

      cartNotifier.clear();

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Order submitted! The waiter will review it.'), duration: Duration(seconds: 2)),
        );
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => OrderStatusScreen(order: order)),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: $e')),
        );
      }
    }
  }
}
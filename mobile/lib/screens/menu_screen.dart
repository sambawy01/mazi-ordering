import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'cart_screen.dart';

/// Menu browsing screen — shared by waiter and client modes.
/// Shows categories as tabs and products as cards.
class MenuScreen extends ConsumerStatefulWidget {
  final Order? order;        // existing order (if adding items)
  final String mode;         // 'waiter' or 'client'
  final String? tableId;     // for waiter adding to table

  const MenuScreen({
    this.order,
    required this.mode,
    this.tableId,
    super.key,
  });

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  String? _selectedCategory;

  @override
  Widget build(BuildContext context) {
    final menuAsync = ref.watch(menuProvider);
    final cart = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.order != null ? 'Add to Order' : 'Menu'),
        actions: [
          // Cart button with badge
          if (cart.itemCount > 0)
            Badge(
              label: Text('${cart.itemCount}'),
              child: IconButton(
                icon: const Icon(Icons.shopping_cart),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => CartScreen(
                        order: widget.order,
                        mode: widget.mode,
                        tableId: widget.tableId,
                      ),
                    ),
                  );
                },
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.shopping_cart),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CartScreen(
                      order: widget.order,
                      mode: widget.mode,
                      tableId: widget.tableId,
                    ),
                  ),
                );
              },
            ),
        ],
        bottom: menuAsync.whenOrNull(
          data: (menu) {
            if (menu.categories.isEmpty) return null;
            return TabBar(
              isScrollable: true,
              tabs: [
                const Tab(text: 'All'),
                ...menu.categories.map((c) => Tab(text: c.name)),
              ],
              onTap: (index) {
                setState(() {
                  _selectedCategory = index == 0 ? null : menu.categories[index - 1].id;
                });
              },
            );
          },
        ),
      ),
      body: menuAsync.when(
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
          final products = _selectedCategory == null
              ? menu.products
              : menu.products.where((p) => p.categoryId == _selectedCategory).toList();

          if (products.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.restaurant_menu, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No products available'),
                ],
              ),
            );
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 200,
              childAspectRatio: 0.75,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final product = products[index];
              return _ProductCard(
                product: product,
                onTap: () => _showProductDetail(product),
              );
            },
          );
        },
      ),
    );
  }

  void _showProductDetail(Product product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ProductDetailSheet(product: product),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;

  const _ProductCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product image
            Expanded(
              child: product.image != null
                  ? Image.network(
                      product.image!,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      errorBuilder: (_, __, ___) => Container(
                        color: Colors.grey[200],
                        child: const Icon(Icons.fastfood, size: 48, color: Colors.grey),
                      ),
                    )
                  : Container(
                      color: Colors.grey[200],
                      child: const Center(child: Icon(Icons.fastfood, size: 48, color: Colors.grey)),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  if (product.price != null)
                    Text(
                      '${product.price!.toStringAsFixed(2)} SAR',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductDetailSheet extends ConsumerStatefulWidget {
  final Product product;

  const _ProductDetailSheet({required this.product});

  @override
  ConsumerState<_ProductDetailSheet> createState() => _ProductDetailSheetState();
}

class _ProductDetailSheetState extends ConsumerState<_ProductDetailSheet> {
  int _quantity = 1;
  String? _kitchenNotes;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product image
              if (widget.product.image != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    widget.product.image!,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 200,
                      color: Colors.grey[200],
                      child: const Icon(Icons.fastfood, size: 64),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              
              // Name + price
              Text(
                widget.product.name,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              if (widget.product.price != null)
                Text(
                  '${widget.product.price!.toStringAsFixed(2)} SAR',
                  style: TextStyle(
                    fontSize: 20,
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              
              if (widget.product.description != null) ...[
                const SizedBox(height: 12),
                Text(widget.product.description!, style: TextStyle(color: Colors.grey[700])),
              ],

              if (widget.product.calories != null) ...[
                const SizedBox(height: 8),
                Text('${widget.product.calories} calories', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
              ],

              const SizedBox(height: 24),

              // Quantity selector
              const Text('Quantity', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              Row(
                children: [
                  IconButton(
                    onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('$_quantity', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  IconButton(
                    onPressed: () => setState(() => _quantity++),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Kitchen notes
              TextField(
                decoration: const InputDecoration(
                  labelText: 'Special notes (optional)',
                  hintText: 'e.g. no onions, extra spicy...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
                onChanged: (v) => _kitchenNotes = v.isEmpty ? null : v,
              ),

              const SizedBox(height: 24),

              // Add to cart button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton.icon(
                  onPressed: () {
                    ref.read(cartProvider.notifier).addItem(
                      widget.product,
                      quantity: _quantity,
                    );
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${widget.product.name} added to cart'),
                        duration: const Duration(seconds: 1),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add_shopping_cart),
                  label: const Text('Add to Cart', style: TextStyle(fontSize: 18)),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
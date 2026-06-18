import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import '../services/api_client.dart';

// --- Providers ---

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

// App mode: waiter or client
enum AppMode { waiter, client }

final appModeProvider = StateProvider<AppMode>((ref) => AppMode.waiter);

// Waiter auth state
final waiterAuthProvider = StateProvider<WaiterUser?>((ref) => null);

// Menu data
final menuProvider = FutureProvider<({List<Product> products, List<Category> categories})>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.getMenu();
});

// Tables
final tablesProvider = FutureProvider<List<TableModel>>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.getTables();
});

// Products by category
final productsByCategoryProvider = Provider.family<List<Product>, String?>((ref, categoryId) {
  final menuAsync = ref.watch(menuProvider);
  return menuAsync.maybeWhen(
    data: (menu) {
      if (categoryId == null) return menu.products;
      return menu.products.where((p) => p.categoryId == categoryId).toList();
    },
    orElse: () => [],
  );
});

// Cart state
final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>((ref) {
  return CartNotifier();
});

class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super([]);

  void addItem(Product product, {int quantity = 1, List<ModifierOption> options = const []}) {
    // Check if already in cart (same product + same options)
    final existingIndex = state.indexWhere((item) =>
      item.product.id == product.id &&
      _sameOptions(item.selectedOptions, options)
    );
    
    if (existingIndex >= 0) {
      state[existingIndex].quantity += quantity;
      state = [...state];
    } else {
      state = [...state, CartItem(product: product, quantity: quantity, selectedOptions: options)];
    }
  }

  void removeItem(int index) {
    state = [...state]..removeAt(index);
  }

  void updateQuantity(int index, int quantity) {
    if (quantity <= 0) {
      removeItem(index);
    } else {
      state[index].quantity = quantity;
      state = [...state];
    }
  }

  void clear() {
    state = [];
  }

  double get total => state.fold<double>(0, (sum, item) => sum + item.totalPrice);

  int get itemCount => state.fold<int>(0, (sum, item) => sum + item.quantity);

  bool _sameOptions(List<ModifierOption> a, List<ModifierOption> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id) return false;
    }
    return true;
  }
}

// Current order being viewed (client)
final currentOrderProvider = StateProvider<Order?>((ref) => null);

// QR payload from scan (client)
final qrPayloadProvider = StateProvider<QRPayload?>((ref) => null);
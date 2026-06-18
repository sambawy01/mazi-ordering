import 'package:dio/dio.dart';
import '../models/models.dart';

/// API client for communicating with the Foodics ordering backend.
class ApiClient {
  static const String baseUrl = 'http://localhost:3000/api';
  
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    // Auth interceptor — attach JWT if available
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = authToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  // In-memory token (persisted via SharedPreferences in a full app)
  static String? authToken;

  void setToken(String token) {
    authToken = token;
  }

  void clearToken() {
    authToken = null;
  }

  // --- Auth ---

  Future<Map<String, dynamic>> loginWaiter(String appId, String pin) async {
    final res = await _dio.post('/auth/waiter', data: {
      'app_id': appId,
      'pin': pin,
    });
    final data = res.data as Map<String, dynamic>;
    setToken(data['token'] as String);
    return data;
  }

  Future<void> logout() async {
    try { await _dio.post('/auth/logout'); } catch (_) {}
    clearToken();
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get('/auth/me');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getAuthStatus() async {
    final res = await _dio.get('/auth/status');
    return res.data as Map<String, dynamic>;
  }

  // --- Menu ---

  Future<List<Product>> getProducts() async {
    final res = await _dio.get('/menu/products');
    final list = (res.data['products'] as List).cast<Map<String, dynamic>>();
    return list.map(Product.fromJson).toList();
  }

  Future<List<Category>> getCategories() async {
    final res = await _dio.get('/menu/categories');
    final list = (res.data['categories'] as List).cast<Map<String, dynamic>>();
    return list.map(Category.fromJson).toList();
  }

  Future<({List<Product> products, List<Category> categories})> getMenu() async {
    final res = await _dio.get('/menu');
    final products = (res.data['products'] as List)
        .cast<Map<String, dynamic>>()
        .map(Product.fromJson)
        .toList();
    final categories = (res.data['categories'] as List)
        .cast<Map<String, dynamic>>()
        .map(Category.fromJson)
        .toList();
    return (products: products, categories: categories);
  }

  // --- Tables ---

  Future<List<TableModel>> getTables() async {
    final res = await _dio.get('/tables');
    final list = (res.data['tables'] as List).cast<Map<String, dynamic>>();
    return list.map(TableModel.fromJson).toList();
  }

  Future<TableModel> getTable(String id) async {
    final res = await _dio.get('/tables/$id');
    return TableModel.fromJson(res.data['table'] as Map<String, dynamic>);
  }

  // --- Orders ---

  Future<Order> createOrder({
    required String branchId,
    String? tableId,
    int type = 1, // 1 = dine-in
    int guests = 1,
    List<CartItem> cartItems = const [],
    String? reservationName,
    String source = 'waiter',
    String? kitchenNotes,
  }) async {
    final products = cartItems.map((c) => c.toOrderJson()).toList();
    final res = await _dio.post('/orders', data: {
      'type': type,
      'branch_id': branchId,
      if (tableId != null) 'table_id': tableId,
      'guests': guests,
      'products': products,
      'source': source,
      if (reservationName != null) 'reservation_name': reservationName,
      if (kitchenNotes != null) 'kitchen_notes': kitchenNotes,
    });
    return Order.fromJson(res.data['order'] as Map<String, dynamic>);
  }

  Future<Order> getOrder(String id) async {
    final res = await _dio.get('/orders/$id');
    return Order.fromJson(res.data['order'] as Map<String, dynamic>);
  }

  Future<List<Order>> listOrders({String? branchId}) async {
    final res = await _dio.get('/orders', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
    });
    final list = (res.data['orders'] as List).cast<Map<String, dynamic>>();
    return list.map(Order.fromJson).toList();
  }

  Future<Order> updateOrder(String id, Map<String, dynamic> data) async {
    final res = await _dio.put('/orders/$id', data: data);
    return Order.fromJson(res.data['order'] as Map<String, dynamic>);
  }

  Future<Order> addProductsToOrder(String orderId, List<CartItem> items) async {
    final products = items.map((c) => c.toOrderJson()).toList();
    final res = await _dio.post('/orders/$orderId/products', data: {
      'products': products,
    });
    return Order.fromJson(res.data['order'] as Map<String, dynamic>);
  }

  // --- QR Code ---

  Future<Map<String, dynamic>> generateQRCode({
    required String tableId,
    required String reservationName,
    String? branchId,
  }) async {
    final res = await _dio.post('/qrcode/generate', data: {
      'table_id': tableId,
      'reservation_name': reservationName,
      if (branchId != null) 'branch_id': branchId,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<QRPayload> decodeQRCode(String payload) async {
    final res = await _dio.post('/qrcode/decode', data: {'payload': payload});
    return QRPayload.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<Map<String, dynamic>>> listQRCodes() async {
    final res = await _dio.get('/qrcode/list');
    return (res.data['codes'] as List).cast<Map<String, dynamic>>();
  }
}
// Foodics data models

class Product {
  final String id;
  final String name;
  final String? nameLocalized;
  final String? description;
  final String? image;
  final double? price;
  final int? calories;
  final int preparationTime;
  final bool isActive;
  final String? categoryId;
  final String? categoryName;
  final String? sku;
  final String? barcode;

  Product({
    required this.id,
    required this.name,
    this.nameLocalized,
    this.description,
    this.image,
    this.price,
    this.calories,
    this.preparationTime = 0,
    this.isActive = true,
    this.categoryId,
    this.categoryName,
    this.sku,
    this.barcode,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      nameLocalized: json['name_localized'],
      description: json['description'],
      image: json['image'],
      price: (json['price'] as num?)?.toDouble(),
      calories: json['calories'],
      preparationTime: json['preparation_time'] ?? 0,
      isActive: json['is_active'] ?? true,
      categoryId: json['category']?['id'],
      categoryName: json['category']?['name'],
      sku: json['sku'],
      barcode: json['barcode'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'price': price,
    'image': image,
    'description': description,
  };
}

class Category {
  final String id;
  final String name;
  final String? nameLocalized;
  final String? reference;

  Category({
    required this.id,
    required this.name,
    this.nameLocalized,
    this.reference,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      nameLocalized: json['name_localized'],
      reference: json['reference'],
    );
  }
}

enum TableStatus {
  free,       // 1
  occupied,    // 2
  checkPrinted, // 3
  reserved,    // 4
  unknown,
}

class TableModel {
  final String id;
  final String name;
  final TableStatus status;
  final int seats;
  final String? sectionId;
  final String? sectionName;
  final bool acceptsReservations;

  TableModel({
    required this.id,
    required this.name,
    required this.status,
    required this.seats,
    this.sectionId,
    this.sectionName,
    this.acceptsReservations = false,
  });

  factory TableModel.fromJson(Map<String, dynamic> json) {
    final statusInt = json['status'] as int?;
    TableStatus status;
    switch (statusInt) {
      case 1: status = TableStatus.free; break;
      case 2: status = TableStatus.occupied; break;
      case 3: status = TableStatus.checkPrinted; break;
      case 4: status = TableStatus.reserved; break;
      default: status = TableStatus.unknown;
    }
    return TableModel(
      id: json['id'] ?? json['table_id'] ?? '',
      name: json['name'] ?? '',
      status: status,
      seats: json['seats'] ?? 0,
      sectionId: json['section']?['id'] ?? json['section_id'],
      sectionName: json['section']?['name'] ?? json['section_name'],
      acceptsReservations: json['accepts_reservations'] ?? false,
    );
  }

  String get statusLabel {
    switch (status) {
      case TableStatus.free: return 'Free';
      case TableStatus.occupied: return 'Occupied';
      case TableStatus.checkPrinted: return 'Check Printed';
      case TableStatus.reserved: return 'Reserved';
      case TableStatus.unknown: return 'Unknown';
    }
  }

  int get statusColor => switch (status) {
    TableStatus.free => 0xFF4CAF50,       // green
    TableStatus.occupied => 0xFFF44336,   // red
    TableStatus.checkPrinted => 0xFFFF9800, // orange
    TableStatus.reserved => 0xFF2196F3,   // blue
    TableStatus.unknown => 0xFF9E9E9E,    // grey
  };
}

class CartItem {
  final Product product;
  int quantity;
  final List<ModifierOption> selectedOptions;
  String? kitchenNotes;

  CartItem({
    required this.product,
    this.quantity = 1,
    this.selectedOptions = const [],
    this.kitchenNotes,
  });

  double get totalPrice {
    final productPrice = product.price ?? 0;
    final optionsPrice = selectedOptions.fold<double>(0, (sum, o) => sum + (o.price * o.quantity));
    return (productPrice + optionsPrice) * quantity;
  }

  Map<String, dynamic> toOrderJson() {
    return {
      'product_id': product.id,
      'quantity': quantity,
      'unit_price': product.price,
      'total_price': totalPrice,
      'options': selectedOptions.map((o) => o.toJson()).toList(),
      if (kitchenNotes != null) 'kitchen_notes': kitchenNotes,
    };
  }
}

class ModifierOption {
  final String id;
  final String name;
  final double price;
  int quantity;

  ModifierOption({
    required this.id,
    required this.name,
    this.price = 0,
    this.quantity = 1,
  });

  Map<String, dynamic> toJson() => {
    'modifier_option_id': id,
    'quantity': quantity,
    'unit_price': price,
    'total_price': price * quantity,
  };
}

class Order {
  final String id;
  final String? tableId;
  final String? tableName;
  final String? branchId;
  final int? status;
  final double? total;
  final String? source;
  final String? reservationName;
  final List<OrderProduct>? products;
  final String? createdAt;

  Order({
    required this.id,
    this.tableId,
    this.tableName,
    this.branchId,
    this.status,
    this.total,
    this.source,
    this.reservationName,
    this.products,
    this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] ?? '',
      tableId: json['table_id'] ?? json['table']?['id'],
      tableName: json['table_name'] ?? json['table']?['name'],
      branchId: json['branch_id'] ?? json['branch']?['id'],
      status: json['status'],
      total: (json['total'] as num?)?.toDouble(),
      source: json['source'],
      reservationName: json['reservation_name'] ?? json['meta']?['reservation_name'],
      products: (json['products'] as List?)?.map((p) => OrderProduct.fromJson(p)).toList(),
      createdAt: json['created_at'],
    );
  }

  String get statusLabel {
    switch (status) {
      case 1: return 'Open';
      case 2: return 'Sent';
      case 3: return 'Preparing';
      case 4: return 'Ready';
      case 5: return 'Served';
      case 6: return 'Closed';
      case 7: return 'Cancelled';
      default: return 'Unknown';
    }
  }
}

class OrderProduct {
  final String? productId;
  final String? name;
  final int quantity;
  final double? unitPrice;
  final double? totalPrice;
  final String? kitchenNotes;

  OrderProduct({
    this.productId,
    this.name,
    this.quantity = 1,
    this.unitPrice,
    this.totalPrice,
    this.kitchenNotes,
  });

  factory OrderProduct.fromJson(Map<String, dynamic> json) {
    return OrderProduct(
      productId: json['product']?['id'] ?? json['product_id'],
      name: json['product']?['name'],
      quantity: json['quantity'] ?? 1,
      unitPrice: (json['unit_price'] as num?)?.toDouble(),
      totalPrice: (json['total_price'] as num?)?.toDouble(),
      kitchenNotes: json['kitchen_notes'],
    );
  }
}

class WaiterUser {
  final String id;
  final String name;
  final String email;
  final bool isOwner;

  WaiterUser({required this.id, required this.name, required this.email, this.isOwner = false});

  factory WaiterUser.fromJson(Map<String, dynamic> json) {
    return WaiterUser(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      isOwner: json['is_owner'] ?? false,
    );
  }
}

class QRPayload {
  final String tableId;
  final String reservationName;
  final String branchId;

  QRPayload({required this.tableId, required this.reservationName, required this.branchId});

  factory QRPayload.fromJson(Map<String, dynamic> json) {
    return QRPayload(
      tableId: json['t'] ?? json['table_id'] ?? '',
      reservationName: json['r'] ?? json['reservation_name'] ?? '',
      branchId: json['b'] ?? json['branch_id'] ?? '',
    );
  }
}
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// WebSocket service for real-time order/table updates.
class WebSocketService {
  static const String wsUrl = 'ws://localhost:3000/ws';
  
  WebSocketChannel? _channel;
  bool _connected = false;
  String? _role;
  String? _tableId;
  
  // Callbacks
  void Function(String event, Map<String, dynamic> data)? onMessage;
  void Function()? onConnected;
  void Function()? onDisconnected;

  bool get isConnected => _connected;

  void connect({String role = 'unknown', String? tableId, String? waiterId}) {
    _role = role;
    _tableId = tableId;
    
    final params = <String, String>{'role': role};
    if (tableId != null) params['table_id'] = tableId;
    if (waiterId != null) params['waiter_id'] = waiterId;
    
    final uri = Uri.parse(wsUrl).replace(queryParameters: params);
    _channel = WebSocketChannel.connect(uri);
    _connected = true;
    
    onConnected?.call();
    
    _channel!.stream.listen(
      (message) {
        try {
          final parsed = jsonDecode(message) as Map<String, dynamic>;
          final event = parsed['event'] as String? ?? 'unknown';
          final data = parsed['data'] as Map<String, dynamic>? ?? {};
          onMessage?.call(event, data);
        } catch (e) {
          print('[WS] Parse error: $e');
        }
      },
      onDone: () {
        _connected = false;
        onDisconnected?.call();
        print('[WS] Disconnected');
      },
      onError: (error) {
        _connected = false;
        onDisconnected?.call();
        print('[WS] Error: $error');
      },
    );
    
    print('[WS] Connected as $role${tableId != null ? ' for table $tableId' : ''}');
  }

  void send(String event, Map<String, dynamic> data) {
    if (_channel != null && _connected) {
      _channel!.sink.add(jsonEncode({'event': event, ...data}));
    }
  }

  void callWaiter(String tableId) {
    send('call_waiter', {'table_id': tableId});
  }

  void requestCheck(String tableId, String orderId) {
    send('request_check', {'table_id': tableId, 'order_id': orderId});
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _connected = false;
  }
}

// Riverpod provider
final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  return WebSocketService();
});
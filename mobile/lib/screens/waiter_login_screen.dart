import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import 'waiter_tables_screen.dart';

class WaiterLoginScreen extends ConsumerStatefulWidget {
  const WaiterLoginScreen({super.key});

  @override
  ConsumerState<WaiterLoginScreen> createState() => _WaiterLoginScreenState();
}

class _WaiterLoginScreenState extends ConsumerState<WaiterLoginScreen> {
  final _appIdController = TextEditingController();
  final _pinController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _appIdController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final appId = _appIdController.text.trim();
    final pin = _pinController.text.trim();
    if (appId.isEmpty || pin.isEmpty) {
      setState(() => _error = 'Please enter both App ID and PIN');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final result = await api.loginWaiter(appId, pin);
      final user = WaiterUser.fromJson(result['user'] as Map<String, dynamic>);
      ref.read(waiterAuthProvider.notifier).state = user;
      
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const WaiterTablesScreen()),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString().contains('401')
            ? 'Invalid credentials'
            : 'Login failed: ${e.toString()}';
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Waiter Login')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.badge, size: 64, color: Colors.orange),
            const SizedBox(height: 24),
            TextField(
              controller: _appIdController,
              decoration: const InputDecoration(
                labelText: 'App ID',
                hintText: 'Your employee ID or email',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _pinController,
              decoration: const InputDecoration(
                labelText: 'PIN',
                hintText: 'Your Foodics PIN',
                prefixIcon: Icon(Icons.lock),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              obscureText: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _login(),
            ),
            const SizedBox(height: 24),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: _loading ? null : _login,
                child: _loading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Login', style: TextStyle(fontSize: 18)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
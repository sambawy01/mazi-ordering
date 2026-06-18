import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_providers.dart';
import '../models/models.dart';
import 'waiter_table_detail_screen.dart';

/// Waiter table grid: shows all tables with status colors.
class WaiterTablesScreen extends ConsumerWidget {
  const WaiterTablesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tablesAsync = ref.watch(tablesProvider);
    final waiter = ref.watch(waiterAuthProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tables'),
        actions: [
          if (waiter != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(child: Text(waiter.name, style: const TextStyle(fontWeight: FontWeight.w500))),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(apiClientProvider).logout();
              ref.read(waiterAuthProvider.notifier).state = null;
              if (context.mounted) {
                Navigator.of(context).pushNamedAndRemoveUntil('/', (_) => false);
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(tablesProvider.future),
        child: tablesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                Text('Cannot connect to server\n$err', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(tablesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (tables) {
            if (tables.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.table_restaurant, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No tables found.\nMake sure the backend is connected to Foodics.'),
                    SizedBox(height: 16),
                  ],
                ),
              );
            }

            // Group by section
            final Map<String, List<TableModel>> bySection = {};
            for (final t in tables) {
              final section = t.sectionName ?? 'No Section';
              bySection.putIfAbsent(section, () => []).add(t);
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: bySection.entries.map((entry) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        entry.key,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 1.2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      itemCount: entry.value.length,
                      itemBuilder: (context, index) {
                        final table = entry.value[index];
                        return _TableCard(
                          table: table,
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => WaiterTableDetailScreen(table: table),
                              ),
                            );
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                  ],
                );
              }).toList(),
            );
          },
        ),
      ),
    );
  }
}

class _TableCard extends StatelessWidget {
  final TableModel table;
  final VoidCallback onTap;

  const _TableCard({required this.table, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = Color(table.statusColor);
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color, width: 2),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.table_restaurant, color: color, size: 32),
              const SizedBox(height: 8),
              Text(
                table.name,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              Text(
                table.statusLabel,
                style: TextStyle(color: color, fontSize: 12),
              ),
              if (table.seats > 0)
                Text(
                  '${table.seats} seats',
                  style: TextStyle(color: Colors.grey[600], fontSize: 11),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
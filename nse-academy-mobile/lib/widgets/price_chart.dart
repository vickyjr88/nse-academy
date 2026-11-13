import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../data/models/stock.dart';

/// A line chart of closing prices with a touch tooltip and a soft fill, coloured by whether the period was up or down.
class PriceChart extends StatelessWidget {
  const PriceChart({super.key, required this.points, this.height = 180});
  final List<PricePoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (points.length < 2) {
      return SizedBox(height: height, child: Center(child: Text('Not enough price history yet', style: AppText.bodySmall(c.textSecondary))));
    }
    final up = points.last.price >= points.first.price;
    final color = up ? c.gain : c.loss;
    final prices = points.map((p) => p.price);
    final lo = prices.reduce((a, b) => a < b ? a : b);
    final hi = prices.reduce((a, b) => a > b ? a : b);
    final pad = (hi - lo) == 0 ? hi * 0.02 : (hi - lo) * 0.12;
    final spots = [for (var i = 0; i < points.length; i++) FlSpot(i.toDouble(), points[i].price)];
    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          minY: lo - pad,
          maxY: hi + pad,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: const FlTitlesData(show: false),
          lineTouchData: LineTouchData(
            handleBuiltInTouches: true,
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => c.surfaceElevated,
              getTooltipItems: (touched) => touched.map((t) {
                final p = points[t.x.toInt().clamp(0, points.length - 1)];
                return LineTooltipItem('${formatShortDate(p.date)}\n', AppText.caption(c.textSecondary), children: [TextSpan(text: 'KES ${formatPrice(p.price)}', style: AppText.metric(c.textPrimary).copyWith(fontSize: 14))]);
              }).toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              curveSmoothness: 0.15,
              color: color,
              barWidth: 2.2,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0.22), color.withValues(alpha: 0.0)])),
            ),
          ],
        ),
      ),
    );
  }
}

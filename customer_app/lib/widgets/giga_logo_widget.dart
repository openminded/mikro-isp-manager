import 'dart:math';
import 'package:flutter/material.dart';

class GigaLogoWidget extends StatelessWidget {
  final double size;
  final bool showText;
  final bool showSubtitle;

  const GigaLogoWidget({
    super.key,
    this.size = 110,
    this.showText = true,
    this.showSubtitle = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CustomPaint(
          size: Size(size, size),
          painter: _GigaLogoPainter(),
        ),
        if (showText) ...[
          const SizedBox(height: 14),
          const Text(
            'GIGANUSA',
            style: TextStyle(
              color: Color(0xFFC93B3B),
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 3.0,
            ),
          ),
        ],
        if (showSubtitle) ...[
          const SizedBox(height: 4),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Text(
                'Selamat Datang di ',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                'Portal Pelanggan',
                style: TextStyle(
                  color: Color(0xFFE53935),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _GigaLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Center coordinates
    final cx = w / 2;
    final cy = h / 2;

    // Soft red glow background behind logo like screenshot
    final glowPaint = Paint()
      ..color = const Color(0xFFFFA4A2).withOpacity(0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 20);
    canvas.drawCircle(Offset(cx + w * 0.16, cy - h * 0.05), w * 0.28, glowPaint);

    // 1. Draw Arch (slate color #323746)
    final archPaint = Paint()
      ..color = const Color(0xFF333745)
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    // Arch geometry:
    // Outer arc radius: w * 0.42
    // Inner arc radius: w * 0.23
    final outerRadius = w * 0.41;
    final innerRadius = w * 0.23;
    final strokeThickness = outerRadius - innerRadius;
    final legBottom = h * 0.88;
    final archCenterY = h * 0.44;

    final archPath = Path();
    // Outer top arc from left to right
    archPath.addArc(
      Rect.fromCircle(center: Offset(cx, archCenterY), radius: outerRadius),
      pi,
      pi,
    );
    // Right outer leg down
    archPath.lineTo(cx + outerRadius, legBottom);
    // Right rounded bottom cap
    archPath.arcToPoint(
      Offset(cx + innerRadius, legBottom),
      radius: Radius.circular(strokeThickness / 2),
      clockwise: true,
    );
    // Right inner leg up
    archPath.lineTo(cx + innerRadius, archCenterY);
    // Inner arc back to left
    archPath.arcTo(
      Rect.fromCircle(center: Offset(cx, archCenterY), radius: innerRadius),
      0,
      -pi,
      false,
    );
    // Left inner leg down
    archPath.lineTo(cx - innerRadius, legBottom);
    // Left rounded bottom cap
    archPath.arcToPoint(
      Offset(cx - outerRadius, legBottom),
      radius: Radius.circular(strokeThickness / 2),
      clockwise: true,
    );
    // Left outer leg back up
    archPath.lineTo(cx - outerRadius, archCenterY);
    archPath.close();

    canvas.drawPath(archPath, archPaint);

    // 2. Draw Center Circle (Vibrant Red #FF353D)
    final circlePaint = Paint()
      ..color = const Color(0xFFFF333A)
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final circleRadius = w * 0.21;
    final circleCenter = Offset(cx, archCenterY + circleRadius * 0.45);
    canvas.drawCircle(circleCenter, circleRadius, circlePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

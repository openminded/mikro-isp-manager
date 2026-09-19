import 'dart:math';
import 'package:flutter/material.dart';

enum GigaLogoLayout { vertical, horizontal, square }
enum GigaLogoVariant { color, white, dark }

class GigaLogoWidget extends StatelessWidget {
  final double size;
  final bool showText;
  final bool showSubtitle;
  final GigaLogoLayout layout;
  final GigaLogoVariant variant;
  final bool showGlow;

  const GigaLogoWidget({
    super.key,
    this.size = 110,
    this.showText = true,
    this.showSubtitle = true,
    this.layout = GigaLogoLayout.vertical,
    this.variant = GigaLogoVariant.color,
    this.showGlow = true,
  });

  /// Factory constructor for App Bar horizontal header logo
  factory GigaLogoWidget.horizontal({
    Key? key,
    double height = 36,
    GigaLogoVariant variant = GigaLogoVariant.white,
  }) {
    return GigaLogoWidget(
      key: key,
      size: height,
      showText: true,
      showSubtitle: false,
      layout: GigaLogoLayout.horizontal,
      variant: variant,
      showGlow: false,
    );
  }

  /// Factory constructor for pure logo icon (1:1 aspect ratio mark)
  factory GigaLogoWidget.icon({
    Key? key,
    double size = 48,
    GigaLogoVariant variant = GigaLogoVariant.color,
    bool showGlow = false,
  }) {
    return GigaLogoWidget(
      key: key,
      size: size,
      showText: false,
      showSubtitle: false,
      layout: GigaLogoLayout.square,
      variant: variant,
      showGlow: showGlow,
    );
  }

  Color get _archColor {
    switch (variant) {
      case GigaLogoVariant.white:
        return Colors.white;
      case GigaLogoVariant.dark:
        return const Color(0xFF1E222D);
      case GigaLogoVariant.color:
      default:
        return const Color(0xFF333745);
    }
  }

  Color get _titleColor {
    switch (variant) {
      case GigaLogoVariant.white:
        return Colors.white;
      case GigaLogoVariant.dark:
        return const Color(0xFF1E222D);
      case GigaLogoVariant.color:
      default:
        return const Color(0xFF333745);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mark = CustomPaint(
      size: Size(size, size),
      painter: _GigaLogoPainter(
        archColor: _archColor,
        sphereColor: const Color(0xFFFF333A),
        showGlow: showGlow,
      ),
    );

    if (layout == GigaLogoLayout.square || (!showText && !showSubtitle)) {
      return mark;
    }

    if (layout == GigaLogoLayout.horizontal) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          mark,
          SizedBox(width: size * 0.35),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GIGANUSA',
                style: TextStyle(
                  color: _titleColor,
                  fontSize: size * 0.55,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.2,
                  height: 1.0,
                ),
              ),
              if (showSubtitle) ...[
                const SizedBox(height: 2),
                Text(
                  'PORTAL PELANGGAN',
                  style: TextStyle(
                    color: const Color(0xFFFF333A),
                    fontSize: size * 0.28,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                ),
              ],
            ],
          ),
        ],
      );
    }

    // Vertical layout (default 3:4 aspect ratio presentation)
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        mark,
        if (showText) ...[
          SizedBox(height: size * 0.12),
          Text(
            'GIGANUSA',
            style: TextStyle(
              color: _titleColor,
              fontSize: size * 0.20,
              fontWeight: FontWeight.w900,
              letterSpacing: 3.0,
            ),
          ),
        ],
        if (showSubtitle) ...[
          const SizedBox(height: 4),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Selamat Datang di ',
                style: TextStyle(
                  color: variant == GigaLogoVariant.white
                      ? Colors.white.withOpacity(0.85)
                      : const Color(0xFF64748B),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Text(
                'Portal Pelanggan',
                style: TextStyle(
                  color: Color(0xFFFF333A),
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
  final Color archColor;
  final Color sphereColor;
  final bool showGlow;

  _GigaLogoPainter({
    required this.archColor,
    required this.sphereColor,
    required this.showGlow,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final cx = w / 2;
    final cy = h / 2;

    // Optional ambient glow background
    if (showGlow) {
      final glowPaint = Paint()
        ..color = const Color(0xFFFF8A84).withOpacity(0.32)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
      canvas.drawCircle(Offset(cx + w * 0.15, cy - h * 0.05), w * 0.28, glowPaint);
    }

    // 1. Draw Arch Symbol (Slate color #333745 or theme variant)
    final archPaint = Paint()
      ..color = archColor
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final outerRadius = w * 0.41;
    final innerRadius = w * 0.23;
    final strokeThickness = outerRadius - innerRadius;
    final legBottom = h * 0.88;
    final archCenterY = h * 0.44;

    final archPath = Path();
    archPath.addArc(
      Rect.fromCircle(center: Offset(cx, archCenterY), radius: outerRadius),
      pi,
      pi,
    );
    archPath.lineTo(cx + outerRadius, legBottom);
    archPath.arcToPoint(
      Offset(cx + innerRadius, legBottom),
      radius: Radius.circular(strokeThickness / 2),
      clockwise: true,
    );
    archPath.lineTo(cx + innerRadius, archCenterY);
    archPath.arcTo(
      Rect.fromCircle(center: Offset(cx, archCenterY), radius: innerRadius),
      0,
      -pi,
      false,
    );
    archPath.lineTo(cx - innerRadius, legBottom);
    archPath.arcToPoint(
      Offset(cx - outerRadius, legBottom),
      radius: Radius.circular(strokeThickness / 2),
      clockwise: true,
    );
    archPath.lineTo(cx - outerRadius, archCenterY);
    archPath.close();

    canvas.drawPath(archPath, archPaint);

    // 2. Draw Inner Red Sphere / Circle (#FF333A)
    final circlePaint = Paint()
      ..color = sphereColor
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final circleRadius = w * 0.21;
    final circleCenter = Offset(cx, archCenterY + circleRadius * 0.45);
    canvas.drawCircle(circleCenter, circleRadius, circlePaint);
  }

  @override
  bool shouldRepaint(covariant _GigaLogoPainter oldDelegate) {
    return oldDelegate.archColor != archColor ||
        oldDelegate.sphereColor != sphereColor ||
        oldDelegate.showGlow != showGlow;
  }
}

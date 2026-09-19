# 🎨 GigaNusa Customer App - Official Logo Branding & Ratio Specifications

Panduan Resmi Identitas Visual, Ukuran Ratio Ideal, dan Penerapan Logo Branding untuk Aplikasi Pelanggan **GigaNusa**.

---

## 📐 1. Geometric Construction & Ratio Specifications

Logo GigaNusa dibangun dengan sistem kisi geometris yang teratur (Vector ViewBox `500 x 500` unit), memadukan elemen **Arch / Lengkungan Slate** di bagian luar dan **Sphere / Lingkaran Merah** di bagian tengah.

```
                    500 px (Width)
     ┌──────────────────────────────────────────┐
     │                40px Margin               │
     │            ╭───────────────╮             │
     │           │   OUTER ARCH  │             │
     │           │   (Slate)     │             │ 500 px
     │          ╭┴───────────────┴╮            │ (Height)
     │          │   RED SPHERE    │            │
     │          │    (#FF333A)    │            │
     │          ╰─────────────────╯            │
     │              40px Margin                 │
     └──────────────────────────────────────────┘
```

### Detail Ukuran Geometri Logo:
- **ViewBox Standard**: `500 x 500` (Canvas Square `1:1`)
- **Outer Arch (Slate `#333745`)**:
  - Pusat Arc Atas: `(250, 250)`
  - Jari-jari Luar (*Outer Radius*): `130px` (Lebar Total Arch = `260px`)
  - Jari-jari Dalam (*Inner Radius*): `88px` (Rongga Dalam = `176px`)
  - Ketebalan Arch (*Stroke Width*): `42px`
  - Kaki Arch: Memanjang vertikal hingga `Y = 420px` dengan *Rounded Bottom Cap* radius `21px`.
- **Inner Circle / Sphere (Bright Red `#FF333A`)**:
  - Titik Pusat Circle: `(250, 275)` (Berada di tengah cavity arch)
  - Jari-jari Circle (*Radius*): `90px` (Diameter = `180px`)

---

## 📊 2. Ratio Standards & Branding Usage Matrix

| Standard Ratio | Ratio Format | Dimensions (px) | Usage Location | SVG Asset File |
| :--- | :--- | :--- | :--- | :--- |
| **Ratio 1:1** | **Square Mark** | `500 x 500` | App Launcher Icon, Web Favicon, Profile Avatar, Social Icon | [`logo.svg`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/assets/logo.svg) |
| **Ratio 4:1** | **Horizontal Logo** | `800 x 200` | Navigation Header, App Bar, Invoice Banner, Web Navbar | [`logo_full.svg`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/assets/logo_full.svg) |
| **Ratio 3:4** | **Vertical Stacked** | `600 x 800` | Splash Screen, Login Card, Mobile Onboarding Banner | [`logo_vertical.svg`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/assets/logo_vertical.svg) |
| **Ratio 1:1 Monochrome** | **White Variant** | `500 x 500` | Dark Mode Surfaces, Dark Purple Canvas, Solid Overlays | [`logo_white.svg`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/assets/logo_white.svg) |
| **Ratio 1:1 Squircle** | **App Icon Card** | `512 x 512` | App Store Icon, Desktop/PWA Icon Preview | [`logo_icon.svg`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/assets/logo_icon.svg) |
| **Adaptive Vector** | **Android Icon** | `108dp` viewport | Android Launcher (`ic_launcher.xml`), Adaptive Layers | [`ic_launcher.xml`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/android/app/src/main/res/drawable/ic_launcher.xml) |

---

## 🎨 3. Official Color Palette

| Color Role | Color Name | Hex Code | RGB | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Symbol** | Slate Arch | `#333745` | `rgb(51, 55, 69)` | Outer Arch / Text Primary |
| **Accent Symbol** | Vibrant Red Sphere | `#FF333A` | `rgb(255, 51, 58)` | Center Circle / Subtitle Accent |
| **Brand Canvas** | Deep Indigo Purple | `#5B50D6` | `rgb(91, 80, 214)` | App Splash Background & Primary Buttons |
| **Light Surface** | Clean Slate Gray | `#F8FAFC` | `rgb(248, 250, 252)` | Application Body Background |
| **Ambient Glow** | Coral Soft Glow | `#FF8A84` (32% Opacity) | `rgba(255, 138, 132, 0.32)` | Blur backing aura behind logo mark |

---

## 📱 4. Flutter Widget Implementation (`GigaLogoWidget`)

Komponen [`GigaLogoWidget`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/lib/widgets/giga_logo_widget.dart) telah diperbarui untuk mendukung seluruh variasi ratio dan warna secara otomatis:

```dart
// 1. Vertical Layout (Default 3:4 ratio - Login & Splash Screen)
const GigaLogoWidget(
  size: 110,
  showText: true,
  showSubtitle: true,
  layout: GigaLogoLayout.vertical,
  variant: GigaLogoVariant.color,
);

// 2. Horizontal Layout (Ratio 4:1 - App Bar Header)
GigaLogoWidget.horizontal(
  height: 26,
  variant: GigaLogoVariant.white,
);

// 3. Icon Only (Ratio 1:1 - Mark Icon)
GigaLogoWidget.icon(
  size: 48,
  variant: GigaLogoVariant.color,
);
```

---

## 🛠️ 5. Android Launcher Icon Configuration

Vektor launcher icon Android telah diselaraskan penuh dengan standar Adaptive Icons pada Android 8.0+:
- **Vector Launcher**: [`ic_launcher.xml`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/android/app/src/main/res/drawable/ic_launcher.xml)
- **Background Layer**: [`ic_launcher_background.xml`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/android/app/src/main/res/drawable/ic_launcher_background.xml) (`#F8FAFC`)
- **Foreground Layer**: [`ic_launcher_foreground.xml`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/android/app/src/main/res/drawable/ic_launcher_foreground.xml) (`Arch + Red Circle` di dalam safe inset 66dp)
- **Mipmap Manifest**: [`mipmap-anydpi-v26/ic_launcher.xml`](file:///c:/Users/zk/Downloads/App/new-isp/customer_app/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml)

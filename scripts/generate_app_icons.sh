#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "======================================================================"
echo " GERANDO ÍCONES DE CÁPSULAS DE REMÉDIO BI-COLOR PARA PACIENTE E CUIDADOR"
echo "======================================================================"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq librsvg2-bin >/dev/null
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. SVG para MediCare PACIENTE (Cápsula Azul + Verde Esmeralda + Selo "P")
cat > "$TMP_DIR/paciente.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pacBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#1E3A8A"/>
    </linearGradient>
    <linearGradient id="pillTopPac" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60A5FA"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="pillBotPac" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="pBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="shadowP" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Fundo Arredondado -->
  <rect x="16" y="16" width="480" height="480" rx="108" ry="108" fill="url(#pacBg)"/>
  <rect x="24" y="24" width="464" height="464" rx="100" ry="100" fill="none" stroke="#3B82F6" stroke-width="4" stroke-opacity="0.4"/>

  <!-- Cápsula de Remédio Paciente -->
  <g filter="url(#shadowP)" transform="translate(256, 230) rotate(-45)">
    <!-- Metade Superior da Cápsula (Azul) -->
    <path d="M -70 -130 A 70 70 0 0 1 70 -130 L 70 -10 L -70 -10 Z" fill="url(#pillTopPac)"/>
    <path d="M -45 -130 A 45 45 0 0 1 45 -130 L 45 -20 L -45 -20 Z" fill="#FFFFFF" opacity="0.25"/>

    <!-- Anel Central da Cápsula -->
    <rect x="-76" y="-12" width="152" height="24" rx="6" fill="#FFFFFF"/>

    <!-- Metade Inferior da Cápsula (Verde Esmeralda) -->
    <path d="M -70 12 L 70 12 L 70 130 A 70 70 0 0 1 -70 130 Z" fill="url(#pillBotPac)"/>

    <!-- Cruz Médica Branca com Coração no Centro -->
    <rect x="-16" y="-45" width="32" height="90" rx="8" fill="#FFFFFF"/>
    <rect x="-45" y="-16" width="90" height="32" rx="8" fill="#FFFFFF"/>
    <path d="M 0 -2 C 0 -10, -8 -16, -16 -16 C -24 -16, -30 -10, -30 -2 C -30 12, 0 28, 0 28 C 0 28, 30 12, 30 -2 C 30 -10, 24 -16, 16 -16 C 8 -16, 0 -10, 0 -2 Z" fill="#EF4444" transform="scale(0.55)"/>
  </g>

  <!-- Selo "P" (PACIENTE) no canto inferior direito -->
  <g filter="url(#shadowP)" transform="translate(320, 320)">
    <circle cx="80" cy="80" r="72" fill="url(#pBadgeBg)" stroke="#FFFFFF" stroke-width="8"/>
    <text x="80" y="106" font-family="'Inter', 'Helvetica', 'Arial', sans-serif" font-weight="900" font-size="88" fill="#FFFFFF" text-anchor="middle">P</text>
  </g>
</svg>
EOF

# 2. SVG para MediCare CUIDADOR (Cápsula Roxa + Ciano + Selo "C")
cat > "$TMP_DIR/cuidador.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cuiBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="pillTopCui" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
    <linearGradient id="pillBotCui" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22D3EE"/>
      <stop offset="100%" stop-color="#0891B2"/>
    </linearGradient>
    <linearGradient id="cBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#0E7490"/>
    </linearGradient>
    <filter id="shadowC" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Fundo Arredondado Roxo -->
  <rect x="16" y="16" width="480" height="480" rx="108" ry="108" fill="url(#cuiBg)"/>
  <rect x="24" y="24" width="464" height="464" rx="100" ry="100" fill="none" stroke="#8B5CF6" stroke-width="4" stroke-opacity="0.4"/>

  <!-- Cápsula de Remédio Cuidador -->
  <g filter="url(#shadowC)" transform="translate(256, 230) rotate(-45)">
    <!-- Metade Superior da Cápsula (Roxo) -->
    <path d="M -70 -130 A 70 70 0 0 1 70 -130 L 70 -10 L -70 -10 Z" fill="url(#pillTopCui)"/>
    <path d="M -45 -130 A 45 45 0 0 1 45 -130 L 45 -20 L -45 -20 Z" fill="#FFFFFF" opacity="0.25"/>

    <!-- Anel Central da Cápsula -->
    <rect x="-76" y="-12" width="152" height="24" rx="6" fill="#FFFFFF"/>

    <!-- Metade Inferior da Cápsula (Ciano) -->
    <path d="M -70 12 L 70 12 L 70 130 A 70 70 0 0 1 -70 130 Z" fill="url(#pillBotCui)"/>

    <!-- Coração / Cuidado Central -->
    <circle cx="0" cy="0" r="32" fill="#FFFFFF"/>
    <path d="M 0 -18 C 0 -24, -6 -28, -12 -28 C -18 -28, -22 -24, -22 -18 C -22 -8, 0 4, 0 4 C 0 4, 22 -8, 22 -18 C 22 -24, 18 -28, 12 -28 C 6 -28, 0 -24, 0 -18 Z" fill="#7C3AED" transform="scale(0.85)"/>
  </g>

  <!-- Selo "C" (CUIDADOR) no canto inferior direito -->
  <g filter="url(#shadowC)" transform="translate(320, 320)">
    <circle cx="80" cy="80" r="72" fill="url(#cBadgeBg)" stroke="#FFFFFF" stroke-width="8"/>
    <text x="80" y="106" font-family="'Inter', 'Helvetica', 'Arial', sans-serif" font-weight="900" font-size="88" fill="#FFFFFF" text-anchor="middle">C</text>
  </g>
</svg>
EOF

echo "Renderizando imagens PNG para MediCare Paciente..."
rsvg-convert -w 512 -h 512 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-512.png"
rsvg-convert -w 384 -h 384 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-384.png"
rsvg-convert -w 192 -h 192 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-192.png"
rsvg-convert -w 152 -h 152 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-152.png"
rsvg-convert -w 144 -h 144 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-144.png"
rsvg-convert -w 128 -h 128 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-128.png"
rsvg-convert -w 96 -h 96 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-96.png"
rsvg-convert -w 72 -h 72 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/icon-72.png"
rsvg-convert -w 180 -h 180 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/apple-touch-icon.png"
rsvg-convert -w 32 -h 32 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/favicon-32x32.png"
rsvg-convert -w 16 -h 16 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/public/favicon-16x16.png"
convert "$ROOT_DIR/public/favicon-32x32.png" "$ROOT_DIR/public/favicon.ico"

echo "Renderizando imagens PNG para MediCare Cuidador..."
mkdir -p "$ROOT_DIR/apps/cuidador-web/public"
rsvg-convert -w 512 -h 512 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/apps/cuidador-web/public/icon-512.png"
rsvg-convert -w 192 -h 192 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/apps/cuidador-web/public/icon-192.png"
rsvg-convert -w 32 -h 32 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/apps/cuidador-web/public/favicon-32x32.png"
convert "$ROOT_DIR/apps/cuidador-web/public/favicon-32x32.png" "$ROOT_DIR/apps/cuidador-web/public/favicon.ico"

echo "Sincronizando ícones do aplicativo Android (src-apk)..."
mkdir -p src-apk/res/mipmap-mdpi src-apk/res/mipmap-hdpi src-apk/res/mipmap-xhdpi src-apk/res/mipmap-xxhdpi src-apk/res/mipmap-xxxhdpi
cp -f public/icon-72.png src-apk/res/mipmap-mdpi/ic_launcher.png
cp -f public/icon-72.png src-apk/res/mipmap-mdpi/ic_launcher_round.png
cp -f public/icon-72.png src-apk/res/mipmap-hdpi/ic_launcher.png
cp -f public/icon-72.png src-apk/res/mipmap-hdpi/ic_launcher_round.png
cp -f public/icon-96.png src-apk/res/mipmap-xhdpi/ic_launcher.png
cp -f public/icon-96.png src-apk/res/mipmap-xhdpi/ic_launcher_round.png
cp -f public/icon-144.png src-apk/res/mipmap-xxhdpi/ic_launcher.png
cp -f public/icon-144.png src-apk/res/mipmap-xxhdpi/ic_launcher_round.png
cp -f public/icon-192.png src-apk/res/mipmap-xxxhdpi/ic_launcher.png
cp -f public/icon-192.png src-apk/res/mipmap-xxxhdpi/ic_launcher_round.png

echo "✓ SUCESSO: Ícones de cápsulas médicas para Paciente e Cuidador gerados e sincronizados!"

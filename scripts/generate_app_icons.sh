#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "======================================================================"
echo " GERANDO ÍCONES DISTINTOS PARA MEDICARE PACIENTE E MEDICARE CUIDADOR"
echo "======================================================================"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq librsvg2-bin >/dev/null
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. SVG para MediCare PACIENTE (Azul + Verde Esmeralda + Selo "P")
cat > "$TMP_DIR/paciente.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pacBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="pBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Fundo Arredondado Azul -->
  <rect x="16" y="16" width="480" height="480" rx="108" ry="108" fill="url(#pacBg)"/>

  <!-- Brilho Interno sutil -->
  <rect x="24" y="24" width="464" height="464" rx="100" ry="100" fill="none" stroke="#60A5FA" stroke-width="4" stroke-opacity="0.3"/>

  <!-- Ícone Central: Cápsula Médica + Coração -->
  <g filter="url(#shadow)" transform="translate(106, 80)">
    <!-- Cápsula Inclinada -->
    <g transform="rotate(-30, 150, 150)">
      <!-- Metade da Pílula (Branca) -->
      <path d="M 90 70 A 50 50 0 0 1 210 70 L 210 150 L 90 150 Z" fill="#FFFFFF"/>
      <!-- Metade da Pílula (Verde Esmeralda) -->
      <path d="M 90 150 L 210 150 L 210 230 A 50 50 0 0 1 90 230 Z" fill="#10B981"/>
      <!-- Divisória -->
      <line x1="90" y1="150" x2="210" y2="150" stroke="#1E3A8A" stroke-width="6" opacity="0.3"/>
    </g>

    <!-- Coração Central no aplicativo Paciente -->
    <path d="M 150 175 C 150 155, 130 140, 110 140 C 90 140, 75 155, 75 175 C 75 205, 150 240, 150 240 C 150 240, 225 205, 225 175 C 225 155, 210 140, 190 140 C 170 140, 150 155, 150 175 Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="4"/>
  </g>

  <!-- Selo "P" (PACIENTE) no canto inferior direito -->
  <g filter="url(#shadow)" transform="translate(320, 320)">
    <circle cx="80" cy="80" r="72" fill="url(#pBadgeBg)" stroke="#FFFFFF" stroke-width="8"/>
    <text x="80" y="106" font-family="'Inter', 'Helvetica', 'Arial', sans-serif" font-weight="900" font-size="88" fill="#FFFFFF" text-anchor="middle">P</text>
  </g>
</svg>
EOF

# 2. SVG para MediCare CUIDADOR (Roxo + Violeta + Ciano + Selo "C")
cat > "$TMP_DIR/cuidador.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cuiBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4C1D95"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="cBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0891B2"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
    <filter id="shadowC" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Fundo Arredondado Roxo -->
  <rect x="16" y="16" width="480" height="480" rx="108" ry="108" fill="url(#cuiBg)"/>

  <!-- Borda Brilhante -->
  <rect x="24" y="24" width="464" height="464" rx="100" ry="100" fill="none" stroke="#A78BFA" stroke-width="4" stroke-opacity="0.3"/>

  <!-- Ícone Central: Mãos de Cuidado + Escudo + Cruz -->
  <g filter="url(#shadowC)" transform="translate(106, 75)">
    <!-- Escudo Protetor -->
    <path d="M 150 20 L 250 60 L 250 170 C 250 235, 150 280, 150 280 C 150 280, 50 235, 50 170 L 50 60 Z" fill="#FFFFFF" fill-opacity="0.15" stroke="#FFFFFF" stroke-width="8"/>
    
    <!-- Cruz Médica Branca -->
    <rect x="130" y="80" width="40" height="110" rx="10" fill="#FFFFFF"/>
    <rect x="95" y="115" width="110" height="40" rx="10" fill="#FFFFFF"/>

    <!-- Coração Ciano no Centro da Cruz -->
    <path d="M 150 128 C 150 118, 140 110, 130 110 C 120 110, 112 118, 112 128 C 112 143, 150 160, 150 160 C 150 160, 188 143, 188 128 C 188 118, 180 110, 170 110 C 160 110, 150 118, 150 128 Z" fill="#06B6D4"/>
  </g>

  <!-- Selo "C" (CUIDADOR) no canto inferior direito -->
  <g filter="url(#shadowC)" transform="translate(320, 320)">
    <circle cx="80" cy="80" r="72" fill="url(#cBadgeBg)" stroke="#FFFFFF" stroke-width="8"/>
    <text x="80" y="106" font-family="'Inter', 'Helvetica', 'Arial', sans-serif" font-weight="900" font-size="88" fill="#FFFFFF" text-anchor="middle">C</text>
  </g>
</svg>
EOF

echo "Renderizando imagens PNG para MediCare Paciente com rsvg-convert..."
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

echo "Renderizando imagens PNG para MediCare Cuidador com rsvg-convert..."
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

echo "✓ SUCESSO: Todos os ícones do MediCare Paciente e Cuidador foram gerados e sincronizados!"

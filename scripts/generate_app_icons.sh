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

# 1. SVG para MediCare PACIENTE (Cápsula Azul + Verde Esmeralda) -> APK Android Paciente
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
  </defs>

  <!-- Fundo Arredondado Escuro/Azul -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#pacBg)"/>
  <rect x="26" y="26" width="460" height="460" rx="102" ry="102" fill="none" stroke="#60A5FA" stroke-width="6" stroke-opacity="0.35"/>

  <!-- Sombra da Cápsula -->
  <g transform="translate(264, 256) rotate(45)">
    <rect x="-82" y="-176" width="164" height="352" rx="82" ry="82" fill="#000000" fill-opacity="0.38"/>
  </g>

  <!-- Cápsula de Remédio Paciente (Azul + Verde Esmeralda) -->
  <g transform="translate(250, 242) rotate(45)">
    <!-- Borda Externa Branca da Cápsula -->
    <rect x="-84" y="-178" width="168" height="356" rx="84" ry="84" fill="#FFFFFF"/>

    <!-- Metade Superior da Cápsula (Azul Royal) -->
    <path d="M -76 -94 A 76 76 0 0 1 76 -94 L 76 0 L -76 0 Z" fill="url(#pillTopPac)"/>

    <!-- Metade Inferior da Cápsula (Verde Esmeralda) -->
    <path d="M -76 0 L 76 0 L 76 94 A 76 76 0 0 1 -76 94 Z" fill="url(#pillBotPac)"/>

    <!-- Faixa Divisória Central da Cápsula -->
    <rect x="-84" y="-10" width="168" height="20" fill="#F8FAFC"/>

    <!-- Reflexo 3D Lateral Esquerdo -->
    <rect x="-54" y="-146" width="22" height="292" rx="11" ry="11" fill="#FFFFFF" fill-opacity="0.32"/>

    <!-- Cruz Médica Branca no Centro ( Vertical ) -->
    <g transform="rotate(-45)">
      <circle cx="0" cy="0" r="44" fill="#0F172A" fill-opacity="0.22"/>
      <circle cx="0" cy="0" r="38" fill="#FFFFFF"/>
      <rect x="-8" y="-22" width="16" height="44" rx="4" fill="#2563EB"/>
      <rect x="-22" y="-8" width="44" height="16" rx="4" fill="#10B981"/>
    </g>
  </g>

  <!-- Selo "P" (PACIENTE) no canto inferior direito -->
  <g transform="translate(332, 332)">
    <circle cx="76" cy="82" r="68" fill="#000000" fill-opacity="0.35"/>
    <circle cx="72" cy="72" r="66" fill="url(#pBadgeBg)" stroke="#FFFFFF" stroke-width="10"/>
    <path d="M 52 100 L 52 44 L 76 44 C 90 44 98 52 98 63 C 98 74 90 82 76 82 L 66 82 L 66 100 Z M 66 70 L 75 70 C 81 70 84 67 84 63 C 84 59 81 56 75 56 L 66 56 Z" fill="#FFFFFF"/>
  </g>
</svg>
EOF

# 2. SVG para MediCare CUIDADOR (Cápsula Coral/Rosa + Roxo/Violeta + Ciano) -> Web / PWA Cuidador
cat > "$TMP_DIR/cuidador.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cuiBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2E1065"/>
      <stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="pillTopCui" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
    <linearGradient id="pillBotCui" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="cBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
  </defs>

  <!-- Fundo Arredondado Roxo Profundo -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#cuiBg)"/>
  <rect x="26" y="26" width="460" height="460" rx="102" ry="102" fill="none" stroke="#C084FC" stroke-width="6" stroke-opacity="0.4"/>

  <!-- Sombra da Cápsula -->
  <g transform="translate(264, 256) rotate(45)">
    <rect x="-82" y="-176" width="164" height="352" rx="82" ry="82" fill="#000000" fill-opacity="0.38"/>
  </g>

  <!-- Cápsula de Remédio Cuidador (Coral/Rubi + Âmbar/Dourado) -->
  <g transform="translate(250, 242) rotate(45)">
    <!-- Borda Externa Branca da Cápsula -->
    <rect x="-84" y="-178" width="168" height="356" rx="84" ry="84" fill="#FFFFFF"/>

    <!-- Metade Superior da Cápsula (Coral / Rubi) -->
    <path d="M -76 -94 A 76 76 0 0 1 76 -94 L 76 0 L -76 0 Z" fill="url(#pillTopCui)"/>

    <!-- Metade Inferior da Cápsula (Âmbar / Dourado) -->
    <path d="M -76 0 L 76 0 L 76 94 A 76 76 0 0 1 -76 94 Z" fill="url(#pillBotCui)"/>

    <!-- Faixa Divisória Central da Cápsula -->
    <rect x="-84" y="-10" width="168" height="20" fill="#FFFBEB"/>

    <!-- Reflexo 3D Lateral Esquerdo -->
    <rect x="-54" y="-146" width="22" height="292" rx="11" ry="11" fill="#FFFFFF" fill-opacity="0.34"/>

    <!-- Coração Central de Cuidado ( Vertical ) -->
    <g transform="rotate(-45)">
      <circle cx="0" cy="0" r="44" fill="#2E1065" fill-opacity="0.22"/>
      <circle cx="0" cy="0" r="38" fill="#FFFFFF"/>
      <path d="M 0 20 C 0 20 -22 6 -22 -9 C -22 -18 -15 -24 -7 -24 C -2 -24 0 -20 0 -17 C 0 -20 2 -24 7 -24 C 15 -24 22 -18 22 -9 C 22 6 0 20 0 20 Z" fill="#E11D48"/>
    </g>
  </g>

  <!-- Selo "C" (CUIDADOR) no canto inferior direito -->
  <g transform="translate(332, 332)">
    <circle cx="76" cy="82" r="68" fill="#000000" fill-opacity="0.35"/>
    <circle cx="72" cy="72" r="66" fill="url(#cBadgeBg)" stroke="#FFFFFF" stroke-width="10"/>
    <path d="M 92 82 C 88 94 79 101 66 101 C 49 101 38 89 38 72 C 38 55 49 43 66 43 C 79 43 88 50 92 62 L 78 66 C 76 59 72 56 66 56 C 57 56 52 62 52 72 C 52 82 57 88 66 88 C 72 88 76 85 78 78 Z" fill="#FFFFFF"/>
  </g>
</svg>
EOF

echo "1. Renderizando ícones Web/PWA do MediCare Cuidador em /public e /apps/cuidador-web/public..."
rsvg-convert -w 512 -h 512 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-512.png"
rsvg-convert -w 384 -h 384 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-384.png"
rsvg-convert -w 192 -h 192 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-192.png"
rsvg-convert -w 152 -h 152 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-152.png"
rsvg-convert -w 144 -h 144 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-144.png"
rsvg-convert -w 128 -h 128 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-128.png"
rsvg-convert -w 96 -h 96 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-96.png"
rsvg-convert -w 72 -h 72 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/icon-72.png"
rsvg-convert -w 180 -h 180 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/apple-touch-icon.png"
rsvg-convert -w 32 -h 32 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/favicon-32x32.png"
rsvg-convert -w 16 -h 16 "$TMP_DIR/cuidador.svg" -o "$ROOT_DIR/public/favicon-16x16.png"
convert "$ROOT_DIR/public/favicon-32x32.png" "$ROOT_DIR/public/favicon.ico"

mkdir -p "$ROOT_DIR/apps/cuidador-web/public"
cp -f "$ROOT_DIR/public/icon-512.png" "$ROOT_DIR/apps/cuidador-web/public/icon-512.png"
cp -f "$ROOT_DIR/public/icon-192.png" "$ROOT_DIR/apps/cuidador-web/public/icon-192.png"
cp -f "$ROOT_DIR/public/favicon-32x32.png" "$ROOT_DIR/apps/cuidador-web/public/favicon-32x32.png"
cp -f "$ROOT_DIR/public/favicon.ico" "$ROOT_DIR/apps/cuidador-web/public/favicon.ico"

echo "2. Renderizando ícones Android do MediCare Paciente em src-apk/res/mipmap-* e apps/paciente-android..."
mkdir -p src-apk/res/mipmap-mdpi src-apk/res/mipmap-hdpi src-apk/res/mipmap-xhdpi src-apk/res/mipmap-xxhdpi src-apk/res/mipmap-xxxhdpi
rsvg-convert -w 72 -h 72 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-mdpi/ic_launcher.png"
rsvg-convert -w 72 -h 72 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-mdpi/ic_launcher_round.png"
rsvg-convert -w 72 -h 72 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-hdpi/ic_launcher.png"
rsvg-convert -w 72 -h 72 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-hdpi/ic_launcher_round.png"
rsvg-convert -w 96 -h 96 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xhdpi/ic_launcher.png"
rsvg-convert -w 96 -h 96 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xhdpi/ic_launcher_round.png"
rsvg-convert -w 144 -h 144 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xxhdpi/ic_launcher.png"
rsvg-convert -w 144 -h 144 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xxhdpi/ic_launcher_round.png"
rsvg-convert -w 192 -h 192 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xxxhdpi/ic_launcher.png"
rsvg-convert -w 192 -h 192 "$TMP_DIR/paciente.svg" -o "$ROOT_DIR/src-apk/res/mipmap-xxxhdpi/ic_launcher_round.png"

for dir in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
  mkdir -p "$ROOT_DIR/apps/paciente-android/app/src/main/res/$dir"
  cp -f "$ROOT_DIR/src-apk/res/$dir/ic_launcher.png" "$ROOT_DIR/apps/paciente-android/app/src/main/res/$dir/ic_launcher.png"
  cp -f "$ROOT_DIR/src-apk/res/$dir/ic_launcher_round.png" "$ROOT_DIR/apps/paciente-android/app/src/main/res/$dir/ic_launcher_round.png"
done

echo "✓ SUCESSO: Ícones de cápsulas médicas para Paciente e Cuidador gerados e sincronizados!"


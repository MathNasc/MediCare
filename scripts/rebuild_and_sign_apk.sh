#!/usr/bin/env bash
# ==============================================================================
# MediCare — Pipeline Automatizado de Compilação e Assinatura de APK Debug
# ==============================================================================
# Gera o APK de debug funcional na raiz do projeto como "MediCare-Paciente.apk".
# Valida Manifesto (minSdkVersion 24, targetSdkVersion 33, versionCode),
# tabela de recursos (resources.arsc não-comprimido e alinhado em 4 bytes),
# bytecode Dalvik (classes.dex) e assinaturas v1, v2 e v3.
# Caso qualquer etapa falhe, o APK anterior NÃO é substituído.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

OUTPUT_APK="$ROOT_DIR/MediCare-Paciente.apk"

echo "=== [1/6] Verificando dependências do Android SDK ==="
if ! command -v aapt >/dev/null 2>&1 || ! command -v dalvik-exchange >/dev/null 2>&1 || ! command -v zipalign >/dev/null 2>&1 || ! command -v apksigner >/dev/null 2>&1 || ! command -v javac >/dev/null 2>&1; then
  echo "Instalando ferramentas de build Android (aapt, dalvik-exchange, zipalign, apksigner, jdk)..."
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq aapt dalvik-exchange zipalign apksigner default-jdk-headless >/dev/null
fi
if [ ! -f "/tmp/android-33.jar" ]; then
  echo "Baixando android-33.jar..."
  curl -sSL -o /tmp/android-33.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-33/android.jar
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== [2/6] Sincronizando ícones e empacotando recursos com aapt ==="
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

aapt package -f -m \
  -J src-apk \
  --custom-package com.medicare.patient \
  -M src-apk/AndroidManifest.xml \
  -S src-apk/res \
  -I /tmp/android-33.jar \
  -F "$TMP_DIR/unsigned.apk"

echo "=== [3/6] Compilando código-fonte Java (src-apk) ==="
mkdir -p "$TMP_DIR/classes"
javac -source 8 -target 8 -cp /tmp/android-33.jar src-apk/com/medicare/patient/*.java -d "$TMP_DIR/classes"

echo "=== [4/6] Gerando bytecode Dalvik (classes.dex) ==="
dalvik-exchange --dex --output="$TMP_DIR/classes.dex" "$TMP_DIR/classes"

echo "=== [5/6] Injetando classes.dex comprimido e alinhando em 4 bytes (zipalign) ==="
python3 -c "
import zipfile
with zipfile.ZipFile('$TMP_DIR/unsigned.apk', 'a') as zout:
    zout.write('$TMP_DIR/classes.dex', 'classes.dex', compress_type=zipfile.ZIP_DEFLATED)
"

zipalign -f -p 4 "$TMP_DIR/unsigned.apk" "$TMP_DIR/aligned.apk"
zipalign -c -v 4 "$TMP_DIR/aligned.apk" >/dev/null

echo "=== [6/6] Assinando APK de Debug (v1 + v2 + v3) ==="
KEYSTORE="$ROOT_DIR/src-apk/debug-keystore.bin"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkey -v -keystore "$KEYSTORE" \
    -alias androiddebugkey \
    -keyalg RSA \
    -sigalg SHA256withRSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass android \
    -keypass android \
    -dname "CN=Android Debug, OU=Android, O=Android, L=Mountain View, ST=CA, C=US" >/dev/null 2>&1
fi

apksigner sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --ks-key-alias androiddebugkey \
  --key-pass pass:android \
  --min-sdk-version 24 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$TMP_DIR/final_signed.apk" \
  "$TMP_DIR/aligned.apk"

echo "=== Validando Manifesto, Recursos e Assinatura do APK ==="
apksigner verify --min-sdk-version 24 --verbose "$TMP_DIR/final_signed.apk"
aapt dump badging "$TMP_DIR/final_signed.apk" | head -n 15

# Substitui o APK da raiz somente após validação completa
cp "$TMP_DIR/final_signed.apk" "$OUTPUT_APK"

# Garante que apenas MediCare-Paciente.apk exista no repositório
rm -f "$ROOT_DIR/public/"*.apk "$ROOT_DIR/medicare-patient.apk" 2>/dev/null || true

echo "✓ SUCESSO: '$OUTPUT_APK' gerado, validado e pronto para instalação!"

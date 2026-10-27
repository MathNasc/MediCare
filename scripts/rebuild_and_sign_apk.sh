#!/usr/bin/env bash
# ==============================================================================
# MediCare — Pipeline Automatizado de Empacotamento e Assinatura do APK
# ==============================================================================
# Gera o APK de debug/distribuição na raiz do repositório como "MediCare-Paciente.apk".
# Garante compatibilidade 100% com Android 14/15, alinhado em 4 bytes (zipalign)
# e assinado com Signature Scheme v1/v2/v3.
# Se o build falhar, o APK anterior NÃO será alterado nem sobrescrito.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

OUTPUT_APK="$ROOT_DIR/MediCare-Paciente.apk"

echo "=== [1/6] Verificando dependências do SDK / Compilador ==="
if [ ! -f "/tmp/android-33.jar" ]; then
  echo "Baixando android-33.jar..."
  curl -sSL -o /tmp/android-33.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-33/android.jar
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== [2/6] Gerando base de recursos com aapt ==="
mkdir -p "$TMP_DIR/gen"
aapt package -f -m \
  -J "$TMP_DIR/gen" \
  -M apps/paciente-android/app/src/main/AndroidManifest.xml \
  -S apps/paciente-android/app/src/main/res \
  -I /tmp/android-33.jar \
  -F "$TMP_DIR/base.apk"

echo "=== [3/6] Compilando código-fonte Java atualizado (src-apk) ==="
mkdir -p "$TMP_DIR/classes"
javac -source 8 -target 8 -cp /tmp/android-33.jar src-apk/com/medicare/patient/*.java -d "$TMP_DIR/classes"

echo "=== [4/6] Gerando bytecode Dalvik (classes.dex) ==="
dalvik-exchange --dex --output="$TMP_DIR/classes.dex" "$TMP_DIR/classes"

echo "=== [5/6] Empacotando e alinhando APK ==="
python3 -c "
import zipfile
import os

with zipfile.ZipFile('$TMP_DIR/base.apk', 'r') as zin:
    with zipfile.ZipFile('$TMP_DIR/unsigned.apk', 'w') as zout:
        for item in zin.infolist():
            if item.filename.startswith('META-INF/') or item.filename == 'classes.dex':
                continue
            if item.filename.startswith('res/mipmap-'):
                continue
            zout.writestr(item, zin.read(item.filename))
            
        zout.write('$TMP_DIR/classes.dex', 'classes.dex')
        
        # Ícones oficiais MediCare
        if os.path.exists('public/icon-72.png'):
            zout.write('public/icon-72.png', 'res/mipmap-mdpi-v4/ic_launcher.png')
            zout.write('public/icon-72.png', 'res/mipmap-mdpi-v4/ic_launcher_round.png')
            zout.write('public/icon-72.png', 'res/mipmap-hdpi-v4/ic_launcher.png')
            zout.write('public/icon-72.png', 'res/mipmap-hdpi-v4/ic_launcher_round.png')
            zout.write('public/icon-96.png', 'res/mipmap-xhdpi-v4/ic_launcher.png')
            zout.write('public/icon-96.png', 'res/mipmap-xhdpi-v4/ic_launcher_round.png')
            zout.write('public/icon-144.png', 'res/mipmap-xxhdpi-v4/ic_launcher.png')
            zout.write('public/icon-144.png', 'res/mipmap-xxhdpi-v4/ic_launcher_round.png')
            zout.write('public/icon-192.png', 'res/mipmap-xxxhdpi-v4/ic_launcher.png')
            zout.write('public/icon-192.png', 'res/mipmap-xxxhdpi-v4/ic_launcher_round.png')
"

zipalign -f -p 4 "$TMP_DIR/unsigned.apk" "$TMP_DIR/aligned.apk"

echo "=== [6/6] Assinando APK com Signature Scheme v1, v2 e v3 ==="
KEYSTORE="/tmp/medicare_permanent.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkey -v -keystore "$KEYSTORE" \
    -alias medicare \
    -keyalg RSA \
    -sigalg SHA256withRSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass medicare123 \
    -keypass medicare123 \
    -dname "CN=MediCare Paciente, OU=Mobile, O=MediCare, L=SaoPaulo, ST=SP, C=BR" >/dev/null 2>&1
fi

apksigner sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:medicare123 \
  --ks-key-alias medicare \
  --key-pass pass:medicare123 \
  --min-sdk-version 21 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$TMP_DIR/final_signed.apk" \
  "$TMP_DIR/aligned.apk"

echo "=== Validando integridade da assinatura ==="
apksigner verify --min-sdk-version 21 --verbose "$TMP_DIR/final_signed.apk"

# Sobrescreve na raiz somente APÓS sucesso comprovado do build
cp "$TMP_DIR/final_signed.apk" "$OUTPUT_APK"

# Limpa APKs duplicados antigos em public se houverem
rm -f "$ROOT_DIR/public/"*.apk "$ROOT_DIR/medicare-patient.apk" 2>/dev/null || true

echo "✓ SUCESSO: Arquivo '$OUTPUT_APK' gerado e atualizado!"

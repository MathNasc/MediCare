#!/usr/bin/env bash
# ==============================================================================
# MediCare — Pipeline Automatizado de Empacotamento e Assinatura de APK (v2 & v3)
# ==============================================================================
# Garante que qualquer atualização gere um APK pronto, 100% compatível com
# Android 14/15, alinhado em 4 bytes (zipalign) e assinado com Signature Scheme v2/v3.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "=== [1/5] Preparando arquivos e ícones para o APK ==="
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

python3 -c "
import zipfile

with zipfile.ZipFile('medicare-patient.apk', 'r') as zin:
    with zipfile.ZipFile('$TMP_DIR/unsigned.apk', 'w') as zout:
        for item in zin.infolist():
            # Remove assinaturas antigas
            if item.filename.startswith('META-INF/'):
                continue
            
            # Injeta os ícones oficiais MediCare em alta definição
            if item.filename in ['res/mipmap-mdpi-v4/ic_launcher.png', 'res/mipmap-mdpi-v4/ic_launcher_round.png']:
                zout.write('public/icon-72.png', item.filename)
            elif item.filename in ['res/mipmap-hdpi-v4/ic_launcher.png', 'res/mipmap-hdpi-v4/ic_launcher_round.png']:
                zout.write('public/icon-72.png', item.filename)
            elif item.filename in ['res/mipmap-xhdpi-v4/ic_launcher.png', 'res/mipmap-xhdpi-v4/ic_launcher_round.png']:
                zout.write('public/icon-96.png', item.filename)
            elif item.filename in ['res/mipmap-xxhdpi-v4/ic_launcher.png', 'res/mipmap-xxhdpi-v4/ic_launcher_round.png']:
                zout.write('public/icon-144.png', item.filename)
            elif item.filename in ['res/mipmap-xxxhdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi-v4/ic_launcher_round.png']:
                zout.write('public/icon-192.png', item.filename)
            else:
                zout.writestr(item, zin.read(item.filename))
"

echo "=== [2/5] Otimizando alinhamento de 4 bytes (zipalign) ==="
zipalign -f -p 4 "$TMP_DIR/unsigned.apk" "$TMP_DIR/aligned.apk"

echo "=== [3/5] Gerando Keystore seguro de distribuição ==="
keytool -genkey -v -keystore "$TMP_DIR/medicare.keystore" \
  -alias medicare \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass medicare123 \
  -keypass medicare123 \
  -dname "CN=MediCare Paciente, OU=Mobile, O=MediCare, L=SaoPaulo, ST=SP, C=BR" >/dev/null 2>&1

echo "=== [4/5] Assinando com APK Signature Scheme v2 e v3 (Exigido pelo Android 14) ==="
apksigner sign \
  --ks "$TMP_DIR/medicare.keystore" \
  --ks-pass pass:medicare123 \
  --ks-key-alias medicare \
  --key-pass pass:medicare123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$TMP_DIR/final_signed.apk" \
  "$TMP_DIR/aligned.apk"

echo "=== [5/5] Validando integridade do APK ==="
apksigner verify --verbose "$TMP_DIR/final_signed.apk"

cp "$TMP_DIR/final_signed.apk" "$ROOT_DIR/medicare-patient.apk"
cp "$TMP_DIR/final_signed.apk" "$ROOT_DIR/public/medicare-patient.apk"

echo "✓ SUCESSO: medicare-patient.apk e public/medicare-patient.apk atualizados e prontos para instalação!"

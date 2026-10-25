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

echo "=== [1/6] Verificando dependências do Android SDK / JAR ==="
if [ ! -f "/tmp/android-33.jar" ]; then
  echo "Baixando android-33.jar para compilação..."
  curl -sSL -o /tmp/android-33.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-33/android.jar
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== [2/6] Compilando código-fonte Java atualizado (src-apk) ==="
mkdir -p "$TMP_DIR/classes"
javac -source 8 -target 8 -cp /tmp/android-33.jar src-apk/com/medicare/patient/*.java -d "$TMP_DIR/classes"

echo "=== [3/6] Gerando bytecode Dalvik (classes.dex) com dalvik-exchange ==="
dalvik-exchange --dex --output="$TMP_DIR/classes.dex" "$TMP_DIR/classes"

echo "=== [4/6] Empacotando classes.dex e ícones oficiais no APK ==="
python3 -c "
import zipfile

with zipfile.ZipFile('medicare-patient.apk', 'r') as zin:
    with zipfile.ZipFile('$TMP_DIR/unsigned.apk', 'w') as zout:
        for item in zin.infolist():
            # Remove assinaturas antigas
            if item.filename.startswith('META-INF/'):
                continue
            
            # Injeta o novo classes.dex compilado
            if item.filename == 'classes.dex':
                zout.write('$TMP_DIR/classes.dex', 'classes.dex')
            # Injeta os ícones oficiais MediCare em alta definição
            elif item.filename in ['res/mipmap-mdpi-v4/ic_launcher.png', 'res/mipmap-mdpi-v4/ic_launcher_round.png']:
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

echo "=== [5/6] Gerando/Usando Keystore seguro de distribuição ==="
KEYSTORE="/tmp/medicare_permanent.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkey -v -keystore "$KEYSTORE" \
    -alias medicare \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass medicare123 \
    -keypass medicare123 \
    -dname "CN=MediCare Paciente, OU=Mobile, O=MediCare, L=SaoPaulo, ST=SP, C=BR" >/dev/null 2>&1
fi

echo "=== [6/6] Assinando com APK Signature Scheme v2 e v3 (Exigido pelo Android 14) ==="
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

echo "=== Validando integridade e assinaturas do APK ==="
apksigner verify --verbose "$TMP_DIR/final_signed.apk"

cp "$TMP_DIR/final_signed.apk" "$ROOT_DIR/medicare-patient.apk"
cp "$TMP_DIR/final_signed.apk" "$ROOT_DIR/public/medicare-patient.apk"
cp "$TMP_DIR/final_signed.apk" "$ROOT_DIR/public/medicare-patient-v2.4.apk"

echo "✓ SUCESSO: APK v2.4 atualizado e pronto para instalação!"

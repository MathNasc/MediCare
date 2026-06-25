# 📱 Como gerar o APK pelo PWABuilder — MediCare

## Pré-requisitos
- Deploy feito na Vercel com os arquivos deste pacote
- Site acessível em https://medicare-amber-five.vercel.app

---

## PASSO 1 — Verificar o PWA no Vercel

Acesse: https://medicare-amber-five.vercel.app

Abra o DevTools (F12) → Application → Manifest
Confirme que aparece:
- display: standalone ✓
- start_url: / ✓
- icons 192px e 512px ✓

---

## PASSO 2 — Gerar o APK no PWABuilder

1. Acesse https://www.pwabuilder.com
2. Cole a URL: https://medicare-amber-five.vercel.app
3. Clique em "Start"
4. Aguarde a análise (deve passar em todos os critérios)
5. Clique em "Package for stores"
6. Escolha "Android" → "Generate Package"
7. Preencha:
   - Package ID: com.medicare.app
   - App name: MediCare
   - Version: 1.0.0
   - Signing: selecione "Mine" e baixe o keystore gerado
8. Clique em "Generate"
9. Baixe o ZIP com o APK e o arquivo signing.json

---

## PASSO 3 — Obter o fingerprint SHA-256

Dentro do ZIP baixado, abra o arquivo:
  signing/signing-key-info.txt
  ou
  assetlinks.json (se já vier pronto)

Copie o valor do campo sha256_cert_fingerprints.

Exemplo de formato:
  AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78

---

## PASSO 4 — Atualizar o assetlinks.json no projeto

Abra o arquivo:
  public/.well-known/assetlinks.json

Substitua o valor placeholder:
  "COLE_AQUI_O_FINGERPRINT_DO_PWABUILDER"

Pelo fingerprint real copiado no passo anterior, MANTENDO as aspas:
  "AB:CD:EF:..."

Exemplo final:
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.medicare.app",
    "sha256_cert_fingerprints": [
      "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78"
    ]
  }
}

---

## PASSO 5 — Fazer novo deploy no Vercel

git add public/.well-known/assetlinks.json
git commit -m "fix: add assetlinks fingerprint for TWA"
git push

Aguarde o deploy completar.

---

## PASSO 6 — Verificar o assetlinks.json no ar

Acesse no navegador:
  https://medicare-amber-five.vercel.app/.well-known/assetlinks.json

Deve retornar o JSON com seu fingerprint (não pode dar 404).

---

## PASSO 7 — Instalar o APK

1. Transfira o APK para o celular Android
2. Ative "Fontes desconhecidas" nas configurações de segurança
3. Instale o APK
4. Abra o MediCare — deve abrir SEM barra do navegador

Se ainda aparecer a barra:
- O assetlinks.json ainda não propagou (aguarde alguns minutos)
- Verifique se o package_name no assetlinks.json bate com o do APK
- Verifique se o fingerprint está correto

---

## Por que isso funciona?

O PWABuilder gera uma TWA (Trusted Web Activity) — um Chrome sem interface
que carrega o seu site. A barra do navegador só some quando o Android verifica
que o domínio do site "confia" no APK, o que é feito via assetlinks.json.
Sem o fingerprint correto, o Chrome mostra a barra como medida de segurança.

---

## Estrutura de arquivos relevantes

public/
  manifest.json              ← Configuração do PWA
  sw.js                      ← Service Worker (cache + push)
  .well-known/
    assetlinks.json          ← Vincula o domínio ao APK (EDITAR com fingerprint)

next.config.js               ← Headers corretos para todos os arquivos acima

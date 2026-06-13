# 💊 MediCare — Controle de Medicamentos

Aplicativo mobile-first de gerenciamento de medicamentos com lembretes inteligentes, confirmação de doses, controle de estoque, análise por IA e modo cuidador.

**Stack:** Next.js 14 · React 18 · Supabase · Firebase FCM · PWA · Vercel

---

## 🚀 Deploy Rápido

```bash
git clone <repo>
cd medicare
npm install
cp .env.example .env.local   # preencher variáveis
npm run build
vercel --prod
```

---

## 📁 Estrutura

```
medicare/
├── public/
│   ├── sw.js                  # Service Worker (cache + push)
│   ├── manifest.json          # PWA manifest
│   ├── icon-*.png             # Ícones (72→512px)
│   ├── apple-touch-icon.png
│   └── favicon.ico
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql    # Schema completo + RLS
│
├── src/
│   ├── app/
│   │   ├── layout.jsx         # Root layout + SEO + PWA metadata
│   │   └── page.jsx           # Entry point + lazy loading + PWA install
│   │
│   ├── components/
│   │   ├── ui/                # Ring, Pill, Toasts
│   │   ├── modals/            # QuickConfirm, MedModal, MedDetail
│   │   ├── AuthScreen.jsx
│   │   ├── BottomNav.jsx
│   │   └── Dashboard.jsx      # NextDoseHero, DayProgress, Timeline, StockBar
│   │
│   ├── screens/               # HomeScreen, MedsScreen, StatsScreen, AIScreen, ProfileScreen
│   ├── context/AppContext.jsx # Estado global async (Supabase + localStorage)
│   ├── hooks/                 # useTheme, useFontScale, useToast, useNotifications
│   └── lib/
│       ├── db.js              # Unified DB (Supabase ou localStorage)
│       ├── supabase.js        # Supabase client + Auth + Meds + History + Caregivers
│       ├── firebase.js        # Firebase FCM + notificações locais
│       ├── doseUtils.js       # buildDoses, getDoseStatus, timeLabel
│       └── theme.js           # Design tokens
│
└── src/__tests__/             # Jest + RTL tests
```

---

## ⚙️ Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key

# Firebase FCM
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=projeto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BK_...

# App
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

> Sem Supabase/Firebase configurados o app funciona com **localStorage** (modo demo).

---

## 🗄️ Supabase — Setup

### 1. Criar projeto em [supabase.com](https://supabase.com)

### 2. Executar migration

```bash
# Copiar conteúdo de supabase/migrations/001_initial.sql
# Colar no SQL Editor do Supabase e executar
```

### 3. Configurar Storage

No painel Supabase → Storage → Criar bucket `documentos` (private).

### 4. Habilitar Auth providers

Authentication → Providers → Email ✓

---

## 🔔 Firebase FCM — Setup

### 1. Criar projeto em [console.firebase.google.com](https://console.firebase.google.com)

### 2. Registrar Web App e copiar `firebaseConfig`

### 3. Gerar VAPID key

Project Settings → Cloud Messaging → Web Push Certificates → Generate Key Pair

### 4. Fluxo de notificações

```
Horário programado (buildDoses)
        ↓
  sendLocalNotification()    ← via SW (foreground + background)
        ↓
  Usuário não responde?
        ↓
  +15 min → nova notificação
        ↓
  +30 min → nova notificação
        ↓
  +60 min → dose marcada como "late"
        ↓
  +30 min adicionais → alertCaregiver()
```

---

## 👨‍👩‍👧 Modo Cuidador

O cuidador é convidado pelo paciente (email). Após aceitar:
- Visualiza medicamentos e histórico (somente leitura)
- Recebe alertas quando o paciente atrasa > 30 min
- Dashboard com taxa de adesão e últimas doses

---

## 📱 Instalar como PWA (Android)

1. Acesse o app no Chrome
2. Menu → **"Adicionar à tela inicial"**
3. O banner de instalação também aparece automaticamente

---

## 🧪 Testes

```bash
npm test                  # run all tests
npm run test:coverage     # com relatório de cobertura
```

Arquivos de teste em `src/__tests__/`:
- `doseUtils.test.js`     — lógica de doses e status
- `QuickConfirm.test.jsx` — componente modal de confirmação
- `AppContext.test.jsx`   — estado global

---

## 🚀 Deploy na Vercel

### Via CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Via GitHub
1. Push para GitHub
2. [vercel.com/new](https://vercel.com/new) → importar repo
3. Adicionar variáveis de ambiente
4. Deploy automático

### Configurar variáveis na Vercel
Dashboard → Settings → Environment Variables → colar as do `.env.example`

---

## 🛠️ Scripts

```bash
npm run dev      # desenvolvimento (localhost:3000)
npm run build    # build de produção
npm run start    # rodar build localmente
npm run lint     # verificar código
npm test         # testes
```

---

## ♿ Acessibilidade

- Toque mínimo 44×44px em todos os controles
- `aria-label` em botões icônicos
- `role` e `aria-pressed` em toggles
- `aria-current="page"` na navegação
- Foco visível com outline azul
- Navegação por teclado (Tab + Enter + Space)
- Tamanho de fonte ajustável (Normal / Grande / Maior)
- Alto contraste (WCAG AA mínimo)

---

## 📦 Dependências principais

| Pacote               | Uso                              |
|----------------------|----------------------------------|
| next@14              | Framework React SSR/SSG          |
| react@18             | UI library                       |
| @supabase/supabase-js| Auth + Database + Storage        |
| firebase             | Push notifications (FCM)         |
| date-fns             | Manipulação de datas             |


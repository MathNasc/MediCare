# 💊 MediCare — Controle Inteligente de Saúde e Medicamentos

O **MediCare** é um ecossistema completo e intuitivo para o gerenciamento de saúde, focado no controle rigoroso da adesão medicamentosa. Composto por um aplicativo **Android nativo (`MediCare-Paciente.apk`)** e uma plataforma **Web/PWA**, ele oferece notificações inteligentes, acompanhamento de estoque, agendas médicas e uma estrutura dupla de perfis para **Pacientes** e **Cuidadores** integrada ao **PostgreSQL na Oracle Cloud**.

---

## ✨ Principais Funcionalidades

- 🧑‍🤝‍🧑 **Perfis de Usuário & Modo Cuidador:**
  - **Pacientes:** Controle total sobre os próprios medicamentos, eventos, cartão de emergência e histórico de saúde.
  - **Cuidadores:** Módulo seguro de delegação. O cuidador (após aceitar um convite) recebe uma visão em tempo real da aderência do paciente, podendo registrar doses retroativamente em nome do paciente caso este se esqueça de usar o aplicativo.
- 💊 **Gestão de Tratamentos Completa:**
  - **Uso Contínuo:** Para tratamentos sem data de término.
  - **Uso Temporário:** Definição de data de início e duração em dias. A prescrição encerra automaticamente ao fim do período e vai para o histórico.
  - **Sob Demanda (SOS):** Medicamentos para controle de sintomas pontuais, registrados no momento do uso, sem interferir na adesão calculada do paciente.
- 📅 **Controle de Eventos, Notas e Consultas:**
  - Lembretes agendados para consultas médicas, exames, anotações diárias e reabastecimentos de estoque.
- 🔔 **Notificações Confiáveis (AlarmManager Android & Web Push):**
  - **Android Nativo:** Utiliza `AlarmManager.setExactAndAllowWhileIdle` com som, vibração e repetição automática a cada 15 minutos até a confirmação.
  - **Web Push:** Integração via VAPID Push API com worker agendado a cada minuto no servidor Oracle Cloud (`/api/v1/jobs/reminders`).
  - Alertas escalonados (Hora da dose, +10min, +20min) e Alerta de Estoque Baixo (quando ≤ 5 unidades).
- 📊 **Dashboard & Adesão:**
  - Acompanhamento diário e mensal de aderência ao tratamento, visualização em timeline e registro detalhado de sintomas.
- 🔐 **Segurança e Privacidade:**
  - Arquitetura segura com autenticação JWT/Sessão própria e banco de dados PostgreSQL isolado na Oracle Cloud (`medicare_db`), com rastreabilidade completa (Audit Logs).

---

## 🛠️ Stack Tecnológica

- **App Android Nativo:** Java/Android SDK (`src-apk/`), APK compilado na raiz (`MediCare-Paciente.apk`)
- **Front-end Web:** Next.js 14, React 18
- **Estilização:** Tailwind CSS, PostCSS, Componentes customizados
- **Backend & Database:** Next.js API Routes + PostgreSQL 16 (Oracle Cloud)
- **Autenticação:** Auth Service nativo (`/api/auth/v1/*` com `pgcrypto` bcrypt)
- **Notificações:** Android `AlarmManager` + Web Push API (VAPID) + Service Workers (`sw.js`)

---

## 🚀 Como Executar o Projeto Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/en/) (Versão 18+)
- Banco de dados PostgreSQL configurado (local ou servidor Oracle Cloud)

### 2. Instalação

```bash
git clone <url-do-repositorio> medicare
cd medicare
npm install
```

### 3. Variáveis de Ambiente

Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env.local
```

Configure a conexão com o PostgreSQL no arquivo `.env.local`:

```env
DATABASE_URL=postgresql://medicare_app:sua_senha@127.0.0.1:5436/medicare_db
NEXT_PUBLIC_VAPID_PUBLIC_KEY=sua-chave-publica-vapid
GEMINI_API_KEY=sua-chave-gemini
```

### 4. Executando o App Localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 📱 Aplicativo Android (`MediCare-Paciente.apk`)

O instalador atualizado do aplicativo Android fica disponível diretamente na raiz do repositório:
- **Arquivo:** `/MediCare-Paciente.apk`
- **Script de compilação e assinatura automática:**
  ```bash
  bash scripts/rebuild_and_sign_apk.sh
  ```

---

## 🧪 Testes Unitários

O projeto utiliza o Jest. Para executar a suíte de testes de regras de negócios:

```bash
npm run test
npm run test:coverage
```

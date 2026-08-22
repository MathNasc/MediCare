# 💊 MediCare — Controle Inteligente de Saúde e Medicamentos

O **MediCare** é um aplicativo mobile-first completo e intuitivo para o gerenciamento de saúde, focado no controle rigoroso da adesão medicamentosa. Projetado como um PWA (Progressive Web App) moderno, ele oferece notificações inteligentes, acompanhamento de estoque, agendas médicas e uma estrutura dupla de perfis para **Pacientes** e **Cuidadores**.

---

## ✨ Principais Funcionalidades

- 🧑‍🤝‍🧑 **Perfis de Usuário & Modo Cuidador:**
  - **Pacientes:** Controle total sobre os próprios medicamentos, eventos e histórico de saúde.
  - **Cuidadores:** Módulo seguro de delegação. O cuidador (após aceitar um convite) recebe uma visão em tempo real da aderência do paciente, podendo registrar doses retroativamente em nome do paciente caso este se esqueça de usar o aplicativo.
- 💊 **Gestão de Tratamentos Completa:**
  - **Uso Contínuo:** Para tratamentos sem data de término.
  - **Uso Temporário:** Definição de data de início e fim. A prescrição encerra automaticamente e some da agenda ativa, indo para o histórico.
  - **Sob Demanda (SOS):** Medicamentos para controle de sintomas pontuais, registrados no momento do uso, sem interferir na adesão calculada do paciente.
- 📅 **Controle de Eventos e Consultas:**
  - Lembretes agendados para consultas médicas, exames e reabastecimentos de estoque.
- 🔔 **Notificações Push Confiáveis (Web Push & Supabase Edge Functions):**
  - Integração robusta via VAPID Push API.
  - **Background Worker:** Lembretes disparados pontualmente através de rotinas agendadas (pg_cron) executadas diretamente no servidor (Supabase Edge Functions). O alerta chega mesmo com o aplicativo fechado!
  - Alertas escalonados (Hora da dose, +10min, +20min) e Alerta de Estoque Baixo (quando ≤ 5 unidades).
- 📊 **Dashboard & Adesão:**
  - Acompanhamento diário e mensal de aderência ao tratamento, visualização em timeline e registro detalhado de sintomas.
- 🔐 **Segurança e Privacidade:**
  - Arquitetura segura via **Row Level Security (RLS)** do Supabase. O banco de dados só retorna os dados que pertencem ao usuário logado ou ao seu cuidador autorizado. Todo o histórico possui rastreabilidade (Audit Logs).

---

## 🛠️ Stack Tecnológica

- **Front-end:** Next.js 14, React 18
- **Estilização:** Tailwind CSS, PostCSS, Componentes customizados
- **Backend & Database:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth (Email/Senha)
- **Notificações:** Web Push API (VAPID), Service Workers (`sw.js`) e Supabase Edge Functions (`Deno`)
- **Agendamento:** `pg_cron` (PostgreSQL)
- **Infraestrutura UI:** PWA configurado nativamente (Manifest, Add to Home Screen)

---

## 🚀 Como Executar o Projeto Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/en/) (Versão 18+)
- Conta no [Supabase](https://supabase.com/)

### 2. Instalação

```bash
# Clone o repositório
git clone <url-do-repositorio> medicare
cd medicare

# Instale as dependências
npm install
```

### 3. Variáveis de Ambiente

Renomeie ou copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env.local
```

Preencha o arquivo `.env.local` com as chaves do seu projeto Supabase e de Push VAPID:

```env
# Supabase - Configuração Padrão
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui

# VAPID Keys - Para notificações Web Push (Crie suas chaves usando o pacote web-push)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=sua-chave-publica-vapid
```

### 4. Executando o App Localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador. 

*(Recomendamos testar em navegadores que suportam Service Workers e Notificações Push, como Chrome, Edge ou Safari).*

---

## 🗄️ Setup do Supabase (Banco de Dados & Backend)

Para o aplicativo funcionar perfeitamente em produção, você precisará configurar as tabelas e rotinas no seu projeto Supabase.

### 1. Executar as Migrations
No painel do seu projeto no Supabase, acesse o **SQL Editor** e execute os arquivos `.sql` presentes na pasta `supabase/migrations/` em ordem, ou cole todo o seu schema caso possua um dump completo unificado.
Esses arquivos criarão as tabelas de `profiles`, `medicamentos`, `historico_doses`, configuração da extensão `pg_cron`, entre outras tabelas e *Policies (RLS)* vitais para a segurança.

### 2. Deploy da Edge Function (Notificações)
Para que os lembretes cheguem quando o aplicativo estiver fechado, faça o deploy da função `send-medication-reminders`.

- Instale o Supabase CLI: `npm install -g supabase`
- Faça login: `supabase login`
- Vincule ao seu projeto: `supabase link --project-ref seu-projeto-ref`
- Implante a função e configure os segredos do servidor:

```bash
# Configure as variáveis que a Edge Function precisa para disparar as notificações (Deno Runtime)
supabase secrets set VAPID_PUBLIC_KEY=sua-chave-publica
supabase secrets set VAPID_PRIVATE_KEY=sua-chave-privada

# O SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY geralmente são injetados sozinhos ou podem ser definidos manualmente
supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-secreta

# Faça o deploy da função
supabase functions deploy send-medication-reminders
```

### 3. Habilitando a rotina de envio (Cron Job)
A função do Supabase precisa ser acionada todo minuto para checar pendências. Execute o script contido em `supabase/migrations/003_fcm_cron.sql` (agora adaptado para Web Push) no seu SQL Editor, substituindo a URL do seu projeto. O cron utilizará o `net.http_post` para acionar a função de notificações a cada 60 segundos.

---

## 📱 PWA — Experiência Nativa

O MediCare foi desenhado para ser Instalado:
1. Acesse o endereço web no seu celular (Android/iOS).
2. O aplicativo sugerirá **"Adicionar à Tela Inicial"**.
3. A partir desse momento, ele rodará sem as barras do navegador, abrirá rapidamente utilizando cache local e suportará totalmente as Notificações Push no sistema operacional.

---

## 🧪 Testes Unitários

O projeto utiliza o Jest. Para executar a suíte de testes de regras de negócios:

```bash
npm run test
npm run test:coverage # Gera o relatório de cobertura de testes
```

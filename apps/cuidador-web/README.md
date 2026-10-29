# MediCare Cuidador Web — Fundação Técnica (Etapa 2)

O **MediCare Cuidador** é a aplicação web progressiva (PWA) e responsiva dedicada a familiares e cuidadores para supervisão do tratamento de saúde e controle de administrações medicamentosas.

---

## 🛠️ Stack Tecnológica Escolhida

- **Framework:** React 18 com TypeScript
- **Bundler & Build Tool:** Vite
- **Estilização:** Tailwind CSS (tema escuro de alto contraste)
- **Ícones:** Lucide React
- **Navegação:** Padrão adaptativo (Barra inferior em mobile, Sidebar expansível em desktop)
- **API & Estado Assíncrono:** Cliente HTTP centralizado com gestão de tokens e sessões compatível com o backend PostgreSQL na Oracle Cloud

---

## 📂 Estrutura de Código

```text
apps/cuidador-web/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── App.tsx          # Componente principal e orquestrador de telas
│   ├── components/
│   │   └── Navigation.tsx   # Navegação responsiva (Mobile Bottom Bar + Desktop Sidebar)
│   ├── features/
│   │   ├── auth/            # Contexto de autenticação, sessão e tela de login
│   │   ├── dashboard/       # Central de atividades do dia e linha do tempo de doses
│   │   ├── patients/        # Lista, busca e perfil de pacientes acompanhados
│   │   ├── agenda/          # Consultas, exames e compromissos clínicos
│   │   └── reports/         # Indicadores oficiais de adesão e auditoria
│   ├── lib/
│   │   └── apiClient.ts     # Cliente de API com token Bearer e tratamento de 401
│   ├── types/
│   │   └── index.ts         # Tipagens TypeScript do domínio
│   ├── styles/
│   │   └── index.css        # Estilos base
│   └── main.tsx             # Ponto de entrada React
├── tests/
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Como Executar

Dentro do diretório `apps/cuidador-web`:

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 3001)
npm run dev

# Compilar para produção
npm run build
```

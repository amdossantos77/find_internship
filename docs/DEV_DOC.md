# 💻 Guia do Desenvolvedor - Find Internship

Este documento detalha a infraestrutura técnica, arquitetura de código e o pipeline de deploy do projeto.

---

## 🏗️ 1. Visão Geral da Arquitetura

O projeto é dividido em uma arquitetura moderna de microserviços/front-back desacoplado:

- **Frontend:** Single Page Application (SPA) construída com React e Vite.
- **Backend:** API REST robusta construída com NestJS.
- **Base de Dados:** Instância Gerida PostgreSQL no Supabase.
- **Notificações:** Integração com Resend para e-mails transacionais.

---

## 🌐 2. Infraestrutura e Deploy

O projeto está configurado para Continuous Deployment (CD) nos seguintes serviços (conforme evidências do dashboard):

- **Backend (Render):** O serviço de API corre no Render.
  - O backend gere a autenticação OAuth com a 42 e os Cron Jobs de sincronização.
  - Configurado com IPv4 forçado para evitar falhas de rede na comunicação com a Intra.
- **Frontend (Vercel):** Hospedagem da interface React.
  - Utiliza variáveis de ambiente (`VITE_API_URL`) para comunicar com o backend no Render.
- **Database & Storage (Supabase):**
  - Tabela `app_users`: Perfis, filtros (JSONB) e estado de notificações.
  - Tabela `internship_offers`: Cache local das vagas buscadas.
  - Tabela `notified_offers`: Registo de e-mails enviados para prevenir duplicados.

---

## 🛠️ 3. Lógica de Negócio Detalhada

### Sincronização de Vagas (Cron Job)
A cada hora, o `AppService` executa um scan na API da 42.
1. Obtém um token de `client_credentials`.
2. Itera pelas páginas de vagas da Intra (limitado a 10 páginas para performance).
3. Efetua um `upsert` na tabela do Supabase.

### Motor de Notificações
Localizado no `NotificationsService`, o motor de alertas:
1. Identifica utilizadores com `notifications_enabled = true`.
2. Para cada utilizador, compara a lista de alertas (`filters`) com as vagas novas dos últimos 7 dias.
3. Se houver um *match* (lógica OR entre filtros, AND dentro do filtro), dispara o e-mail via Resend.
4. Regista o envio na tabela `notified_offers`.

### Filtro Inteligente de Skills
Em vez de uma busca por string exata, o sistema utiliza um dicionário de keywords (ex: `python` mapeia para `django, flask, ai, pandas`). Isto garante que o utilizador não perca vagas relevantes por nuances de nomenclatura.

---

## 🔒 4. Autenticação e Segurança

- **OAuth 2.0:** O fluxo de login é gerido pelo backend, que troca o `code` da 42 por um perfil de utilizador.
- **JWT:** A comunicação Frontend -> Backend é protegida por tokens JWT com validade definida.
- **CORS:** O backend está configurado para aceitar apenas pedidos da origem do frontend (Vercel).

---

## 🚀 5. Setup Local

1. **Backend:**
   ```bash
   cd backend && npm install
   # Necessário .env com: API_42_UID, API_42_SECRET, SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY
   npm run start:dev
   ```

2. **Frontend:**
   ```bash
   cd frontend && npm install
   # Necessário .env com: VITE_API_URL
   npm run dev
   ```

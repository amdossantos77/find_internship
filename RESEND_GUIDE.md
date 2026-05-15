# Guia de Configuração de E-mail (Resend)

Este projeto utiliza o **Resend** para envio de notificações, superando as limitações de SMTP no ambiente Render.

## 1. Estado Atual (Modo Onboarding)
Atualmente, o sistema está configurado para usar o e-mail de teste do Resend:
- **Remetente:** `onboarding@resend.dev`
- **Limitação:** Só podes enviar e-mails para o endereço que usaste para criar a conta no Resend.

## 2. Como permitir o envio para todos os utilizadores
Para que qualquer estudante que faça login receba notificações, precisas de verificar um domínio próprio.

### Passo 1: Adicionar Domínio no Resend
1. Acede a [Resend Domains](https://resend.com/domains).
2. Clica em **"Add Domain"**.
3. Introduz o teu domínio (ex: `meuprojeto.com`).
4. Escolhe a região (preferencialmente `us-east-1` ou a mais próxima do teu servidor).

### Passo 2: Configurar DNS
O Resend vai gerar registos DNS (tipo TXT e MX). Precisas de ir ao painel do teu fornecedor de domínio (ex: Cloudflare, GoDaddy, Namecheap) e adicionar esses registos.

### Passo 3: Atualizar o Código
Depois de o domínio aparecer como **"Verified"** no Resend, abre o ficheiro:
`backend/src/notifications/notifications.service.ts`

E altera os campos `from` nas funções `sendStatusEmail` e `sendEmail`:

```typescript
// De:
from: 'Find Internship <onboarding@resend.dev>',

// Para (exemplo):
from: 'Notificações <vagas@teudominio.com>',
```

## 3. Variáveis de Ambiente
Certifica-te que o Render tem sempre a variável:
- `RESEND_API_KEY`: A tua chave `re_...`

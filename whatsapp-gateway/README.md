# Alavanch WhatsApp Gateway

Gateway Node.js + Baileys que mantém sessões WhatsApp Web persistentes (QR Code), envia mensagens, recebe eventos e os encaminha para o ERP via webhook.

> ⚠️ **Modo experimental / não oficial.** WhatsApp Web pode sincronizar conversas recentes disponíveis no dispositivo vinculado, mas não garante histórico completo antigo. Para operação oficial em produção, use a Cloud API.

## Por que existir

As Supabase Edge Functions (Deno) são stateless e não conseguem manter o WebSocket persistente que o WhatsApp Web exige. Este gateway resolve isso rodando em um servidor Node 20 com volume persistente para as credenciais Baileys.

## Pré-requisitos

- Node.js 20+
- Volume persistente (Render Disk, Railway Volume, EBS) para `./sessions/`
- Secret compartilhado com as Edge Functions Supabase (`WHATSAPP_GATEWAY_SECRET`)

## Variáveis de ambiente

| Nome | Descrição |
|------|-----------|
| `WHATSAPP_GATEWAY_SECRET` | Segredo do header `x-whatsapp-api-secret`. Mesmo valor configurado no Supabase. |
| `PORT` | Porta HTTP (padrão `8788`). |
| `SESSIONS_DIR` | Diretório de credenciais Baileys. Aponte para volume persistente. |
| `SUPABASE_WEBHOOK_URL` | URL da edge function `whatsapp-webhook`. |
| `SUPABASE_WEBHOOK_SECRET` | Segredo enviado no header `x-whatsapp-webhook-secret`. |

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Healthcheck público |
| POST | `/sessions/start` | Inicia sessão / gera QR. Body: `{ conta_id, loja_id }` |
| GET | `/sessions/status?conta_id=...` | Status atual |
| POST | `/sessions/stop` | Faz logout. Body: `{ conta_id }` |
| POST | `/messages/send` | Envia texto. Body: `{ conta_id, to, text }` |
| POST | `/history/sync` | Marca pedido de sync. Mensagens chegam via webhook. |
| GET | `/sessions` | Lista sessões em memória (diagnóstico) |

Todos os endpoints (exceto `/health`) exigem o header `x-whatsapp-api-secret`.

## Desenvolvimento local

```bash
cp .env.example .env
npm install
npm run dev
```

## Deploy

### Render
1. Novo Web Service → repositório → diretório `whatsapp-gateway/`
2. Build: `npm install && npm run build`
3. Start: `npm run start:prod`
4. Adicione um **Disk** montado em `/opt/render/project/src/whatsapp-gateway/sessions`
5. Configure as variáveis acima

### Railway
1. Novo serviço → diretório `whatsapp-gateway/`
2. Volume montado em `/app/sessions`
3. Configure as variáveis

### VPS
- Use PM2 + Nginx (TLS). Garanta que `SESSIONS_DIR` aponte para diretório com backup.

## Após o deploy

1. Copie a URL pública (ex.: `https://wa-gateway.exemplo.com`).
2. No Supabase, atualize os secrets:
   - `WHATSAPP_GATEWAY_URL` → URL pública
   - `WHATSAPP_GATEWAY_SECRET` → mesmo valor configurado aqui
3. No ERP, vá em **WhatsApp → Configurações → Conectar via WhatsApp Web**.
4. Clique em **Gerar QR Code** e escaneie pelo celular.

## Segurança

- Credenciais Baileys NUNCA trafegam pelo frontend.
- Logs mascaram QR, tokens e senhas.
- Use HTTPS sempre.
- Restrinja o gateway ao IP do Supabase quando possível.

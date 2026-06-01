# Alavanch — Fiscal Gateway mTLS

Serviço Node.js dedicado a transmitir SOAP NF-e (modelo 55) para a SEFAZ
em **homologação** usando certificado digital A1 no handshake TLS (mTLS).
É chamado pela Supabase Edge Function `fiscal-nfe-emitir` porque o runtime
Deno das Edge Functions **não** permite anexar certificado cliente no `fetch`.

> ⚠️ Este gateway **NUNCA** persiste PFX ou senha. O material sensível existe
> apenas em memória durante a requisição e é descartado ao fim.

---

## Arquitetura

```
Frontend Alavanch
   │  (sem certificado)
   ▼
Supabase Edge Function: fiscal-nfe-emitir
   │  monta XML → assina → valida
   │  POST JSON (HTTPS + x-fiscal-api-secret)
   ▼
fiscal-gateway (este serviço)
   │  extrai PFX em memória (node-forge)
   │  abre HTTPS com undici.Agent { cert, key, ca }
   ▼
SEFAZ (homologação)
   │  retorno SOAP
   ▼
Edge Function atualiza nota / eventos / storage
```

---

## Endpoints

Todos exigem header `x-fiscal-api-secret: $FISCAL_GATEWAY_SECRET`.

- `GET  /health` — sem auth
- `POST /nfe/enviar-lote`
- `POST /nfe/consultar-recibo`

### Body `/nfe/enviar-lote`

```json
{
  "uf": "SP",
  "ambiente": "homologacao",
  "endpoint": "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
  "soapAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
  "envelope": "<?xml ... >",
  "xmlNFeAssinada": "<NFe>...</NFe>",
  "idLote": "1700000000001",
  "pfxBase64": "MIIK...",
  "senha": "***"
}
```

Resposta:

```json
{ "ok": true, "httpStatus": 200, "xmlRetornoBruto": "<?xml ...>" }
```

---

## Variáveis de ambiente

Veja `.env.example`:

- `FISCAL_GATEWAY_SECRET` (**obrigatório**) — secret compartilhado com a Edge Function
- `NODE_ENV` — `development` | `production`
- `PORT` — porta HTTP (padrão `8787`)
- `SEFAZ_TIMEOUT_MS` — timeout das chamadas SEFAZ (padrão `30000`)
- `SEFAZ_INSECURE_TLS` — `1` para tolerar cadeia incompleta em homologação (NÃO usar em produção)

---

## Rodar local

```bash
cd fiscal-gateway
cp .env.example .env
# edite FISCAL_GATEWAY_SECRET
npm install      # ou pnpm install / bun install
npm run dev
```

Healthcheck:

```bash
curl -fsS http://localhost:8787/health
```

Teste rápido (mock — endpoint inválido só para validar auth):

```bash
curl -sS -X POST http://localhost:8787/nfe/enviar-lote \
  -H "Content-Type: application/json" \
  -H "x-fiscal-api-secret: $FISCAL_GATEWAY_SECRET" \
  -d '{"uf":"SP","ambiente":"homologacao","endpoint":"https://invalid","soapAction":"x","envelope":"<x/>","xmlNFeAssinada":"<x/>","idLote":"1","pfxBase64":"","senha":""}'
```

---

## Deploy

### Render (recomendado para começar)

1. Criar **Web Service** apontando para a pasta `fiscal-gateway/`.
2. Build command: `npm install && npm run build`
3. Start command: `node dist/index.js`
4. Adicionar env vars (`FISCAL_GATEWAY_SECRET`, `NODE_ENV=production`).
5. Anotar a URL pública (ex.: `https://alavanch-fiscal-gateway.onrender.com`).

### Railway

1. Novo serviço a partir do repo, root `fiscal-gateway`.
2. Adicionar variáveis de ambiente.
3. `npm run build && npm run start:prod`.

### VPS (Docker simples)

```bash
docker run -d --name fiscal-gateway \
  -p 8787:8787 \
  -e FISCAL_GATEWAY_SECRET=*** \
  -e NODE_ENV=production \
  node:20-alpine sh -c "git clone ... /app && cd /app/fiscal-gateway && npm install && npm run build && node dist/index.js"
```

(Adapte conforme sua pipeline.)

---

## Conectando à Supabase Edge Function

Na configuração de secrets do projeto Lovable Cloud, definir:

- `FISCAL_GATEWAY_URL` — ex.: `https://alavanch-fiscal-gateway.onrender.com`
- `FISCAL_GATEWAY_SECRET` — mesmo valor configurado no gateway

A Edge Function `fiscal-nfe-emitir` passa a chamar o gateway automaticamente.
Sem essas variáveis, ela retorna **erro_transmissao** com a mensagem
`Gateway fiscal mTLS não configurado` — comportamento controlado.

---

## Segurança

- Autenticação por `x-fiscal-api-secret` (constante por instalação).
- PFX e senha **somente em memória**, descartados ao fim da requisição.
- Logs estruturados em JSON com mascaramento de campos sensíveis
  (`pfxBase64`, `senha`, XML truncado para tamanho).
- TLS verificado por padrão (`rejectUnauthorized=true`).
- Bloqueia explicitamente `ambiente=producao` nesta fase.

---

## Limitações desta fase

- Apenas NF-e modelo 55 em **homologação**.
- `/nfe/consultar-recibo` envia o envelope que a Edge Function montar — polling
  e cancelamento serão tratados em fases futuras.
- NFS-e, NFC-e e produção **fora de escopo**.

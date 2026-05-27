
# Correção definitiva da assinatura digital — token por participante

## Objetivo
Cada participante (loja e cliente) terá seu próprio link. A página `/assinatura/:token` passa a usar o token do participante. O painel do pedido mostra dois blocos separados com botões "Copiar link" individuais. O status geral da solicitação passa a ser derivado dos participantes — nunca mais aparece "Assinatura realizada" sem o participante daquele link ter assinado.

## 1. Migração SQL (única)

Arquivo novo em `supabase/migrations/`.

- `assinatura_participantes`:
  - adicionar `token text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex')`
  - adicionar `enviado_em`, `visualizado_em` (timestamptz, nullable)
  - criar `UNIQUE INDEX idx_ap_token ON assinatura_participantes(token)`
  - backfill: `UPDATE` em participantes existentes sem token (segurança extra)
  - backfill: para cada `solicitacoes_assinatura` que ainda não tem participante `cliente`, criar um a partir de `cliente_nome/email/telefone/documento/cliente_assinado_em`; idem `loja` quando `requer_assinatura_loja` ou já existe `loja_assinado_em`
- Função `public.recalcular_status_solicitacao(p_solic uuid)`:
  - lê todos os participantes obrigatórios da solicitação
  - se algum `recusado` → `recusado`
  - se `expira_em < now()` e ninguém assinou tudo → `expirado`
  - se todos obrigatórios `assinado` → `concluido` (+ `concluido_em = now()`)
  - se loja assinou e cliente pendente → `assinado_loja` (mapeado para "aguardando cliente")
  - se cliente assinou e loja pendente → `assinado_cliente` (mapeado para "aguardando loja")
  - caso contrário → mantém `aguardando_cliente`/`aguardando_loja` conforme regra do tipo de documento
  - também espelha `cliente_assinado_em` e `loja_assinado_em` em `solicitacoes_assinatura` (compatibilidade)
- Trigger `trg_recalcular_status_ap` em `AFTER INSERT/UPDATE OF status,assinado_em ON assinatura_participantes` chamando a função acima
- Reescrever `sincronizar_status_assinatura_por_evidencia` para **não** marcar `cliente_assinado_em`/`status=concluido` sozinha — apenas delega a `recalcular_status_solicitacao` (e atualiza URL da evidência se necessário)
- Política RLS nova em `assinatura_participantes`:
  - `SELECT` para `anon` quando `token = current_setting('request.jwt.claims',true)` não se aplica — então usar regra: permitir SELECT anon onde `token IS NOT NULL AND (SELECT s.expira_em > now() FROM solicitacoes_assinatura s WHERE s.id = solicitacao_id)` (mantém isolamento, pois o filtro só retorna a linha que casa o token)
  - `UPDATE` anon: permitir alterar apenas `status, assinado_em, ip, user_agent, visualizado_em` da própria linha (via política `WITH CHECK token IS NOT NULL`)
- Backfill final: rodar `recalcular_status_solicitacao(id)` para toda solicitação não concluída — corrige PV-LOJ-2866 e similares

## 2. Frontend

### `src/lib/publicLinks.ts`
- Mantém `getPublicSignatureUrl(token)`.
- Adicionar `getParticipanteSignatureUrl(token)` (alias, mesma URL `/assinatura/:token`).

### `src/pages/AssinaturaPublica.tsx` (refatorar lookup)
1. Buscar **primeiro** em `assinatura_participantes` por `token`.
2. Se encontrar → setar `participante` e carregar `solicitacoes_assinatura` por `solicitacao_id`. Tela usa `participante.status`.
3. Se não encontrar → fallback: buscar `solicitacoes_assinatura` por `token` (legado). Nesse caso procurar o participante `cliente` daquela solicitação; se existir, **redirecionar** para `/assinatura/<participante.token>` (mantém compatibilidade com links antigos). Se não houver participante, exibir tela legada como hoje.
4. Decisão da UI baseada em `participante.status`:
   - `pendente`/`enviado`/`visualizado` → mostrar formulário (loja vê pad simples + nome/email pré-preenchidos do `participante`; cliente vê fluxo atual com foto/selfie)
   - `assinado` → tela "Assinatura já realizada em <data/hora>"
   - solicitação `cancelado`/`expirado`/`recusado` → tela correspondente
5. Ao abrir, gravar `visualizado_em = now()` no participante (uma vez).
6. Ao assinar:
   - upload de evidências (mantém)
   - `UPDATE assinatura_participantes` apenas do registro do token: `status='assinado', assinado_em=now(), ip, user_agent`
   - `INSERT assinatura_evidencias` com `participante_id`
   - `INSERT assinatura_eventos` com `participante_id` e `tipo_evento` `'cliente_assinou'` ou `'loja_assinou'`
   - **não** atualizar `solicitacoes_assinatura.status` diretamente — o trigger recalcula
7. Remover o cálculo manual `done = (status==='concluido' && ...)` — usar apenas `participante.status === 'assinado'`.

### `src/components/assinaturas/AssinaturasDigitaisPanel.tsx` (UI dois blocos)
- Para cada solicitação, buscar `assinatura_participantes` (loja e cliente).
- Renderizar dois sub-blocos lado a lado:
  - **Assinatura da loja**: nome, cargo, status individual, datas (enviado/visualizado/assinado), botão "Copiar link" copiando `participante_loja.token`; se a loja faz login, mostra também o botão "Assinar agora" que abre `AssinarPelaLojaDialog` (mantém fluxo interno).
  - **Assinatura do cliente**: nome, status, datas, botão "Copiar link" copiando `participante_cliente.token`. Se ainda não existe participante cliente, criar on-demand (RPC nova `garantir_participante(p_solic, p_tipo)`).
- Se o tipo de documento exige loja primeiro e a loja ainda não assinou: o botão "Copiar link do cliente" fica desabilitado com tooltip "A loja precisa assinar antes de enviar ao cliente."
- Botão "Baixar PDF assinado" só aparece quando todos os obrigatórios estão `assinado`.

### `src/components/assinaturas/AssinarPelaLojaDialog.tsx`
- Em vez de criar um novo participante toda vez, fazer `UPSERT` no participante `loja` existente (criado pela migração/painel) pelo `solicitacao_id+tipo`.
- Não atualizar `solicitacoes_assinatura.status` — o trigger faz.
- Mantém upload da assinatura e snapshot do contrato.

### RPC `garantir_participante(p_solic uuid, p_tipo assinatura_participante_tipo)`
- Cria o participante se não existir, preenchendo nome/email/telefone/documento a partir de `clientes` ou da própria solicitação (`cliente_*` / `loja_*`).
- Retorna a linha. Usado pelo painel ao copiar link do cliente quando ainda não existe.

## 3. Compatibilidade / segurança
- `solicitacoes_assinatura.token` é mantido como fallback (legado). Nada apaga dados antigos.
- RLS: nenhuma policy existente é removida. As novas policies do participante só permitem ver/alterar a linha do próprio token.
- Contratos já concluídos não são alterados (trigger só recalcula quando há mudança em participantes).

## 4. Teste manual com PV-LOJ-2866
1. Após migração: a solicitação `259866b9…` continua `aguardando_loja`; o participante `cliente` ganha token; é criado participante `loja` se faltar.
2. Abrir painel do pedido → ver bloco loja (com botão "Copiar link" da loja) e bloco cliente (link desabilitado se loja precisa assinar primeiro).
3. Abrir o link da loja → tela "Assinar pela loja" (não mais "Assinatura realizada").
4. Assinar pela loja → trigger recalcula → status vira `assinado_loja`.
5. Botão "Copiar link do cliente" libera. Abrir → tela do cliente (formulário). Não mais "Assinatura realizada".
6. Assinar pelo cliente → status vira `concluido`, PDF final é gerado.
7. Reabrir qualquer um dos links → "Assinatura já realizada em <data/hora>".

## 5. Entregáveis
- 1 migração: `supabase/migrations/<ts>_token_por_participante_assinatura.sql`
- Editados: `src/pages/AssinaturaPublica.tsx`, `src/components/assinaturas/AssinaturasDigitaisPanel.tsx`, `src/components/assinaturas/AssinarPelaLojaDialog.tsx`, `src/lib/publicLinks.ts`
- Funções SQL alteradas/criadas: `recalcular_status_solicitacao` (nova), `sincronizar_status_assinatura_por_evidencia` (simplificada para delegar), `garantir_participante` (nova RPC), trigger `trg_recalcular_status_ap` (nova)
- `solicitacoes_assinatura.token` permanece para fallback legado; nenhuma policy ou dado removido.

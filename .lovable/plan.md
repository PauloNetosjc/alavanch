# Módulo de Assinatura Digital Externa

Cria um módulo unificado para gerar, enviar e auditar assinaturas digitais de qualquer documento vinculado a um pedido (Contrato, Adendo, Complemento, Projeto Inicial, PDF Final, Vistoria), reusando o que já existe (`contratos`, `pedido_documentos`) e adicionando estrutura nova para tornar o fluxo padronizado.

## Escopo do que vai ser construído

### 1. Banco de dados (nova migração)

Tabelas novas em `public`:

- **`tipos_documento`** — catálogo configurável: nome, slug (`contrato`, `adendo`, `complemento`, `projeto_inicial`, `pdf_final`, `vistoria`), `origem` (`sistema` | `upload`), `requer_assinatura_cliente`, `requer_assinatura_loja`, `ativo`. Já populada com os 6 tipos.
- **`solicitacoes_assinatura`** — registro central de cada solicitação: `pedido_id`, `tipo_documento_id`, `cliente_id`, `loja_id`, `documento_origem` (`pedido_documento_id` ou `contrato_id` ou `storage_path`), `token` (único, hex 32B, gerado por `gen_random_bytes`), `status` enum (`rascunho`, `aguardando_cliente`, `assinado_cliente`, `aguardando_loja`, `assinado_loja`, `concluido`, `recusado`, `cancelado`, `expirado`), `expira_em`, `cliente_assinado_em`, `loja_assinado_em`, `concluido_em`, `cancelado_em`, `created_by`, `responsavel_interno_id`, `observacao`.
- **`assinatura_participantes`** — `solicitacao_id`, `tipo` (`cliente`|`loja`), `nome`, `email`, `telefone`, `documento`, `user_id` (loja), `cargo`, `status`, `assinado_em`, `ip`, `user_agent`.
- **`assinatura_evidencias`** — `solicitacao_id`, `participante_id`, `documento_foto_url`, `selfie_url`, `assinatura_url` (data URL ou storage), `aceite` bool, `aceite_texto`, `ip`, `user_agent`, `assinado_em`. Imutável após criada (trigger bloqueia UPDATE/DELETE).
- **`assinatura_eventos`** — log imutável: `solicitacao_id`, `tipo_evento`, `status_anterior`, `status_novo`, `descricao`, `user_id`, `participante_id`, `ip`, `user_agent`, `created_at`.
- **`documentos_assinados`** — `solicitacao_id`, `final_file_url`, `codigo_validacao` (único, ex.: `ASN-AAAA-XXXX`), `concluido_em`.

Bucket de storage privado: **`assinaturas`** com policies (anon pode INSERT em `evidencias/{token}/...`; autenticados leem se acesso à loja).

### 2. Permissões

- Nova permissão granular: `assinaturas.view`, `assinaturas.edit`, `assinaturas.assinar_loja`, `assinaturas.cancelar`.
- Atribuída por padrão (via `role_permissoes`) para `admin` e `gerente` (assinar_loja); restantes apenas `view`.
- Componente `<Can modulo="assinaturas" acao="assinar_loja">` controla o botão "Assinar pela loja".

### 3. RLS

- `solicitacoes_assinatura`, `participantes`, `evidencias`, `eventos`, `documentos_assinados`: SELECT/INSERT/UPDATE para autenticados via `pode_acessar_loja(loja_id)`; DELETE só admin.
- Política **anon por token**: SELECT permitido em `solicitacoes_assinatura` quando `token` informado e status assinável; INSERT em `evidencias` permitido para anon se token válido e não expirado/cancelado.
- Triggers impedem alterar `evidencias` e `eventos` após criação; impedem alterar solicitação após `concluido`.

### 4. Edge Functions

- **`signature-create`** — cria solicitação (auth interna): valida pedido + tipo, gera token, registra evento `solicitacao_criada`, retorna URL pública.
- **`signature-public-get`** — pública (verify_jwt=false), recebe token, retorna dados mínimos (loja, cliente, pedido, tipo, PDF assinado URL).
- **`signature-client-sign`** — pública: recebe token + uploads (foto doc, selfie, assinatura desenhada base64) + aceite + nome/CPF + IP/UA → grava evidência, atualiza status para `assinado_cliente` ou direto `concluido` (se não exige loja), gera evento.
- **`signature-store-sign`** — auth + permissão `assinar_loja`: grava evidência da loja, atualiza para `concluido`, gera `documentos_assinados` (PDF final com bloco de evidências usando `pdf-lib`).
- **`signature-cancel`** / **`signature-resend`** — auth.

### 5. UI Interna

- **Nova página `/assinaturas`** (lista geral) — sidebar em "Operação" com ícone `PenLine`. Filtros por pedido, cliente, tipo, status, loja, responsável, data criação/assinatura cliente/loja. Ações por linha: abrir pedido, copiar link, reenviar, cancelar, ver evidências, baixar assinado.
- **Aba "Documentos e Assinaturas" no `PedidoDetalhe`** — substitui/expande aba atual de documentos. Lista todos os documentos do pedido com colunas: tipo, nome, origem, data, responsável, status, cliente assinou, loja assinou, ações.
- **Modal `NovaSolicitacaoAssinaturaDialog`** — usado tanto no upload quanto na geração de contrato/adendo/complemento. Pergunta "Precisa de assinatura digital?" → escolhe tipo, assinante (cliente do pedido pré-preenchido), e-mail, WhatsApp, validade, observação → cria solicitação e retorna link copiável.
- **Modal `EvidenciasDialog`** — exibe evidências completas + histórico de eventos.
- **Modal `AssinarPelaLojaDialog`** — visualização do documento, evidências do cliente, canvas de assinatura, observação opcional. Só visível com permissão.

### 6. UI Externa (pública, sem login)

- **Rota `/assinatura/:token`** — página responsiva com:
  - Cabeçalho com logo da loja (via `BrandingContext` por loja).
  - Card: nome cliente, nº pedido, tipo documento, data solicitação.
  - Visualizador PDF embed.
  - Aceite obrigatório (checkbox + texto fornecido).
  - Upload foto documento identificador.
  - Upload selfie segurando documento.
  - Canvas de assinatura desenhada (`react-signature-canvas`).
  - Botão "Finalizar assinatura" só habilita com tudo preenchido.
  - Tela de confirmação pós-assinatura, com mensagem distinta para fluxo com/sem assinatura da loja.
- Estados de erro: token inválido, expirado, cancelado, já assinado.

### 7. Integração com fluxos existentes

- **Geração de Contrato** (já existe): adicionar passo "Gerar solicitação de assinatura?" — cria solicitação atrelada ao `contrato_id`. Migra `contratos` para também aparecer no módulo (via VIEW unificada ou solicitação espelho).
- **Adendos** (`pedido_pai_id` já existe): mesmo fluxo do contrato.
- **Complemento**: novo botão no pedido para gerar documento complementar a partir de template, igual ao contrato.
- **Upload de documento no pedido**: ao subir, pergunta "Precisa de assinatura?". Se sim, abre modal de solicitação.

### 8. Notificações

- Internas (`notificacoes` table já existe): nova solicitação, cliente assinou, aguardando loja, concluído, expirado, cancelado.
- Estrutura preparada para e-mail/WhatsApp (campos `email`/`telefone` no participante + botão copiar link), envio automático fica como TODO.

### 9. Documento final assinado

- Edge function `signature-finalize` usa `pdf-lib` para anexar página final de evidências ao PDF original: nome cliente, assinatura (imagem), data/hora, IP, código único, nome+assinatura da loja quando aplicável, resumo de evidências.
- Salvo em `assinaturas/finais/{codigo}.pdf`. Registrado em `documentos_assinados`.

### 10. Segurança

- Token: 32 bytes hex, gerado pelo Postgres.
- Expiração configurável por solicitação (default 30 dias).
- Bloqueio de alteração após assinatura via triggers.
- `assinatura_evidencias` imutável (trigger).
- Apenas usuários com `assinar_loja` veem botão.
- Rotas internas guardadas por `<RequirePermission modulo="assinaturas">`.
- Cliente externo só pode acessar `/assinatura/:token` — sem outras rotas.
- Código único de validação por documento concluído.

## Detalhes técnicos

### Sequência de implementação (ordem de PR/commits)

1. Migração SQL (tabelas, enums, triggers imutabilidade, RLS, permissões `role_permissoes`, bucket `assinaturas` + policies, populate `tipos_documento`).
2. Tipos atualizados em `src/integrations/supabase/types.ts` (auto).
3. Edge functions (`signature-create`, `signature-public-get`, `signature-client-sign`, `signature-store-sign`, `signature-cancel`, `signature-resend`, `signature-finalize`).
4. Página pública `/assinatura/:token` (`src/pages/AssinaturaPublica.tsx`) + rota em `App.tsx`.
5. Página interna `/assinaturas` (`src/pages/Assinaturas.tsx`) + entrada na sidebar.
6. Aba "Documentos e Assinaturas" no `PedidoDetalhe.tsx` + modais (`NovaSolicitacaoAssinaturaDialog`, `EvidenciasDialog`, `AssinarPelaLojaDialog`).
7. Hook integração na geração de contratos/adendos/uploads existentes.
8. Mensagens, traduções e mensagens de erro.

### Reuso

- Mantém `contratos` para snapshot/conteúdo do contrato; cria solicitação espelho na nova tabela apontando para `contrato_id`.
- `pedido_documentos` continua para upload bruto; solicitação aponta para `pedido_documento_id`.
- A nova tabela `solicitacoes_assinatura` é a **fonte única de verdade** para status e fluxo de assinatura.

### Visual

- Tela pública usa tokens existentes do `BrandingContext` (logo, cores) — mantém identidade da loja.
- Componentes shadcn (Card, Button, Checkbox, Tabs).
- `react-signature-canvas` para desenho (já compatível com stack).

### Fora do escopo desta entrega

- Envio automático real de e-mail/WhatsApp (estrutura pronta, integração a definir com Resend/Twilio em iteração futura).
- Versionamento de documentos (cada upload é uma nova solicitação).

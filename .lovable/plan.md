## Objetivo
Permitir configurar, por kanban e por estágio, **SLA (dias úteis)** e **automações de movimento** (ex.: "quando condição X for atendida, mover card do estágio A para o C"), tudo dentro da tela de edição de estágios já existente.

## Mudanças no banco

**1. `pipeline_estagios`** — adicionar coluna `sla_dias_uteis integer` (default null). Atualizar trigger global para usar este valor quando o card entrar no estágio (sobrescrevendo as regras hard-coded atuais).

**2. Nova tabela `pipeline_automacoes`** — uma regra por linha:
- `id`, `pipeline`, `estagio_origem_id` (FK), `estagio_destino_id` (FK)
- `evento` enum: `agenda_criada`, `checklist_concluido`, `medicao_agendada`, `revisao_agendada`, `assinatura_concluida`, `manual`
- `condicao_tipo` enum: `nenhuma`, `tipo_evento_agenda`, `template_checklist`
- `condicao_valor text` (ex.: `medicao_tecnica`, ou um UUID de template)
- `ajustar_prazo_dias int` (opcional — sobrescreve SLA quando a automação dispara)
- `ativo boolean`, `ordem int`
- RLS: select público autenticado; insert/update/delete admin.

**3. Função `pipeline_avancar_card(pedido_id, evento, contexto jsonb)`** — busca a primeira regra ativa que case origem (estágio atual do card) + evento + condição, move o card para `estagio_destino_id`, aplica `ajustar_prazo_dias` se houver, registra `kanban_movimento` no `timeline_eventos`.

**4. Substituir** triggers/funções específicas (`revisao_avancar_preparo_pj_final`, `kanban_revisao_set_prazo`) por chamadas genéricas a essa engine, mantendo os comportamentos atuais já configurados como linhas-padrão na nova tabela (seed inicial).

## Mudanças na UI

**`EstagiosEditDialog`** (única tela — abre por kanban):
- Mantém grid atual + nova coluna **"SLA (dias úteis)"** com input numérico opcional.
- Cada linha ganha botão **"Automações"** que expande um sub-painel mostrando todas as regras com origem nesse estágio:
  - Select do estágio destino (opções = estágios do mesmo pipeline)
  - Select de evento (lista fixa)
  - Select de condição (depende do evento; ex.: tipo de agenda, template de checklist)
  - Input opcional "ajustar prazo (dias úteis)"
  - Switch ativo + remover
  - Botão "Adicionar regra"
- Tudo salvo no botão Salvar do dialog (transacional por linha como já é hoje).

## Substituição da lógica atual

Os pontos no frontend que hoje chamam RPCs específicas (ex.: `AgendaEventoDialog` chamando `revisao_avancar_preparo_pj_final` ao agendar revisão) passam a chamar `pipeline_avancar_card` com o evento apropriado. A engine resolve o destino consultando a tabela.

## Detalhes técnicos
- Tipo dias úteis: usa `add_dias_uteis` já existente.
- Quando `ajustar_prazo_dias` for negativo e o evento trouxer `data_referencia` no `contexto`, calcula `prazo = sub_dias_uteis(data_ref, abs(dias))`. Caso contrário, usa SLA do estágio destino.
- `concluídos` continua oculto e fora da lista de destinos selecionáveis para não-admins.

## Arquivos
- Migration nova (coluna + tabela + função + seed das regras atuais).
- `src/components/kanban/EstagiosEditDialog.tsx` (expansão de UI).
- `src/components/agenda/AgendaEventoDialog.tsx` (trocar RPC específica pela genérica).

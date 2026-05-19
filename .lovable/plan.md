## O que o vídeo mostra

Naveguei pelos frames do vídeo de 11 min. O usuário percorre Dashboard → Relatórios → Clientes → CRM Comercial → Agenda → Comercial, e no final clica em um pedido (`/comercial/{uuid}`) na loja **"Decoração de Flores"**, onde aparece o ErrorBoundary com:

> **"OPS, ALGO DEU ERRADO NESTA TELA — Falha ao executar 'removeChild' em 'Node': O nó a ser removido não é filho deste nó."**

Além disso, em vários frames os textos da interface aparecem **duplicados/corrompidos**, por exemplo:
- Dropdown **Tipo** no diálogo da Agenda mostrando `"InternaTarefa Interna"` (deveria ser apenas `"Tarefa Interna"`)
- Dropdown **Loja** mostrando `"Todas as idades (geral)"` em vez de `"Todas as lojas (geral)"`
- Filtro do topo virando `"Todas como"` no lugar de `"Todas as lojas"`

## Causa raiz

O **Google Translate do Chrome está traduzindo a página automaticamente** e corrompendo o DOM (insere `<font>` em volta dos textos), o que:
1. Faz o React perder referências e estourar `removeChild on Node` na próxima re-renderização (especialmente em telas pesadas como `ComercialNovo`).
2. Concatena o texto traduzido com o original dentro dos triggers do Radix Select (gerando `InternaTarefa Interna`, `Todas as idades`, etc.).

Mesmo com `<html lang="pt-BR" translate="no">` e `class="notranslate"` no `#root`, o Chrome ainda oferece tradução porque a `<meta name="description">` e o `<meta og:description>` estão **em inglês** ("Alavanch Sistema ERP manages furniture sales from quotes to post-sale."), o que confunde o detector de idioma do navegador, e o usuário aceitou traduzir.

## Alterações

### 1. `index.html` — eliminar gatilhos de tradução

- Trocar todos os `meta description` (incluindo `og:description` e `twitter:description`) para **português**.
- Adicionar `translate="no"` e `class="notranslate"` também no `<body>` (reforço além do `<html>` e `#root`).
- Manter `<meta name="google" content="notranslate">`.

### 2. `src/components/ErrorBoundary.tsx` — auto-recovery do erro de tradução

Quando o erro capturado for exatamente o `removeChild`/`insertBefore` do Node (assinatura clássica da tradução), em vez de mostrar a tela de erro, fazer **reset automático silencioso** (re-render do children com novo `key`). Isso cobre casos residuais sem incomodar o usuário com a tela vermelha.

### 3. Sem mudanças funcionais em CRM/Agenda/Comercial

O dropdown "Tipo" e os labels estão **corretos no código** — eram apenas vítimas da tradução. Confirmado lendo `AgendaEventoDialog.tsx` (linhas 449-460): o `TIPO_LABEL["tarefa_interna"] = "Tarefa Interna"` está certo.

## Validação

Após as mudanças:
- Recarregar `/dashboard` — Chrome não deve mais oferecer "Traduzir esta página".
- Abrir Agenda → Novo evento → o Tipo deve mostrar apenas `Tarefa Interna`.
- Abrir um pedido em `/comercial/{id}` — deve carregar sem o erro de removeChild.

Se ainda houver tradução ativa do usuário, peço para clicar no ícone do tradutor no Chrome e escolher **"Nunca traduzir este site"** uma vez.

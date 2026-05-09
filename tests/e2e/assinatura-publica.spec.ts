import { test, expect } from "../../playwright-fixture";

const token = "token-publico-e2e";
const solicitacaoId = "11111111-1111-4111-8111-111111111111";
const pedidoId = "22222222-2222-4222-8222-222222222222";
const clienteId = "33333333-3333-4333-8333-333333333333";
const lojaId = "44444444-4444-4444-8444-444444444444";
const tipoId = "55555555-5555-4555-8555-555555555555";
const contratoId = "66666666-6666-4666-8666-666666666666";
const templateId = "77777777-7777-4777-8777-777777777777";

function json(body: unknown) {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

test("assinatura pública carrega por token, mostra spinner, preenche dados e renderiza documento", async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/solicitacoes_assinatura") && route.request().method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill(json({
        id: solicitacaoId,
        pedido_id: pedidoId,
        status: "aguardando_cliente",
        expira_em: new Date(Date.now() + 86400000).toISOString(),
        file_url: null,
        file_name: "Contrato 016/2026",
        storage_path: null,
        cliente_id: clienteId,
        loja_id: lojaId,
        tipo_documento_id: tipoId,
        contrato_id: contratoId,
        token,
      }));
    }

    if (path.endsWith("/tipos_documento")) {
      return route.fulfill(json({ id: tipoId, nome: "Contrato", requer_assinatura_loja: true }));
    }
    if (path.endsWith("/pedidos")) {
      return route.fulfill(json({ id: pedidoId, codigo: "PV-LOJ-0004", valor_total: 2013.61, loja_id: lojaId, orcamento_id: "orc-1" }));
    }
    if (path.endsWith("/clientes")) {
      return route.fulfill(json({ nome: "Carlos Teste", email: "cliente@example.com", cpf_cnpj: "47219093810", telefone: "(12) 99999-9999" }));
    }
    if (path.endsWith("/lojas")) {
      return route.fulfill(json({ nome: "Forest Decor" }));
    }
    if (path.endsWith("/contratos")) {
      return route.fulfill(json({
        id: contratoId,
        numero: "016/2026",
        template_id: templateId,
        conteudo_snapshot: {
          numero: "016/2026",
          emitido_em: new Date().toISOString(),
          empresa: { nome: "Forest Decor", telefone: "(11) 1111-1111" },
          cliente: { nome: "Carlos Teste", cpf_cnpj: "472.190.938-10", email: "cliente@example.com", telefone: "(12) 99999-9999", endereco_cobranca: "Rua Teste, 123" },
          ambientes: [{ nome: "Cozinha", descricao: "Armários planejados", preco_base: 2013.61, preco_final: 2013.61 }],
          subtotal: 2013.61,
          desconto_perc: 0,
          desconto_valor: 0,
          total: 2013.61,
          pagamentos: [{ metodo: "PIX", parcelas: 1, valor: 2013.61, data_vencimento: new Date().toISOString() }],
          observacoes_adicionais: "",
          signing_url: "",
        },
      }));
    }
    if (path.endsWith("/contratos_template")) {
      return route.fulfill(json({
        id: templateId,
        nome: "Contrato Padrão",
        titulo: "CONTRATO DE COMPRA E VENDA",
        subtitulo: "CONTRATO DE COMPRA E VENDA DE PRODUTOS",
        clausulas: "<p>CLÁUSULA 1ª - DO OBJETO: móveis planejados.</p>",
        observacoes_padrao: "",
        rodape: "Documento gerado eletronicamente.",
      }));
    }

    return route.fulfill(json([]));
  });

  await page.goto(`/assinatura/${token}`);
  await expect(page.getByRole("status", { name: "Carregando assinatura" })).toBeVisible();
  await expect(page.getByText("Forest Decor")).toBeVisible();
  await expect(page.getByText("PV-LOJ-0004")).toBeVisible();
  await expect(page.getByText("Contrato 016/2026")).toBeVisible();
  await expect(page.getByDisplayValue("Carlos Teste")).toBeVisible();
  await expect(page.getByDisplayValue("472.190.938-10")).toBeVisible();
  await expect(page.getByText("CONTRATO Nº")).toBeVisible();
  await expect(page.getByText("CLÁUSULA 1ª - DO OBJETO")).toBeVisible();
});

// supabase/functions/contrato-saas-public/index.ts
// Edge function pública para assinatura digital de contratos SaaS.
// GET  ?token=... → retorna dados públicos do contrato.
// POST { token, nome, documento, email, aceite } → registra assinatura.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STATUS_PODE_ASSINAR = new Set(["aguardando_assinatura", "enviado_para_assinatura"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "Token ausente" }, 400);

      const { data: contrato, error } = await supabase
        .from("base_contratos")
        .select("id, numero_contrato, tipo_contrato, status, conteudo_html, data_envio_assinatura, data_assinatura, base_cliente_id, plano, valor_mensal, valor_implantacao, data_inicio, data_fim")
        .eq("assinatura_token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!contrato) return json({ error: "Link inválido ou expirado." }, 404);

      const { data: base } = await supabase
        .from("bases_clientes")
        .select("nome, razao_social, nome_fantasia, cnpj")
        .eq("id", contrato.base_cliente_id)
        .maybeSingle();

      return json({
        contrato: {
          id: contrato.id,
          numero_contrato: contrato.numero_contrato,
          tipo_contrato: contrato.tipo_contrato,
          status: contrato.status,
          conteudo_html: contrato.conteudo_html,
          data_envio_assinatura: contrato.data_envio_assinatura,
          data_assinatura: contrato.data_assinatura,
          plano: contrato.plano,
          valor_mensal: contrato.valor_mensal,
          valor_implantacao: contrato.valor_implantacao,
          data_inicio: contrato.data_inicio,
          data_fim: contrato.data_fim,
        },
        base: base ?? null,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = String(body?.token ?? "").trim();
      const nome = String(body?.nome ?? "").trim();
      const documento = String(body?.documento ?? "").trim();
      const email = String(body?.email ?? "").trim();
      const aceite = body?.aceite === true;

      if (!token) return json({ error: "Token ausente" }, 400);
      if (!nome || nome.length < 2 || nome.length > 200) return json({ error: "Nome inválido" }, 400);
      if (!documento || documento.length < 5 || documento.length > 40) return json({ error: "Documento inválido" }, 400);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "E-mail inválido" }, 400);
      if (!aceite) return json({ error: "É necessário aceitar os termos" }, 400);

      const { data: contrato, error: errSel } = await supabase
        .from("base_contratos")
        .select("id, status, base_cliente_id, numero_contrato, data_assinatura")
        .eq("assinatura_token", token)
        .maybeSingle();
      if (errSel) return json({ error: errSel.message }, 500);
      if (!contrato) return json({ error: "Link inválido ou expirado." }, 404);

      if (contrato.status === "assinado") {
        return json({ error: "Este contrato já foi assinado.", data_assinatura: contrato.data_assinatura }, 409);
      }
      if (contrato.status === "cancelado" || contrato.status === "expirado" || contrato.status === "anexado_manual") {
        return json({ error: "Este contrato não está mais disponível para assinatura." }, 409);
      }
      if (!STATUS_PODE_ASSINAR.has(contrato.status)) {
        return json({ error: "Este contrato não está disponível para assinatura." }, 409);
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
              ?? req.headers.get("cf-connecting-ip")
              ?? null;
      const ua = req.headers.get("user-agent") ?? null;
      const now = new Date().toISOString();

      const { error: errUpd } = await supabase.from("base_contratos").update({
        status: "assinado",
        data_assinatura: now,
        assinante_nome: nome,
        assinante_documento: documento,
        assinante_email: email,
        assinante_ip: ip,
        assinante_user_agent: ua,
      }).eq("id", contrato.id);
      if (errUpd) return json({ error: errUpd.message }, 500);

      await supabase.from("bases_clientes_historico").insert({
        base_id: contrato.base_cliente_id,
        evento: "contrato_assinado_digital",
        descricao: `Contrato ${contrato.numero_contrato} assinado digitalmente por ${nome}`,
        detalhes: {
          contrato_id: contrato.id,
          numero_contrato: contrato.numero_contrato,
          assinante_nome: nome,
          assinante_documento: documento,
          assinante_email: email,
          ip, user_agent: ua, assinado_em: now,
        },
      });

      return json({ ok: true, data_assinatura: now });
    }

    return json({ error: "Método não permitido" }, 405);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Erro interno" }, 500);
  }
});

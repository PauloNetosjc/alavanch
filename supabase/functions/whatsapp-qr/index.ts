import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-qr — pede ao gateway que inicie a sessão e devolva o QR Code atual.

function gatewayConfig() {
  const url = Deno.env.get("WHATSAPP_GATEWAY_URL") ?? "";
  const secret = Deno.env.get("WHATSAPP_GATEWAY_SECRET") ?? "";
  const isPlaceholder = !url || url === "pending" || url.includes("localhost") || url.includes("127.0.0.1");
  return { url: url.replace(/\/$/, ""), secret, ok: !!url && !!secret && !isPlaceholder };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { conta_id } = (await req.json()) as { conta_id: string };
    if (!conta_id) return json({ erro: "conta_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: conta, error } = await supabase
      .from("whatsapp_contas")
      .select("id, loja_id, tipo_integracao")
      .eq("id", conta_id)
      .maybeSingle();
    if (error || !conta) return json({ erro: "conta não encontrada" }, 404);
    if (conta.tipo_integracao !== "whatsapp_web") return json({ erro: "conta não é WhatsApp Web" }, 400);

    const gw = gatewayConfig();
    if (!gw.ok) {
      await supabase.from("whatsapp_contas").update({ status_conexao: "erro" }).eq("id", conta_id);
      return json({
        ok: false,
        configured: false,
        erro: "Gateway WhatsApp não configurado. Publique o whatsapp-gateway/ e atualize WHATSAPP_GATEWAY_URL.",
      }, 200);
    }

    const r = await fetch(`${gw.url}/sessions/start`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-whatsapp-api-secret": gw.secret },
      body: JSON.stringify({ conta_id, loja_id: conta.loja_id }),
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      await supabase
        .from("whatsapp_contas")
        .update({
          status_conexao: data.status ?? "aguardando_qr",
          qr_code: data.qr_code ?? null,
          qr_atualizado_em: data.qr_atualizado_em ?? new Date().toISOString(),
        })
        .eq("id", conta_id);
    }
    return json({ ok: r.ok, ...data }, r.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, erro: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

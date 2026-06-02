import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-qr — sempre encerra a sessão anterior (DELETE) e abre uma NOVA sessão (POST).
// Gateway (Railway):
//   DELETE {GATEWAY_URL}/sessions/{session_id}    headers: x-gateway-secret
//   POST   {GATEWAY_URL}/sessions                 headers: x-gateway-secret, content-type
//                                                 body: { store_id, user_id }
//                                                 resp: { session_id, status, qr_code }

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

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    const { data: conta, error } = await supabase
      .from("whatsapp_contas")
      .select("id, loja_id, tipo_integracao, sessao_ref")
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
        erro: "Gateway WhatsApp não configurado. Defina WHATSAPP_GATEWAY_URL e WHATSAPP_GATEWAY_SECRET.",
      }, 200);
    }

    // 1) Se já existe session_id, encerra a sessão antiga no gateway.
    if (conta.sessao_ref) {
      try {
        await fetch(`${gw.url}/sessions/${encodeURIComponent(conta.sessao_ref)}`, {
          method: "DELETE",
          headers: { "x-gateway-secret": gw.secret },
        });
      } catch (_) { /* segue sem bloquear */ }
    }

    // 2) Limpa estado local (qr, status, sessao_ref) antes de criar nova sessão.
    await supabase
      .from("whatsapp_contas")
      .update({
        sessao_ref: null,
        qr_code: null,
        qr_atualizado_em: null,
        status_conexao: "aguardando_qr",
        numero_conectado: null,
      })
      .eq("id", conta_id);

    // 3) Cria nova sessão.
    const r = await fetch(`${gw.url}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gateway-secret": gw.secret,
      },
      body: JSON.stringify({ store_id: conta.loja_id, user_id: userId }),
    });
    const data = await r.json().catch(() => ({} as Record<string, unknown>));

    if (r.ok) {
      await supabase
        .from("whatsapp_contas")
        .update({
          sessao_ref: (data as { session_id?: string }).session_id ?? null,
          status_conexao: (data as { status?: string }).status ?? "aguardando_qr",
          qr_code: (data as { qr_code?: string | null }).qr_code ?? null,
          qr_atualizado_em: new Date().toISOString(),
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

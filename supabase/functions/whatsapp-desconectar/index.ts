import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-desconectar — encerra a sessão no gateway (DELETE) e limpa o estado local.

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

    const { data: conta } = await supabase
      .from("whatsapp_contas")
      .select("id, sessao_ref")
      .eq("id", conta_id)
      .maybeSingle();

    const gw = gatewayConfig();
    if (gw.ok && conta?.sessao_ref) {
      try {
        await fetch(`${gw.url}/sessions/${encodeURIComponent(conta.sessao_ref)}`, {
          method: "DELETE",
          headers: { "x-gateway-secret": gw.secret },
        });
      } catch (_) { /* ignore */ }
    }

    await supabase
      .from("whatsapp_contas")
      .update({
        sessao_ref: null,
        qr_code: null,
        qr_atualizado_em: null,
        status_conexao: "desconectado",
        numero_conectado: null,
      })
      .eq("id", conta_id);

    return json({ ok: true });
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

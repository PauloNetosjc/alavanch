import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-sync-historico — pede ao gateway que envie histórico recente via webhook.

function gw() {
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

    const config = gw();
    if (!config.ok) {
      await supabase
        .from("whatsapp_contas")
        .update({ historico_sync_status: "erro", historico_sync_mensagem: "Gateway não configurado" })
        .eq("id", conta_id);
      return json({ ok: false, erro: "Gateway WhatsApp não configurado" }, 503);
    }

    await supabase
      .from("whatsapp_contas")
      .update({ historico_sync_status: "sincronizando", historico_sync_mensagem: null })
      .eq("id", conta_id);

    const r = await fetch(`${config.url}/history/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-whatsapp-api-secret": config.secret },
      body: JSON.stringify({ conta_id }),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      await supabase
        .from("whatsapp_contas")
        .update({ historico_sync_status: "erro", historico_sync_mensagem: data?.erro ?? "Falha na sincronização" })
        .eq("id", conta_id);
      return json({ ok: false, ...data }, 502);
    }

    return json({ ok: true, ...data });
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-enviar — envia mensagem de texto via gateway WhatsApp Web (ou bloqueia em Cloud API por enquanto).

function gw() {
  const url = Deno.env.get("WHATSAPP_GATEWAY_URL") ?? "";
  const secret = Deno.env.get("WHATSAPP_GATEWAY_SECRET") ?? "";
  const isPlaceholder = !url || url === "pending" || url.includes("localhost") || url.includes("127.0.0.1");
  return { url: url.replace(/\/$/, ""), secret, ok: !!url && !!secret && !isPlaceholder };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { conta_id, to, text } = (await req.json()) as { conta_id: string; to: string; text: string };
    if (!conta_id || !to || !text) return json({ erro: "conta_id, to e text obrigatórios" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: conta } = await supabase
      .from("whatsapp_contas")
      .select("id, loja_id, tipo_integracao, status_conexao")
      .eq("id", conta_id)
      .maybeSingle();
    if (!conta) return json({ erro: "conta não encontrada" }, 404);
    if (conta.tipo_integracao !== "whatsapp_web") {
      return json({ erro: "Cloud API ainda não habilitada nesta fase" }, 501);
    }

    const config = gw();
    if (!config.ok) return json({ ok: false, erro: "Gateway WhatsApp não configurado" }, 503);

    const r = await fetch(`${config.url}/messages/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-whatsapp-api-secret": config.secret },
      body: JSON.stringify({ conta_id, to, text }),
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      await supabase.from("whatsapp_mensagens").insert({
        conta_id,
        loja_id: conta.loja_id,
        wa_chat_id: data.to ?? to,
        wa_message_id: data.id ?? null,
        direcao: "saida",
        tipo: "text",
        texto: text,
        status: "enviada",
        origem: "whatsapp_web_runtime",
      });
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

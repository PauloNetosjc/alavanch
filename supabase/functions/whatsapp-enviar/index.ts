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
      .select("id, loja_id, tipo_integracao, status_conexao, sessao_ref")
      .eq("id", conta_id)
      .maybeSingle();
    if (!conta) return json({ erro: "conta não encontrada" }, 404);
    if (conta.tipo_integracao !== "whatsapp_web") {
      return json({ erro: "Cloud API ainda não habilitada nesta fase" }, 501);
    }
    if (!conta.sessao_ref) {
      return json({ ok: false, erro: "Sessão WhatsApp não conectada (session_id ausente)" }, 400);
    }

    const config = gw();
    if (!config.ok) return json({ ok: false, erro: "Gateway WhatsApp não configurado" }, 503);

    const r = await fetch(`${config.url}/messages/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gateway-secret": config.secret },
      body: JSON.stringify({ session_id: conta.sessao_ref, phone: to, message: text }),
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      const waChatId = data.to ?? (to.includes("@") ? to : `${to.replace(/\D+/g, "")}@s.whatsapp.net`);

      // Garante conversa vinculada (cria se ainda não existir)
      let conversaId: string | null = null;
      const { data: convExistente } = await supabase
        .from("whatsapp_conversas")
        .select("id")
        .eq("conta_id", conta_id)
        .eq("wa_chat_id", waChatId)
        .maybeSingle();
      if (convExistente?.id) {
        conversaId = convExistente.id;
      } else {
        const { data: convNova } = await supabase
          .from("whatsapp_conversas")
          .insert({
            conta_id,
            loja_id: conta.loja_id,
            wa_chat_id: waChatId,
            is_group: waChatId.endsWith("@g.us"),
          })
          .select("id")
          .single();
        conversaId = convNova?.id ?? null;
      }

      const insertRes = await supabase.from("whatsapp_mensagens").insert({
        conta_id,
        loja_id: conta.loja_id,
        conversa_id: conversaId,
        wa_chat_id: waChatId,
        wa_message_id: data.id ?? data.message_id ?? null,
        direcao: "saida",
        tipo: "text",
        texto: text,
        status: data.status ?? "enviada",
        origem: "whatsapp_web_runtime",
        payload_bruto: data,
      });

      if (conversaId) {
        await supabase
          .from("whatsapp_conversas")
          .update({
            ultima_mensagem_em: new Date().toISOString(),
            ultima_mensagem_preview: text.slice(0, 200),
          })
          .eq("id", conversaId);
      }

      console.log("[whatsapp-enviar] persisted", {
        conta_id,
        conversa_id: conversaId,
        wa_chat_id: waChatId,
        wa_message_id: data.id ?? null,
        insert_error: insertRes.error?.message ?? null,
      });

      return json({ ok: true, conversa_id: conversaId, ...data }, 200);
    }

    return json({ ok: false, ...data }, 502);
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

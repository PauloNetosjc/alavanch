import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-webhook — recebe eventos do gateway (QR atualizado, conexão, mensagens).
// Autenticação por header x-whatsapp-webhook-secret (mesmo valor do WHATSAPP_GATEWAY_SECRET).
// IMPORTANTE: esta função usa service role para conseguir gravar sem JWT do usuário.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const incoming = req.headers.get("x-whatsapp-webhook-secret");
  const expected = Deno.env.get("WHATSAPP_GATEWAY_SECRET") ?? "";
  if (!expected || incoming !== expected) {
    return json({ erro: "unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tipo = body?.tipo as string;
    const conta_id = body?.conta_id as string;
    const loja_id = body?.loja_id as string;

    if (!tipo || !conta_id) return json({ erro: "tipo e conta_id obrigatórios" }, 400);

    await supabase.from("whatsapp_eventos").insert({
      conta_id,
      loja_id: loja_id ?? null,
      tipo,
      payload: body,
    });

    switch (tipo) {
      case "qr_atualizado":
        await supabase
          .from("whatsapp_contas")
          .update({
            status_conexao: "aguardando_qr",
            qr_code: body.qr_code ?? null,
            qr_atualizado_em: body.qr_atualizado_em ?? new Date().toISOString(),
          })
          .eq("id", conta_id);
        break;

      case "conectado":
        await supabase
          .from("whatsapp_contas")
          .update({
            status_conexao: "conectado",
            numero_conectado: body.numero ?? null,
            jid: body.jid ?? null,
            qr_code: null,
            ultima_conexao_em: new Date().toISOString(),
          })
          .eq("id", conta_id);
        break;

      case "desconectado":
        await supabase
          .from("whatsapp_contas")
          .update({
            status_conexao: "desconectado",
            ultima_desconexao_em: new Date().toISOString(),
          })
          .eq("id", conta_id);
        break;

      case "sync_historico_iniciado":
        await supabase
          .from("whatsapp_contas")
          .update({ historico_sync_status: "sincronizando" })
          .eq("id", conta_id);
        break;

      case "mensagem_recebida": {
        const m = body.mensagem ?? {};
        const origem = body.origem ?? "whatsapp_web_runtime";
        const chatId: string = m.chat_id ?? "";
        if (!chatId) break;

        // upsert conversa
        const { data: conv } = await supabase
          .from("whatsapp_conversas")
          .upsert(
            {
              conta_id,
              loja_id: loja_id ?? null,
              wa_chat_id: chatId,
              titulo: m.push_name ?? chatId,
              is_group: chatId.endsWith("@g.us"),
              ultima_mensagem_em: new Date((Number(m.timestamp) || Date.now() / 1000) * 1000).toISOString(),
              ultima_mensagem_preview: (m.texto ?? "[mídia]").slice(0, 200),
            },
            { onConflict: "conta_id,wa_chat_id" },
          )
          .select("id")
          .maybeSingle();

        await supabase.from("whatsapp_mensagens").insert({
          conta_id,
          loja_id: loja_id ?? null,
          conversa_id: conv?.id ?? null,
          wa_chat_id: chatId,
          wa_message_id: m.id ?? null,
          direcao: m.from_me ? "saida" : "entrada",
          tipo: m.tipo ?? "text",
          texto: m.texto ?? null,
          status: "recebida",
          origem,
          enviado_em: new Date((Number(m.timestamp) || Date.now() / 1000) * 1000).toISOString(),
          payload_bruto: m,
        });

        if (origem === "whatsapp_web_history_sync") {
          await supabase
            .from("whatsapp_contas")
            .update({
              historico_sync_status: "sincronizado",
              ultima_sincronizacao_historico_em: new Date().toISOString(),
            })
            .eq("id", conta_id);
        }
        break;
      }
    }

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

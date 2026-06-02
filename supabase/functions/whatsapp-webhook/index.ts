import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-webhook — recebe eventos do gateway (QR atualizado, conexão, mensagens).
// Autenticação por header x-whatsapp-webhook-secret (mesmo valor do WHATSAPP_GATEWAY_SECRET).
// IMPORTANTE: esta função usa service role para conseguir gravar sem JWT do usuário.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret =
    Deno.env.get("SYSTEM_WEBHOOK_SECRET") ||
    Deno.env.get("WHATSAPP_WEBHOOK_SECRET") ||
    Deno.env.get("WEBHOOK_SECRET") ||
    Deno.env.get("WHATSAPP_GATEWAY_SECRET");

  if (!expectedSecret) {
    return json({ success: false, error: "webhook_secret_not_configured" }, 500);
  }

  const receivedSecret =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-whatsapp-webhook-secret");

  if (receivedSecret !== expectedSecret) {
    return json(
      {
        success: false,
        error: "unauthorized",
        debug: {
          received_secret_exists: !!receivedSecret,
          expected_secret_exists: !!expectedSecret,
        },
      },
      401,
    );
  }

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Payload "flat" do gateway Railway ---------------------------------
    // { store_id, session_id, contact_phone, contact_name, message_id,
    //   from_me, message_text, message_type, timestamp, raw_payload }
    if (body?.contact_phone && body?.message_id !== undefined) {
      return await handleFlatPayload(supabase, body);
    }

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

async function handleFlatPayload(supabase: any, body: any) {
  const store_id: string | null = body.store_id ?? null;
  const session_id: string | null = body.session_id ?? null;
  const contact_phone_raw: string = body.contact_phone ?? "";
  const contact_name: string | null = body.contact_name ?? null;
  const message_id: string | null = body.message_id ?? null;
  const from_me: boolean = !!body.from_me;
  const message_text: string | null = body.message_text ?? null;
  const message_type: string = body.message_type ?? "text";
  const ts: string = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
  const raw_payload = body.raw_payload ?? body;

  // 3. Normalizar telefone para apenas dígitos
  const contact_phone = (contact_phone_raw || "").replace(/\D+/g, "");
  if (!contact_phone) return json({ success: false, error: "contact_phone inválido" }, 400);

  // Localiza a conta WhatsApp (loja + session_id)
  let contaQuery = supabase.from("whatsapp_contas").select("id, loja_id").limit(1);
  if (store_id) contaQuery = contaQuery.eq("loja_id", store_id);
  if (session_id) contaQuery = contaQuery.eq("sessao_ref", session_id);
  const { data: conta } = await contaQuery.maybeSingle();
  if (!conta) return json({ success: false, error: "conta WhatsApp não encontrada" }, 404);

  const wa_chat_id = `${contact_phone}@s.whatsapp.net`;

  // 4-6. Conversa existente ou nova
  const { data: convExistente } = await supabase
    .from("whatsapp_conversas")
    .select("id, nao_lidas")
    .eq("loja_id", conta.loja_id)
    .eq("conta_id", conta.id)
    .eq("wa_chat_id", wa_chat_id)
    .maybeSingle();

  let conversation_id: string;
  if (!convExistente) {
    const { data: novaConv, error: errConv } = await supabase
      .from("whatsapp_conversas")
      .insert({
        conta_id: conta.id,
        loja_id: conta.loja_id,
        wa_chat_id,
        titulo: contact_name,
        is_group: false,
        ultima_mensagem_em: ts,
        ultima_mensagem_preview: (message_text ?? "[mídia]").slice(0, 200),
        nao_lidas: from_me ? 0 : 1,
      })
      .select("id")
      .single();
    if (errConv) return json({ success: false, error: errConv.message }, 500);
    conversation_id = novaConv.id;
  } else {
    conversation_id = convExistente.id;
    await supabase
      .from("whatsapp_conversas")
      .update({
        ultima_mensagem_em: ts,
        ultima_mensagem_preview: (message_text ?? "[mídia]").slice(0, 200),
        nao_lidas: from_me ? convExistente.nao_lidas : (convExistente.nao_lidas ?? 0) + 1,
      })
      .eq("id", conversation_id);
  }

  // 8. Evitar duplicidade por external_message_id (wa_message_id)
  if (message_id) {
    const { data: existeMsg } = await supabase
      .from("whatsapp_mensagens")
      .select("id")
      .eq("conta_id", conta.id)
      .eq("wa_message_id", message_id)
      .maybeSingle();
    if (existeMsg) {
      return json({ success: true, conversation_id, message_id: existeMsg.id, duplicated: true });
    }
  }

  // 7. Inserir mensagem
  const { data: inserted, error: errMsg } = await supabase
    .from("whatsapp_mensagens")
    .insert({
      conta_id: conta.id,
      loja_id: conta.loja_id,
      conversa_id: conversation_id,
      wa_chat_id,
      wa_message_id: message_id,
      direcao: from_me ? "saida" : "entrada",
      tipo: message_type,
      texto: message_text,
      status: "recebida",
      origem: "whatsapp_web_runtime",
      enviado_em: ts,
      payload_bruto: raw_payload,
    })
    .select("id")
    .single();
  if (errMsg) return json({ success: false, error: errMsg.message }, 500);

  // Registra evento bruto (auditoria)
  await supabase.from("whatsapp_eventos").insert({
    conta_id: conta.id,
    loja_id: conta.loja_id,
    tipo: "mensagem_recebida",
    payload: body,
  });

  return json({ success: true, conversation_id, message_id: inserted.id });
}

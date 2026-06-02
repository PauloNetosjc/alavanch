import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-webhook — recebe eventos do gateway (QR atualizado, conexão, mensagens).

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

    if (
      body?.message_id !== undefined &&
      (body?.contact_phone !== undefined ||
        body?.contact_jid !== undefined ||
        body?.contact_lid !== undefined)
    ) {
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

        const parsed = parseJid(chatId);
        const ts = new Date((Number(m.timestamp) || Date.now() / 1000) * 1000).toISOString();

        const { data: conv } = await supabase
          .from("whatsapp_conversas")
          .upsert(
            {
              conta_id,
              loja_id: loja_id ?? null,
              wa_chat_id: chatId,
              titulo: m.push_name ?? null,
              contact_name: m.push_name ?? null,
              contact_jid: parsed.jid,
              contact_phone: parsed.phone,
              contact_lid: parsed.lid,
              is_group: chatId.endsWith("@g.us"),
              ultima_mensagem_em: ts,
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
          contact_jid: parsed.jid,
          contact_phone: parsed.phone,
          contact_lid: parsed.lid,
          direcao: m.from_me ? "saida" : "entrada",
          tipo: m.tipo ?? "text",
          texto: m.texto ?? null,
          status: "recebida",
          origem,
          enviado_em: ts,
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

// Extrai phone/jid/lid de uma string que pode vir como JID completo ou só dígitos.
function parseJid(raw: string | null | undefined): { jid: string | null; phone: string | null; lid: string | null } {
  if (!raw) return { jid: null, phone: null, lid: null };
  const s = String(raw).trim();
  if (!s) return { jid: null, phone: null, lid: null };
  if (s.includes("@")) {
    const [left, domain] = s.split("@");
    const digits = (left || "").replace(/\D+/g, "");
    if (domain === "lid") {
      return { jid: s, phone: null, lid: digits || null };
    }
    if (domain === "s.whatsapp.net" || domain === "c.us") {
      return { jid: s, phone: digits || null, lid: null };
    }
    // grupo ou outro
    return { jid: s, phone: null, lid: null };
  }
  const digits = s.replace(/\D+/g, "");
  if (!digits) return { jid: null, phone: null, lid: null };
  // Heurística: números reais têm até ~15 dígitos (E.164). LIDs são bem maiores.
  if (digits.length > 15) {
    return { jid: `${digits}@lid`, phone: null, lid: digits };
  }
  return { jid: `${digits}@s.whatsapp.net`, phone: digits, lid: null };
}

async function handleFlatPayload(supabase: any, body: any) {
  const store_id: string | null = body.store_id ?? body.loja_id ?? null;
  const session_id: string | null = body.session_id ?? null;
  const conta_id_in: string | null = body.conta_id ?? null;
  const contact_phone_raw: string = body.contact_phone ?? "";
  const contact_jid_raw: string = body.contact_jid ?? "";
  const contact_lid_raw: string = body.contact_lid ?? "";
  const contact_name: string | null = body.contact_name ?? null;
  const message_id: string | null = body.message_id ?? null;
  const direction: string | null = body.direction ?? null;
  const from_me: boolean =
    typeof body.from_me === "boolean" ? body.from_me : direction === "outbound";
  const message_text: string | null = body.message_text ?? null;
  const message_type: string = body.message_type ?? "text";
  const ts: string = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
  const raw_payload = body.raw_payload ?? body;

  // Resolve identificadores. NUNCA usar LID como contact_phone.
  let parsed = parseJid(contact_jid_raw || contact_phone_raw);
  const phoneOnly = (contact_phone_raw || "").replace(/\D+/g, "");
  // Só aceita contact_phone se for um número real (E.164 até 15 dígitos).
  if (phoneOnly && phoneOnly.length <= 15) {
    parsed = {
      jid: parsed.jid ?? `${phoneOnly}@s.whatsapp.net`,
      phone: phoneOnly,
      lid: parsed.lid,
    };
  }
  // contact_lid explícito do gateway tem prioridade sobre heurística
  if (contact_lid_raw) {
    const lidDigits = String(contact_lid_raw).replace(/\D+/g, "") || String(contact_lid_raw);
    parsed = {
      jid: parsed.jid ?? `${lidDigits}@lid`,
      phone: parsed.phone, // nunca sobrescreve telefone com LID
      lid: lidDigits,
    };
  }

  if (!parsed.jid && !parsed.phone && !parsed.lid) {
    return json({ success: false, error: "contact identifier inválido" }, 400);
  }

  // Localiza a conta WhatsApp: prioriza conta_id, senão loja + session_id.
  let conta: { id: string; loja_id: string } | null = null;
  if (conta_id_in) {
    const r = await supabase
      .from("whatsapp_contas")
      .select("id, loja_id")
      .eq("id", conta_id_in)
      .maybeSingle();
    conta = (r.data as any) ?? null;
  }
  if (!conta) {
    let contaQuery = supabase.from("whatsapp_contas").select("id, loja_id").limit(1);
    if (store_id) contaQuery = contaQuery.eq("loja_id", store_id);
    if (session_id) contaQuery = contaQuery.eq("sessao_ref", session_id);
    const r = await contaQuery.maybeSingle();
    conta = (r.data as any) ?? null;
  }
  if (!conta) return json({ success: false, error: "conta WhatsApp não encontrada" }, 404);

  const wa_chat_id = parsed.jid ?? (parsed.phone ? `${parsed.phone}@s.whatsapp.net` : `${parsed.lid}@lid`);

  // 8. Dedup por wa_message_id
  if (message_id) {
    const { data: existeMsg } = await supabase
      .from("whatsapp_mensagens")
      .select("id, conversa_id")
      .eq("conta_id", conta.id)
      .eq("wa_message_id", message_id)
      .maybeSingle();
    if (existeMsg) {
      return json({ success: true, conversation_id: existeMsg.conversa_id, message_id: existeMsg.id, duplicated: true });
    }
  }

  // Localiza conversa: por telefone real > por JID exato > por LID > por nome (mapping anterior)
  let conv: { id: string; nao_lidas: number } | null = null;

  if (parsed.phone) {
    const r = await supabase
      .from("whatsapp_conversas")
      .select("id, nao_lidas")
      .eq("conta_id", conta.id)
      .eq("contact_phone", parsed.phone)
      .maybeSingle();
    conv = (r.data as any) ?? null;
  }
  if (!conv) {
    const r = await supabase
      .from("whatsapp_conversas")
      .select("id, nao_lidas")
      .eq("conta_id", conta.id)
      .eq("wa_chat_id", wa_chat_id)
      .maybeSingle();
    conv = (r.data as any) ?? null;
  }
  if (!conv && parsed.lid) {
    const r = await supabase
      .from("whatsapp_conversas")
      .select("id, nao_lidas")
      .eq("conta_id", conta.id)
      .eq("contact_lid", parsed.lid)
      .maybeSingle();
    conv = (r.data as any) ?? null;
  }
  if (!conv && contact_name) {
    const r = await supabase
      .from("whatsapp_conversas")
      .select("id, nao_lidas")
      .eq("conta_id", conta.id)
      .eq("contact_name", contact_name)
      .is("contact_phone", null)
      .maybeSingle();
    conv = (r.data as any) ?? null;
  }

  let conversation_id: string;
  if (!conv) {
    const { data: novaConv, error: errConv } = await supabase
      .from("whatsapp_conversas")
      .insert({
        conta_id: conta.id,
        loja_id: conta.loja_id,
        wa_chat_id,
        titulo: contact_name,
        contact_name,
        contact_phone: parsed.phone,
        contact_jid: parsed.jid,
        contact_lid: parsed.lid,
        is_group: wa_chat_id.endsWith("@g.us"),
        ultima_mensagem_em: ts,
        ultima_mensagem_preview: (message_text ?? "[mídia]").slice(0, 200),
        nao_lidas: from_me ? 0 : 1,
      })
      .select("id")
      .single();
    if (errConv) return json({ success: false, error: errConv.message }, 500);
    conversation_id = novaConv.id;
  } else {
    conversation_id = conv.id;
    const updates: Record<string, any> = {
      ultima_mensagem_em: ts,
      ultima_mensagem_preview: (message_text ?? "[mídia]").slice(0, 200),
      nao_lidas: from_me ? conv.nao_lidas : (conv.nao_lidas ?? 0) + 1,
    };
    if (parsed.phone) updates.contact_phone = parsed.phone;
    if (parsed.jid) updates.contact_jid = parsed.jid;
    if (parsed.lid) updates.contact_lid = parsed.lid;
    if (contact_name) updates.contact_name = contact_name;
    await supabase.from("whatsapp_conversas").update(updates).eq("id", conversation_id);
  }

  const { data: inserted, error: errMsg } = await supabase
    .from("whatsapp_mensagens")
    .insert({
      conta_id: conta.id,
      loja_id: conta.loja_id,
      conversa_id: conversation_id,
      wa_chat_id,
      wa_message_id: message_id,
      contact_phone: parsed.phone,
      contact_jid: parsed.jid,
      contact_lid: parsed.lid,
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

  await supabase.from("whatsapp_eventos").insert({
    conta_id: conta.id,
    loja_id: conta.loja_id,
    tipo: "mensagem_recebida",
    payload: body,
  });

  return json({ success: true, conversation_id, message_id: inserted.id });
}

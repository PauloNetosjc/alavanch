import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-poll-status — consulta GET {GATEWAY_URL}/sessions/{session_id}/status
// e atualiza whatsapp_contas com qr_code/status/numero. Devolve o snapshot.

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
      .select("id, sessao_ref")
      .eq("id", conta_id)
      .maybeSingle();
    if (error || !conta) return json({ erro: "conta não encontrada" }, 404);
    if (!conta.sessao_ref) return json({ ok: true, status: "desconectado" });

    const gw = gatewayConfig();
    if (!gw.ok) return json({ ok: false, configured: false, erro: "Gateway não configurado" });

    const r = await fetch(`${gw.url}/sessions/${encodeURIComponent(conta.sessao_ref)}/status`, {
      headers: { "x-gateway-secret": gw.secret },
    });
    const data = await r.json().catch(() => ({} as Record<string, unknown>));

    if (r.ok) {
      const status = (data as { status?: string }).status ?? null;
      const qr = (data as { qr_code?: string | null }).qr_code ?? null;
      const numero = (data as { numero?: string | null; phone?: string | null }).numero ??
        (data as { phone?: string | null }).phone ?? null;

      const update: Record<string, unknown> = {};
      if (status) update.status_conexao = status;
      if (qr !== null) {
        update.qr_code = qr;
        update.qr_atualizado_em = new Date().toISOString();
      }
      if (numero) update.numero_conectado = numero;
      if (status === "conectado") {
        update.ultima_conexao_em = new Date().toISOString();
        update.qr_code = null;
      }
      if (Object.keys(update).length) {
        await supabase.from("whatsapp_contas").update(update).eq("id", conta_id);
      }
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// whatsapp-status — diagnóstico do gateway + estado das contas WhatsApp da loja.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("WHATSAPP_GATEWAY_URL") ?? "";
    const secret = Deno.env.get("WHATSAPP_GATEWAY_SECRET") ?? "";

    const isPlaceholder = !url || url === "pending" || url.includes("localhost") || url.includes("127.0.0.1");
    const configured = !!url && !!secret && !isPlaceholder;

    let gatewayHealth: { ok: boolean; status?: number; latency_ms?: number; erro?: string } = { ok: false };

    if (configured) {
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        gatewayHealth = { ok: r.ok, status: r.status, latency_ms: Date.now() - start };
      } catch (e) {
        gatewayHealth = { ok: false, erro: String(e), latency_ms: Date.now() - start };
      }
    }

    // contas da loja se houver auth
    const authHeader = req.headers.get("Authorization");
    let contas: unknown[] = [];
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await supabase
        .from("whatsapp_contas")
        .select("id, nome, tipo_integracao, status_conexao, numero_conectado, historico_sync_status, ultima_conexao_em")
        .eq("ativo", true);
      contas = data ?? [];
    }

    return json({
      configured,
      secrets: {
        WHATSAPP_GATEWAY_URL: !!url && !isPlaceholder,
        WHATSAPP_GATEWAY_SECRET: !!secret,
      },
      gateway: gatewayHealth,
      contas,
      aviso:
        "WhatsApp Web é modo experimental/não oficial. Histórico completo antigo não é garantido — apenas conversas recentes disponíveis no dispositivo vinculado.",
    });
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

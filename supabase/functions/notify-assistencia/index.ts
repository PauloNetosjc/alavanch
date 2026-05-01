// Edge function: notify-assistencia
// Envia notificações por e-mail (Resend) e WhatsApp (Z-API/Evolution genérico)
// para os usuários informados, em complemento às notificações in-app.
// Tolera ausência de configuração: se não houver chaves, retorna 200 com {skipped:true}.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_ids = [], titulo, mensagem, assistencia_id, tipo } = body || {};
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return json({ skipped: true, reason: "no_recipients" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Recupera dados dos usuários (precisamos do email do auth, e telefone do profile se houver)
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const recipients = (users || []).filter((u: any) => user_ids.includes(u.id));

    const RESEND = Deno.env.get("RESEND_API_KEY");
    const WHATS_URL = Deno.env.get("WHATSAPP_API_URL");
    const WHATS_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");

    const results: any[] = [];

    // E-mail
    if (RESEND) {
      for (const u of recipients) {
        if (!u.email) continue;
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND}`,
            },
            body: JSON.stringify({
              from: "Assistência <onboarding@resend.dev>",
              to: [u.email],
              subject: titulo || "Notificação de chamado",
              html: `<p>${mensagem || titulo || ""}</p><p>Tipo: ${tipo}</p><p>Chamado: ${assistencia_id}</p>`,
            }),
          });
          results.push({ channel: "email", to: u.email, ok: r.ok });
        } catch (e) {
          results.push({ channel: "email", to: u.email, ok: false, error: String(e) });
        }
      }
    } else {
      results.push({ channel: "email", skipped: true });
    }

    // WhatsApp (genérico — POST com token)
    if (WHATS_URL && WHATS_TOKEN) {
      // Buscar telefones dos profiles
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo");
      // O modelo de profile não tem telefone; este bloco fica como ponto de extensão.
      // Aqui apenas registramos a tentativa (ainda não implementada por falta de campo).
      results.push({ channel: "whatsapp", skipped: true, reason: "phone_field_missing" });
    } else {
      results.push({ channel: "whatsapp", skipped: true });
    }

    return json({ ok: true, results });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

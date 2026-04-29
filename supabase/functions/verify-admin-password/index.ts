// Verifica se a senha informada pertence a um admin da mesma loja.
// Não inicia sessão — apenas valida credenciais e checa role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { password } = await req.json();
    if (!password) {
      return new Response(JSON.stringify({ ok: false, error: "Senha obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // identifica o usuário que pediu
    const sbUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    const requester = userData?.user;
    if (!requester) {
      return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbAdmin = createClient(url, service);

    // descobre loja do solicitante
    const { data: prof } = await sbAdmin
      .from("profiles").select("loja_id").eq("user_id", requester.id).maybeSingle();

    // procura admins da mesma loja
    const { data: admins } = await sbAdmin
      .from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (admins ?? []).map((a) => a.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhum admin cadastrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // pega emails dos admins da mesma loja
    const { data: adminProfiles } = await sbAdmin
      .from("profiles").select("user_id, loja_id").in("user_id", adminIds);
    const sameLoja = (adminProfiles ?? []).filter((p) =>
      !prof?.loja_id || p.loja_id === prof.loja_id
    );

    // tenta autenticar com cada email
    for (const p of sameLoja) {
      const { data: u } = await sbAdmin.auth.admin.getUserById(p.user_id);
      const email = u?.user?.email;
      if (!email) continue;
      const probe = createClient(url, anon);
      const { data: signed, error } = await probe.auth.signInWithPassword({ email, password });
      if (!error && signed?.user) {
        return new Response(JSON.stringify({ ok: true, admin_email: email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: false, error: "Senha inválida" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

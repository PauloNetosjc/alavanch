import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Decode JWT to get caller ID without server round-trip
    const token = authHeader.replace("Bearer ", "");
    let callerId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerId = payload.sub;
      if (!callerId) throw new Error("no sub");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleCheck) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });

    const { email, password, full_name, role, store_id, telefone } = await req.json();
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "email, password and role are required" }), { status: 400, headers: corsHeaders });
    }

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, nome_completo: full_name },
    });
    if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders });

    // Update profile (loja_id + telefone + nome)
    const profileUpdate: Record<string, unknown> = {};
    if (store_id) profileUpdate.loja_id = store_id;
    if (telefone !== undefined) profileUpdate.telefone = telefone;
    if (full_name) profileUpdate.nome_completo = full_name;
    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("user_id", newUser.user.id);
    }

    // Assign role
    await supabase.from("user_roles").insert({ user_id: newUser.user.id, role });

    return new Response(JSON.stringify({ user: newUser.user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

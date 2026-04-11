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

    const { user_id, email, password, full_name, role, store_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: corsHeaders });
    }

    // Update auth user (email/password)
    const updatePayload: Record<string, unknown> = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (full_name !== undefined) updatePayload.user_metadata = { full_name };

    if (Object.keys(updatePayload).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(user_id, updatePayload);
      if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
    }

    // Update profile
    const profilePayload: Record<string, unknown> = {};
    if (full_name !== undefined) profilePayload.full_name = full_name;
    if (store_id !== undefined) profilePayload.store_id = store_id || null;
    if (Object.keys(profilePayload).length > 0) {
      await supabase.from("profiles").update(profilePayload).eq("user_id", user_id);
    }

    // Update role if provided
    if (role) {
      const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", user_id).maybeSingle();
      if (existingRole) {
        await supabase.from("user_roles").update({ role }).eq("user_id", user_id);
      } else {
        await supabase.from("user_roles").insert({ user_id, role });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

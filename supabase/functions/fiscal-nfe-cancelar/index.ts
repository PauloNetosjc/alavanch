// fiscal-nfe-cancelar — estrutura preparada; cancelamento real DESABILITADO nesta fase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);
  const supaUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await supaUser.auth.getUser();
  if (!u?.user) return jsonResp({ error: "Unauthorized" }, 401);

  return jsonResp({
    ok: false,
    status: "nao_implementado",
    mensagem: "Cancelamento de NF-e será habilitado em fase posterior, após homologação aprovada.",
  }, 501);
});

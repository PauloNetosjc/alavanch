// fiscal-certificado-cifrar — recebe senha + cert_id e cifra com AES-256-GCM.
// A senha JAMAIS persiste em texto puro: este endpoint é a ponte segura.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptString } from "../_shared/fiscal/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResp(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);
  const supaUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await supaUser.auth.getUser();
  if (!u?.user) return jsonResp({ error: "Unauthorized" }, 401);

  let body: { cert_id?: string; senha?: string } = {};
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400); }
  if (!body.cert_id || !body.senha) return jsonResp({ error: "cert_id e senha obrigatórios" }, 400);

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // valida que usuário tem acesso à loja do certificado
  const { data: cert } = await supa.from("certificados_digitais").select("id,loja_id").eq("id", body.cert_id).maybeSingle();
  if (!cert) return jsonResp({ error: "Certificado não encontrado" }, 404);

  const { data: rolesRows } = await supa.from("user_roles").select("role").eq("user_id", u.user.id);
  const isAdmin = (rolesRows ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    const { data: v } = await supa.from("user_lojas").select("loja_id").eq("user_id", u.user.id).eq("loja_id", cert.loja_id).maybeSingle();
    if (!v) return jsonResp({ error: "Sem acesso à loja" }, 403);
  }

  try {
    const enc = await encryptString(body.senha);
    await supa.from("certificados_digitais").update({
      senha_cifrada: enc.cifrado,
      senha_iv: enc.iv,
      senha_tag: enc.tag,
      senha_algoritmo: enc.algoritmo,
      senha_encrypted: null,
      status: "ativo",
    }).eq("id", body.cert_id);
    return jsonResp({ ok: true });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
});

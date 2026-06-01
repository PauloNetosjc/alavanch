// fiscal-nfe-consultar — consulta protocolo/recibo de uma nota já enviada.
// Implementação inicial: lê estado atual da nota e retorna; em fases seguintes
// fará chamada real a NfeRetAutorizacao4 / NfeConsultaProtocolo4.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { registrarEvento } from "../_shared/fiscal/fiscalLogService.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: { nota_fiscal_id?: string } = {};
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400); }
  if (!body.nota_fiscal_id) return jsonResp({ error: "nota_fiscal_id obrigatório" }, 400);

  const { data: nota, error } = await supa.from("notas_fiscais").select("*").eq("id", body.nota_fiscal_id).maybeSingle();
  if (error || !nota) return jsonResp({ error: "Nota não encontrada" }, 404);

  await registrarEvento(supa, {
    nota_fiscal_id: nota.id, loja_id: nota.loja_id, tipo: "consulta_recibo",
    descricao: "Consulta manual do status", user_id: u.user.id,
  });

  return jsonResp({
    ok: true,
    status: nota.status,
    chave: nota.chave_acesso ?? nota.chave,
    protocolo: nota.protocolo_autorizacao ?? nota.protocolo,
    mensagem: nota.mensagem_retorno,
    numero_recibo: nota.numero_recibo,
    nota: "Consulta SEFAZ ao vivo (NfeRetAutorizacao4) ainda não habilitada — retornando estado atual da base.",
  });
});

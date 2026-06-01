// fiscal-status — diagnóstico do backend fiscal Alavanch.
// NUNCA retorna valores de secrets. Apenas indica configurado/ausente.
// Faz GET /health no gateway quando configurado.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const url = new URL(req.url);
  const lojaId = url.searchParams.get("loja_id");

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Secrets — só dizemos se existe, nunca o valor
  const secrets = {
    FISCAL_CRYPTO_KEY: !!Deno.env.get("FISCAL_CRYPTO_KEY"),
    URL_DO_PORTAL_FISCAL: !!Deno.env.get("FISCAL_GATEWAY_URL"),
    SEGREDO_DO_PORTAL_FISCAL: !!Deno.env.get("FISCAL_GATEWAY_SECRET"),
  };

  // Healthcheck gateway
  let gateway: any = { configurado: secrets.URL_DO_PORTAL_FISCAL && secrets.SEGREDO_DO_PORTAL_FISCAL };
  if (gateway.configurado) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${Deno.env.get("FISCAL_GATEWAY_URL")!.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
      clearTimeout(to);
      const body = await r.json().catch(() => ({} as any));
      gateway = {
        configurado: true, ok: r.ok && body?.ok === true,
        httpStatus: r.status, service: body?.service, env: body?.env,
        ts: body?.ts, duracao_ms: Date.now() - t0,
      };
    } catch (e) {
      gateway = { configurado: true, ok: false, erro: (e as Error).message, duracao_ms: Date.now() - t0 };
    }
  } else {
    gateway = { ...gateway, ok: false, mensagem: "Gateway fiscal mTLS não configurado" };
  }

  // Dados por loja (quando informada)
  let cfg: any = null;
  let cert: any = null;
  let rascunho: { id: string; numero: string | null; tipo: string } | null = null;
  if (lojaId) {
    const { data: vinculo } = await supa.from("user_lojas").select("loja_id").eq("user_id", userId).eq("loja_id", lojaId).maybeSingle();
    const { data: rolesRows } = await supa.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (rolesRows ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin && !vinculo) return jsonResp({ error: "Sem acesso à loja" }, 403);

    const [{ data: c }, { data: ce }, { data: ra }] = await Promise.all([
      supa.from("configuracoes_fiscais").select("ambiente,cnpj,razao_social,uf,municipio,codigo_municipio_ibge,proximo_numero_nfe,emitir_nfe").eq("loja_id", lojaId).maybeSingle(),
      supa.from("certificados_digitais").select("id,nome,validade_fim,status,senha_cifrada").eq("loja_id", lojaId).in("status", ["ativo", "pendente_validacao"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supa.from("notas_fiscais").select("id,numero,tipo").eq("loja_id", lojaId).eq("tipo", "nfe").eq("ambiente", "homologacao").in("status", ["rascunho", "pronta_para_emitir"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    cfg = c ? {
      completo: !!(c.cnpj && c.razao_social && c.uf && c.municipio && c.codigo_municipio_ibge),
      ambiente: c.ambiente ?? "homologacao",
      cnpj: !!c.cnpj, razao_social: !!c.razao_social, uf: c.uf,
      municipio: !!c.municipio, codigo_municipio_ibge: !!c.codigo_municipio_ibge,
      proximo_numero_nfe: c.proximo_numero_nfe ?? null,
      emitir_nfe: !!c.emitir_nfe,
    } : { completo: false };
    cert = ce ? {
      id: ce.id, nome: ce.nome, validade_fim: ce.validade_fim, status: ce.status,
      senha_cifrada: !!ce.senha_cifrada,
    } : null;
    rascunho = ra ? { id: ra.id, numero: ra.numero, tipo: ra.tipo } : null;
  }

  return jsonResp({
    ok: true,
    edge_functions: ["fiscal-nfe-emitir", "fiscal-nfe-consultar", "fiscal-nfe-cancelar", "fiscal-certificado-cifrar", "fiscal-status"],
    secrets,
    gateway,
    ambiente: cfg?.ambiente ?? "homologacao",
    producao_bloqueada: true,
    cfg, cert, rascunho_teste: rascunho,
    timestamp: new Date().toISOString(),
  });
});

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Feriados estaduais obrigatórios (não facultativos) por UF
// MM-DD => descrição
const FERIADOS_ESTADUAIS: Record<string, Array<{ d: string; n: string }>> = {
  SP: [{ d: "07-09", n: "Revolução Constitucionalista (SP)" }],
  RJ: [
    { d: "04-23", n: "São Jorge (RJ)" },
    { d: "11-20", n: "Consciência Negra (RJ)" },
  ],
  MG: [{ d: "04-21", n: "Tiradentes / Data Magna de MG" }],
  BA: [{ d: "07-02", n: "Independência da Bahia" }],
  PE: [{ d: "03-06", n: "Revolução Pernambucana" }],
  AL: [{ d: "09-16", n: "Emancipação Política de Alagoas" }],
  AM: [{ d: "09-05", n: "Elevação do Amazonas à Província" }],
  AP: [{ d: "09-13", n: "Criação do Território Federal do Amapá" }],
  CE: [{ d: "03-25", n: "Abolição da Escravatura no Ceará" }],
  DF: [{ d: "04-21", n: "Aniversário de Brasília" }],
  ES: [{ d: "10-28", n: "Dia do Servidor Público (ES)" }],
  GO: [{ d: "10-28", n: "Dia do Servidor Público (GO)" }],
  MA: [{ d: "07-28", n: "Adesão do Maranhão à Independência" }],
  MT: [{ d: "11-20", n: "Consciência Negra (MT)" }],
  MS: [{ d: "10-11", n: "Criação de MS" }],
  PA: [{ d: "08-15", n: "Adesão do Pará à Independência" }],
  PB: [{ d: "08-05", n: "Fundação do Estado da Paraíba" }],
  PR: [{ d: "12-19", n: "Emancipação Política do Paraná" }],
  PI: [{ d: "10-19", n: "Dia do Piauí" }],
  RN: [{ d: "10-03", n: "Mártires de Cunhaú e Uruaçu (RN)" }],
  RS: [{ d: "09-20", n: "Revolução Farroupilha" }],
  RO: [{ d: "01-04", n: "Criação do Estado de Rondônia" }],
  RR: [{ d: "10-05", n: "Criação do Estado de Roraima" }],
  SC: [{ d: "08-11", n: "Criação da Capitania de SC" }],
  SE: [{ d: "07-08", n: "Emancipação Política de Sergipe" }],
  TO: [{ d: "10-05", n: "Criação do Estado do Tocantins" }],
  AC: [{ d: "06-15", n: "Aniversário do Acre" }],
};

// Feriados municipais conhecidos (capitais e grandes cidades)
// chave: "cidade|UF" (case-insensitive)
const FERIADOS_MUNICIPAIS: Record<string, Array<{ d: string; n: string }>> = {
  "são paulo|sp": [{ d: "01-25", n: "Aniversário de São Paulo" }],
  "sao paulo|sp": [{ d: "01-25", n: "Aniversário de São Paulo" }],
  "rio de janeiro|rj": [
    { d: "01-20", n: "São Sebastião (Rio de Janeiro)" },
  ],
  "belo horizonte|mg": [{ d: "12-08", n: "Imaculada Conceição (BH)" }],
  "salvador|ba": [{ d: "07-02", n: "Independência da Bahia (Salvador)" }],
  "fortaleza|ce": [{ d: "04-13", n: "Fundação de Fortaleza" }],
  "recife|pe": [{ d: "06-12", n: "Nossa Senhora do Carmo (Recife)" }],
  "curitiba|pr": [{ d: "09-08", n: "Nossa Senhora da Luz (Curitiba)" }],
  "porto alegre|rs": [{ d: "02-02", n: "Navegantes (Porto Alegre)" }],
  "brasília|df": [{ d: "04-21", n: "Aniversário de Brasília" }],
  "brasilia|df": [{ d: "04-21", n: "Aniversário de Brasília" }],
  "manaus|am": [{ d: "10-24", n: "Aniversário de Manaus" }],
  "belém|pa": [{ d: "01-06", n: "Aniversário de Belém" }],
  "belem|pa": [{ d: "01-06", n: "Aniversário de Belém" }],
  "goiânia|go": [{ d: "10-24", n: "Aniversário de Goiânia" }],
  "goiania|go": [{ d: "10-24", n: "Aniversário de Goiânia" }],
  "campinas|sp": [{ d: "07-14", n: "Aniversário de Campinas" }],
  "santos|sp": [{ d: "01-26", n: "Aniversário de Santos" }],
  "guarulhos|sp": [{ d: "12-08", n: "Aniversário de Guarulhos" }],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const years = [now.getFullYear(), now.getFullYear() + 1];

    // 1) Feriados nacionais via BrasilAPI
    const nacionais: Array<{ date: string; name: string }> = [];
    for (const y of years) {
      try {
        const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${y}`);
        if (r.ok) {
          const data = await r.json();
          for (const f of data) nacionais.push({ date: f.date, name: f.name });
        }
      } catch (_e) { /* ignora */ }
    }

    // 2) Lojas com cidade/uf
    const { data: lojas } = await supabase
      .from("lojas")
      .select("id, nome, cidade, uf")
      .eq("ativo", true);

    const rows: Array<{ loja_id: string | null; data: string; descricao: string }> = [];

    // Nacionais — uma linha "global" (loja_id = null)
    for (const f of nacionais) {
      rows.push({ loja_id: null, data: f.date, descricao: f.name });
    }

    // Estaduais + municipais por loja
    for (const l of (lojas || []) as any[]) {
      const uf = (l.uf || "").trim().toUpperCase();
      const cidade = (l.cidade || "").trim().toLowerCase();

      const adicionar = (mmdd: string, desc: string) => {
        for (const y of years) {
          rows.push({ loja_id: l.id, data: `${y}-${mmdd}`, descricao: desc });
        }
      };

      if (uf && FERIADOS_ESTADUAIS[uf]) {
        for (const f of FERIADOS_ESTADUAIS[uf]) adicionar(f.d, f.n);
      }
      const cityKey = `${cidade}|${uf.toLowerCase()}`;
      if (FERIADOS_MUNICIPAIS[cityKey]) {
        for (const f of FERIADOS_MUNICIPAIS[cityKey]) adicionar(f.d, f.n);
      }
    }

    // Upsert evitando duplicar (índice único: data+loja_id+descricao)
    let inseridos = 0;
    let ignorados = 0;
    for (const r of rows) {
      const { error } = await supabase
        .from("agenda_feriados")
        .insert(r);
      if (error) {
        if (error.code === "23505") ignorados++; // duplicate key
        else console.error(error);
      } else inseridos++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: rows.length,
        inseridos,
        ja_existiam: ignorados,
        lojas_processadas: (lojas || []).length,
        anos: years,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

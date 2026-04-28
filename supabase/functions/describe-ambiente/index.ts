// Generates a short Portuguese description of an environment from Promob items
// using Lovable AI. Returns { description: string }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome, itens } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resumoItens = (itens ?? [])
      .slice(0, 40)
      .map((it: any) =>
        `- ${it.descricao}${it.cor ? ` (${it.cor})` : ""}${it.categoria ? ` [${it.categoria}]` : ""}`,
      )
      .join("\n");

    const prompt = `Você analisa projetos de móveis planejados. Gere UMA frase curta (máx. 25 palavras) descrevendo o ambiente abaixo, mencionando material/acabamento principal quando identificável. Não use bullets, não comece com "Ambiente". Responda apenas a frase.

Ambiente: ${nome}
Itens:
${resumoItens}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (r.status === 429) {
      return new Response(JSON.stringify({ description: "" , rateLimited: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`AI error ${r.status}: ${t}`);
    }
    const data = await r.json();
    const description = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

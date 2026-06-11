import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let token: string | null = null;
    const url = new URL(req.url);
    token = url.searchParams.get("token");
    if (!token && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        token = body?.token || null;
      } catch { /* ignore */ }
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: part } = await supabase
      .from("assinatura_participantes")
      .select("solicitacao_id")
      .eq("token", token)
      .maybeSingle();

    if (!part) {
      return new Response(JSON.stringify({ error: "token inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: solic } = await supabase
      .from("solicitacoes_assinatura")
      .select("storage_path, bucket_name, file_name, mime_type, file_url")
      .eq("id", (part as any).solicitacao_id)
      .maybeSingle();

    if (!solic) {
      return new Response(JSON.stringify({ error: "solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const s = solic as any;
    let resultUrl: string | null = null;

    if (s.storage_path) {
      const bucket = s.bucket_name || "documentos";
      const { data: signed, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(s.storage_path, 60 * 60);

      if (!error && signed?.signedUrl) {
        resultUrl = signed.signedUrl;
      }
    }

    if (!resultUrl && s.file_url) {
      resultUrl = s.file_url;
    }

    return new Response(
      JSON.stringify({
        url: resultUrl,
        nome: s.file_name || null,
        mime: s.mime_type || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

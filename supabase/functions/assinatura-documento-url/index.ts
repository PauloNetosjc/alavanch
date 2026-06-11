import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
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

    // 1) participante -> solicitação
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
    if (s.storage_path && s.bucket_name) {
      const { data: signed, error } = await supabase
        .storage
        .from(s.bucket_name)
        .createSignedUrl(s.storage_path, 60 * 60);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          url: signed.signedUrl,
          nome: s.file_name,
          mime: s.mime_type,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (s.file_url) {
      return new Response(
        JSON.stringify({ url: s.file_url, nome: s.file_name, mime: s.mime_type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

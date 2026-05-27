import { supabase } from "@/integrations/supabase/client";

/**
 * Após a conclusão de uma solicitação de assinatura, move o documento
 * vinculado para a pasta "Documentos" da Central de Documentos do pedido,
 * arquivando-o automaticamente junto com o acesso às evidências
 * (que continuam acessíveis via solicitacoes_assinatura.pedido_documento_id).
 */
export async function arquivarDocumentoAssinado(solicitacaoId: string) {
  try {
    const { data: solic } = await supabase
      .from("solicitacoes_assinatura")
      .select("id, pedido_id, pedido_documento_id, status")
      .eq("id", solicitacaoId)
      .maybeSingle();

    if (!solic?.pedido_id || !solic?.pedido_documento_id) return;
    if (solic.status !== "concluido") return;

    // Garante a pasta "Documentos"
    let { data: pasta } = await supabase
      .from("pedido_pastas")
      .select("id, nome")
      .eq("pedido_id", solic.pedido_id)
      .ilike("nome", "documentos")
      .maybeSingle();

    if (!pasta) {
      const { data: criada } = await supabase
        .from("pedido_pastas")
        .insert({ pedido_id: solic.pedido_id, nome: "Documentos", ordem: 99 })
        .select("id, nome")
        .single();
      pasta = criada;
    }
    if (!pasta?.id) return;

    await supabase
      .from("pedido_documentos")
      .update({ pasta_id: pasta.id })
      .eq("id", solic.pedido_documento_id);
  } catch (e) {
    console.error("[arquivarDocumentoAssinado]", e);
  }
}

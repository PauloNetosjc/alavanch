import { supabase } from "@/integrations/supabase/client";

export type EmitirNfeResultado = {
  ok: boolean;
  status: string;
  chave?: string;
  protocolo?: string;
  mensagem?: string;
  erros?: string[];
  erro?: string;
  cStat?: string;
};

/**
 * Dispara a emissão de NF-e em HOMOLOGAÇÃO via Edge Function.
 * - Toda a manipulação de certificado e XML acontece no backend.
 * - O frontend só envia o id da nota e exibe o retorno.
 */
export async function emitirNfeHomologacao(nota_fiscal_id: string): Promise<EmitirNfeResultado> {
  const { data, error } = await supabase.functions.invoke("fiscal-nfe-emitir", {
    body: { nota_fiscal_id },
  });
  if (error) {
    return { ok: false, status: "erro_transmissao", erro: error.message };
  }
  return (data ?? { ok: false, status: "erro_transmissao", erro: "Resposta vazia" }) as EmitirNfeResultado;
}

export async function consultarNfe(nota_fiscal_id: string): Promise<EmitirNfeResultado> {
  const { data, error } = await supabase.functions.invoke("fiscal-nfe-consultar", { body: { nota_fiscal_id } });
  if (error) return { ok: false, status: "erro_transmissao", erro: error.message };
  return data as EmitirNfeResultado;
}

/**
 * Cria signed URL para baixar arquivo do bucket privado notas-fiscais.
 */
export async function signedUrlNotaFiscal(path: string, expiresInSec = 600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("notas-fiscais").createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

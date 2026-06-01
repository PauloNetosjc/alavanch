// certificadoService — manipula PFX/A1 SOMENTE no backend.
// - localiza certificado ativo da loja
// - baixa PFX do storage privado
// - decifra senha (AES-256-GCM)
// - valida validade
// - NUNCA retorna PFX ou senha pelo response da edge function

import { decryptString } from "./crypto.ts";

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface CertificadoCarregado {
  id: string;
  loja_id: string;
  pfx: Uint8Array;
  senha: string;
  cnpj?: string | null;
  razao_social?: string | null;
  validade_fim: string;
  status: string;
}

export class CertificadoError extends Error {
  constructor(public code: string, msg: string) {
    super(msg);
  }
}

export async function carregarCertificadoAtivo(
  supabase: SupabaseLike,
  loja_id: string,
): Promise<CertificadoCarregado> {
  const { data, error } = await supabase
    .from("certificados_digitais")
    .select("*")
    .eq("loja_id", loja_id)
    .eq("status", "ativo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new CertificadoError("DB_ERROR", error.message);
  if (!data) throw new CertificadoError("NAO_ENCONTRADO", "Nenhum certificado ativo para esta loja");

  // Validade
  if (data.validade_fim) {
    const fim = new Date(data.validade_fim);
    if (fim.getTime() < Date.now()) {
      throw new CertificadoError("VENCIDO", `Certificado vencido em ${data.validade_fim}`);
    }
  }

  // Decifrar senha — primeiro o caminho novo (cifrada/iv/tag); fallback para senha_encrypted legada (texto puro).
  let senha = "";
  if (data.senha_cifrada && data.senha_iv && data.senha_tag) {
    try {
      senha = await decryptString(data.senha_cifrada, data.senha_iv, data.senha_tag);
    } catch (e) {
      throw new CertificadoError("SENHA_INVALIDA", "Falha ao decifrar senha do certificado: " + (e as Error).message);
    }
  } else if (data.senha_encrypted) {
    // Compat: senha legada em texto puro será migrada na próxima rodada.
    senha = data.senha_encrypted;
  } else {
    throw new CertificadoError("SENHA_AUSENTE", "Senha do certificado não cadastrada");
  }

  // Baixar PFX do storage privado
  const path = data.storage_path;
  if (!path) throw new CertificadoError("PFX_AUSENTE", "PFX do certificado não localizado");

  const { data: file, error: dlErr } = await supabase.storage.from("certificados-digitais").download(path);
  if (dlErr || !file) throw new CertificadoError("PFX_DOWNLOAD", "Falha ao baixar PFX: " + (dlErr?.message ?? "desconhecido"));
  const buf = new Uint8Array(await (file as Blob).arrayBuffer());

  await supabase
    .from("certificados_digitais")
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    loja_id: data.loja_id,
    pfx: buf,
    senha,
    cnpj: data.cnpj_certificado,
    razao_social: data.razao_social_certificado,
    validade_fim: data.validade_fim,
    status: data.status,
  };
}

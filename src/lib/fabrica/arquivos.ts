import { supabase } from "@/integrations/supabase/client";

export async function uploadArquivoFabrica(
  pedidoId: string,
  file: File,
  tipo: string,
  obrigatorio: boolean,
): Promise<{ id: string; url: string } | null> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${pedidoId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from("fabrica-arquivos").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    console.error("[uploadArquivoFabrica] upload", upErr);
    throw upErr;
  }
  const { data: signed } = await supabase.storage
    .from("fabrica-arquivos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  const url = signed?.signedUrl || path;

  const { data: ins, error } = await (supabase as any)
    .from("fabrica_arquivos_producao")
    .insert({
      pedido_id: pedidoId,
      tipo_arquivo: tipo,
      nome_arquivo: file.name,
      url_arquivo: path,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
      obrigatorio,
      processado: false,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[uploadArquivoFabrica] insert", error);
    throw error;
  }
  return { id: ins.id, url };
}

export async function getSignedUrlFabrica(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("fabrica-arquivos")
    .createSignedUrl(path, 60 * 60 * 4);
  return data?.signedUrl ?? null;
}

export async function removerArquivoFabrica(id: string, path: string) {
  await supabase.storage.from("fabrica-arquivos").remove([path]);
  await (supabase as any).from("fabrica_arquivos_producao").delete().eq("id", id);
}

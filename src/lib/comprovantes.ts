import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "parceiro-comprovantes";

/** Abre o comprovante em nova aba usando signed URL (válida 60s). */
export async function abrirComprovante(storage_path: string) {
  if (!storage_path) return toast.error("Caminho do comprovante inválido");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, 60);
  if (error || !data?.signedUrl) return toast.error(error?.message || "Não foi possível gerar URL");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/** Faz download do comprovante (força save). */
export async function baixarComprovante(storage_path: string, nome?: string) {
  if (!storage_path) return toast.error("Caminho do comprovante inválido");
  const { data, error } = await supabase.storage.from(BUCKET).download(storage_path);
  if (error || !data) return toast.error(error?.message || "Falha no download");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome || storage_path.split("/").pop() || "comprovante";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

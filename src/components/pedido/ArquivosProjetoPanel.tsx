import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Download, Eye, Trash2, Lock, Folder, CheckCircle2, AlertCircle, Loader2, Archive } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import JSZip from "jszip";
import { sanitizeStorageFileName } from "@/lib/storagePath";

/* ============================================================
 * Arquivos do Projeto — 3 seções sequenciais (upload múltiplo)
 *  - Projeto Vendido
 *  - Projeto para Revisão (exige Vendido)
 *  - Projeto Revisado (exige para Revisão)
 *
 * Usa tabela public.pedido_documentos com coluna `categoria_projeto`
 * e bucket `pedido-docs`. A pasta default "Projeto" é garantida via
 * RPC fn_garantir_pasta_projeto. A conclusão automática das tarefas
 * nativas correspondentes é feita por trigger AFTER INSERT.
 * ============================================================ */

type Categoria = "projeto_vendido" | "projeto_para_revisao" | "projeto_revisado";

type Doc = {
  id: string;
  pedido_id: string;
  pasta_id: string | null;
  nome: string;
  storage_path: string;
  tamanho: number | null;
  mime_type: string | null;
  categoria_projeto: Categoria | null;
  created_by: string | null;
  created_at: string;
};

const SECOES: { key: Categoria; titulo: string; descricao: string; cor: string }[] = [
  {
    key: "projeto_vendido",
    titulo: "Projeto Vendido",
    descricao: "Arquivo 3D vendido (liberado após contrato assinado).",
    cor: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "projeto_para_revisao",
    titulo: "Projeto para Revisão",
    descricao: "Projeto atualizado após medição técnica.",
    cor: "bg-amber-100 text-amber-700",
  },
  {
    key: "projeto_revisado",
    titulo: "Projeto Revisado",
    descricao: "Projeto final revisado pela loja.",
    cor: "bg-blue-100 text-blue-700",
  },
];

const PRE_REQUISITO_MSG: Record<Categoria, string | null> = {
  projeto_vendido: null,
  projeto_para_revisao: "Envie primeiro o Projeto Vendido.",
  projeto_revisado: "Envie primeiro o Projeto para Revisão.",
};

function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type UploadItem = {
  nome: string;
  status: "pending" | "uploading" | "done" | "error";
  erro?: string;
};

export function ArquivosProjetoPanel({ pedido }: { pedido: any }) {
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<Categoria | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [zipKey, setZipKey] = useState<Categoria | null>(null);
  const [contratoAssinado, setContratoAssinado] = useState<boolean>(false);
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<Categoria, HTMLInputElement | null>>({
    projeto_vendido: null,
    projeto_para_revisao: null,
    projeto_revisado: null,
  });

  const podeVer = isAdmin || can("arquivos_projeto", "visualizar");
  const podeUpload = isAdmin || can("arquivos_projeto", "upload");
  const podeExcluir = isAdmin || can("arquivos_projeto", "excluir");

  const carregar = async () => {
    if (!pedido?.id) return;
    setLoading(true);
    const [{ data: docsData }, { data: solic }] = await Promise.all([
      supabase
        .from("pedido_documentos")
        .select("*")
        .eq("pedido_id", pedido.id)
        .not("categoria_projeto", "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_assinatura")
        .select("status")
        .eq("pedido_id", pedido.id)
        .in("status", ["concluido", "assinado_manual"])
        .limit(1),
    ]);
    setDocs((docsData as any) || []);
    setContratoAssinado(((solic as any[]) || []).length > 0);

    const ids = Array.from(new Set(((docsData as any[]) || []).map((d) => d.created_by).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        map[p.user_id] = p.nome_completo || "";
      });
      setUsuarios(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    if (!pedido?.id) return;
    const ch = supabase
      .channel(`arquivos-projeto-${pedido.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_documentos", filter: `pedido_id=eq.${pedido.id}` },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id]);

  const docsPor = useMemo(() => {
    const r: Record<Categoria, Doc[]> = { projeto_vendido: [], projeto_para_revisao: [], projeto_revisado: [] };
    docs.forEach((d) => {
      const cat = d.categoria_projeto as Categoria | null;
      if (cat && r[cat]) r[cat].push(d);
    });
    return r;
  }, [docs]);

  function categoriaLiberada(cat: Categoria): { ok: boolean; motivo?: string } {
    if (!contratoAssinado) {
      return { ok: false, motivo: "Assine o contrato antes de enviar arquivos do projeto." };
    }
    if (cat === "projeto_para_revisao" && docsPor.projeto_vendido.length === 0) {
      return { ok: false, motivo: PRE_REQUISITO_MSG.projeto_para_revisao! };
    }
    if (cat === "projeto_revisado" && docsPor.projeto_para_revisao.length === 0) {
      return { ok: false, motivo: PRE_REQUISITO_MSG.projeto_revisado! };
    }
    return { ok: true };
  }

  async function handleUpload(cat: Categoria, files: FileList | null) {
    if (!pedido?.id || !files || files.length === 0) return;
    const lib = categoriaLiberada(cat);
    if (!lib.ok) {
      toast.error(lib.motivo || "Upload bloqueado.");
      return;
    }

    const fileList = Array.from(files);
    const queue: UploadItem[] = fileList.map((f) => ({ nome: f.name, status: "pending" }));
    setUploadingKey(cat);
    setUploadQueue(queue);

    let sucesso = 0;
    let falha = 0;
    const falhas: string[] = [];

    // Garante pasta "Projeto" uma única vez
    let pastaId: string | null = null;
    try {
      const { data: pId } = await (supabase as any).rpc("fn_garantir_pasta_projeto", { p_pedido_id: pedido.id });
      pastaId = pId || null;
    } catch {
      // segue sem pasta se falhar; o registro ainda entra
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadQueue((prev) => {
        const next = [...prev];
        if (next[i]) next[i].status = "uploading";
        return next;
      });

      try {
        const safe = sanitizeStorageFileName(file.name);
        const path = `${pedido.id}/${cat}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("pedido-docs").upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("pedido_documentos").insert({
          pedido_id: pedido.id,
          pasta_id: pastaId,
          nome: file.name,
          storage_path: path,
          tamanho: file.size,
          mime_type: file.type || null,
          categoria_projeto: cat,
          created_by: user?.id || null,
          bucket_name: "pedido-docs",
        } as any);
        if (insErr) {
          await supabase.storage.from("pedido-docs").remove([path]).catch(() => {});
          throw insErr;
        }

        sucesso++;
        setUploadQueue((prev) => {
          const next = [...prev];
          if (next[i]) next[i].status = "done";
          return next;
        });
      } catch (e: any) {
        const msg = e?.message || String(e);
        falha++;
        falhas.push(`${file.name}: ${msg}`);
        setUploadQueue((prev) => {
          const next = [...prev];
          if (next[i]) {
            next[i].status = "error";
            next[i].erro = msg;
          }
          return next;
        });
      }
    }

    if (sucesso > 0 && falha === 0) {
      toast.success(`${sucesso} arquivo${sucesso > 1 ? "s" : ""} enviado${sucesso > 1 ? "s" : ""}.`);
    } else if (sucesso > 0 && falha > 0) {
      toast.warning(`${sucesso} enviado${sucesso > 1 ? "s" : ""}, ${falha} falha${falha > 1 ? "s" : ""}.`);
    } else if (falha > 0) {
      toast.error(`Falha no upload de ${falha} arquivo${falha > 1 ? "s" : ""}.`);
    }

    if (falhas.length > 0) {
      // toast detalhado com nomes
      falhas.forEach((f) => toast.error(f, { duration: 5000 }));
    }

    setUploadingKey(null);
    setUploadQueue([]);
    // limpa input
    const ref = fileRefs.current[cat];
    if (ref) ref.value = "";
  }

  async function handleVisualizar(d: Doc) {
    const { data, error } = await supabase.storage.from("pedido-docs").createSignedUrl(d.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Falha ao abrir arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleBaixar(d: Doc) {
    const { data, error } = await supabase.storage.from("pedido-docs").createSignedUrl(d.storage_path, 60, {
      download: d.nome,
    });
    if (error || !data?.signedUrl) {
      toast.error("Falha ao baixar arquivo.");
      return;
    }
    window.location.href = data.signedUrl;
  }

  async function handleExcluir(d: Doc) {
    if (!podeExcluir) {
      toast.error("Sem permissão para excluir.");
      return;
    }
    if (!confirm(`Excluir o arquivo "${d.nome}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("pedido_documentos").delete().eq("id", d.id);
    if (error) {
      toast.error(`Falha ao excluir: ${error.message}`);
      return;
    }
    await supabase.storage.from("pedido-docs").remove([d.storage_path]).catch(() => {});
    toast.success("Arquivo excluído.");
  }

  async function handleBaixarTodos(cat: Categoria) {
    const arquivos = docsPor[cat];
    if (arquivos.length === 0) return;
    setZipKey(cat);
    const zip = new JSZip();
    const usados: Record<string, number> = {};
    let ok = 0;
    let falha = 0;
    try {
      for (const d of arquivos) {
        try {
          const { data, error } = await supabase.storage.from("pedido-docs").download(d.storage_path);
          if (error || !data) throw error || new Error("download vazio");
          // evita colisão de nomes dentro do zip
          let nome = d.nome;
          if (usados[nome] !== undefined) {
            usados[nome] += 1;
            const dot = nome.lastIndexOf(".");
            nome = dot > 0
              ? `${nome.slice(0, dot)} (${usados[nome]})${nome.slice(dot)}`
              : `${nome} (${usados[nome]})`;
          } else {
            usados[d.nome] = 0;
          }
          zip.file(nome, data);
          ok++;
        } catch (e) {
          console.error("[baixarTodos] falha", d.nome, e);
          falha++;
        }
      }

      if (ok === 0) {
        toast.error("Não foi possível baixar os arquivos.");
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const codigo = (pedido?.codigo || pedido?.id || "pedido").toString().toLowerCase().replace(/[^a-z0-9\-]+/g, "-");
      const prefixoZip: Record<Categoria, string> = {
        projeto_vendido: "projeto-vendido",
        projeto_para_revisao: "projeto-para-revisao",
        projeto_revisado: "projeto-revisado",
      };
      const filename = `${prefixoZip[cat]}-${codigo}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      if (falha > 0) {
        toast.warning(`Alguns arquivos não puderam ser baixados (${falha} de ${arquivos.length}).`);
      } else {
        toast.success(`Download iniciado (${ok} arquivo${ok > 1 ? "s" : ""}).`);
      }
    } finally {
      setZipKey(null);
    }
  }

  if (!podeVer) return null;

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Folder className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-playfair text-[18px] font-semibold leading-none">Arquivos do Projeto</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Fluxo sequencial: Vendido → Para Revisão → Revisado. Uploads concluem automaticamente a tarefa nativa correspondente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SECOES.map((s) => {
          const arquivos = docsPor[s.key];
          const lib = categoriaLiberada(s.key);
          const bloqueado = !lib.ok;
          const isUploading = uploadingKey === s.key;
          return (
            <div key={s.key} className="border rounded-lg p-3 bg-muted/20 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className={s.cor}>{s.titulo}</Badge>
                {arquivos.length > 0 && (
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {arquivos.length} arquivo{arquivos.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{s.descricao}</p>

              <div className="flex-1 space-y-1.5 mb-2 max-h-48 overflow-y-auto">
                {loading && <div className="text-[12px] text-muted-foreground">Carregando…</div>}
                {!loading && arquivos.length === 0 && (
                  <div className="text-[12px] text-muted-foreground italic">Nenhum arquivo enviado.</div>
                )}
                {arquivos.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 p-1.5 rounded bg-background border text-[12px]">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium" title={d.nome}>{d.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {fmtBytes(d.tamanho)} • {fmtData(d.created_at)}
                        {d.created_by && usuarios[d.created_by] ? ` • ${usuarios[d.created_by]}` : ""}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleVisualizar(d)} title="Visualizar">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleBaixar(d)} title="Baixar">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {podeExcluir && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleExcluir(d)} title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <input
                  ref={(el) => (fileRefs.current[s.key] = el)}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleUpload(s.key, files);
                  }}
                />
                {bloqueado ? (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 border rounded px-2 py-1.5 bg-muted/40">
                    <Lock className="w-3.5 h-3.5" /> {lib.motivo}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!podeUpload || isUploading}
                    onClick={() => fileRefs.current[s.key]?.click()}
                  >
                    <FileUp className="w-3.5 h-3.5 mr-1.5" />
                    {isUploading
                      ? `Enviando ${uploadQueue.filter((u) => u.status === "uploading").length}/${uploadQueue.length}…`
                      : podeUpload
                        ? "Enviar arquivo(s)"
                        : "Sem permissão"}
                  </Button>
                )}

                {arquivos.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1.5"
                    disabled={zipKey === s.key}
                    onClick={() => handleBaixarTodos(s.key)}
                    title="Baixar todos os arquivos desta seção em um .zip"
                  >
                    {zipKey === s.key ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Preparando arquivos…
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5 mr-1.5" />
                        Baixar todos ({arquivos.length})
                      </>
                    )}
                  </Button>
                )}

                {/* Painel de progresso/fila */}
                {isUploading && uploadQueue.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadQueue.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border bg-background">
                        {item.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                        {item.status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {item.status === "error" && <AlertCircle className="w-3 h-3 text-destructive" />}
                        {item.status === "pending" && <div className="w-3 h-3 rounded-full bg-muted" />}
                        <span className="truncate flex-1" title={item.nome}>{item.nome}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {item.status === "uploading" && "enviando…"}
                          {item.status === "done" && "ok"}
                          {item.status === "error" && "erro"}
                          {item.status === "pending" && "aguardando"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ArquivosProjetoPanel;

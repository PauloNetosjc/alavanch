import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Pencil, Upload, Check, History, ExternalLink, Trash2, Eye, Download, FileText } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { abrirComprovante, baixarComprovante } from "@/lib/comprovantes";
import { toast } from "sonner";

type Comissao = {
  id: string; parceiro_id: string; pedido_id: string | null; cliente_id: string | null;
  contrato_numero: string | null; valor_base: number | null; percentual: number | null;
  valor_calculado: number; valor_corrigido: number | null; status: string;
  data_pagamento: string | null;
};
type Parceiro = { id: string; nome: string; tipo: string };
type Cliente = { id: string; nome: string };
type Pedido = { id: string; codigo: string };
type EventoTimeline = {
  id: string; entidade_id: string; tipo: string; descricao: string;
  usuario_id: string | null; created_at: string; metadata: any;
};
type Comprovante = { id: string; nome: string; storage_path: string; comissao_id: string | null; created_at: string };

export default function AuditoriaParceiros() {
  const [tab, setTab] = useState<"auditar" | "anexar" | "comprovantes" | "historico">("auditar");
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [comprovantes, setComprovantes] = useState<Comprovante[]>([]);
  const [historico, setHistorico] = useState<EventoTimeline[]>([]);
  const [busca, setBusca] = useState("");

  const [editDialog, setEditDialog] = useState(false);
  const [edit, setEdit] = useState<Comissao | null>(null);
  const [uploadFor, setUploadFor] = useState<Comissao | null>(null);

  async function load() {
    const [{ data: c }, { data: p }, { data: cl }, { data: pd }, { data: cp }, { data: hist }] = await Promise.all([
      supabase.from("parceiro_comissoes").select("*").order("created_at", { ascending: false }),
      supabase.from("parceiros").select("id,nome,tipo"),
      supabase.from("clientes").select("id,nome"),
      supabase.from("pedidos").select("id,codigo"),
      supabase.from("parceiro_comprovantes").select("id,nome,storage_path,comissao_id,created_at").order("created_at", { ascending: false }),
      supabase.from("timeline_eventos").select("id,entidade_id,tipo,descricao,usuario_id,created_at,metadata")
        .eq("entidade_tipo", "parceiro_comissao")
        .order("created_at", { ascending: false }).limit(500),
    ]);
    setComissoes((c as Comissao[]) || []);
    setParceiros((p as Parceiro[]) || []);
    setClientes((cl as Cliente[]) || []);
    setPedidos((pd as Pedido[]) || []);
    setComprovantes((cp as Comprovante[]) || []);
    setHistorico((hist as EventoTimeline[]) || []);
  }
  useEffect(() => { load(); }, []);

  function nomeParc(id: string) { return parceiros.find((p) => p.id === id)?.nome || "—"; }
  function nomeCli(id: string | null) { return clientes.find((c) => c.id === id)?.nome || "—"; }
  function pedidoCod(id: string | null) { return pedidos.find((p) => p.id === id)?.codigo || null; }

  const lista = comissoes
    .filter((c) => {
      if (tab === "auditar") return c.status === "a_auditar";
      if (tab === "anexar") return c.status === "aprovada";
      if (tab === "comprovantes") return c.status === "paga";
      return true;
    })
    .filter((c) => {
      if (!busca) return true;
      const term = busca.toLowerCase();
      return nomeParc(c.parceiro_id).toLowerCase().includes(term) ||
             (nomeCli(c.cliente_id) || "").toLowerCase().includes(term) ||
             (pedidoCod(c.pedido_id) || "").toLowerCase().includes(term);
    });

  async function aprovar(c: Comissao) {
    const { error } = await supabase.from("parceiro_comissoes").update({
      valor_corrigido: edit?.valor_corrigido ?? null,
      status: "aprovada",
    }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Comissão aprovada — pronta para anexar recibo");
    setEditDialog(false); setEdit(null); load();
  }

  async function uploadComprovante(c: Comissao, file: File) {
    const path = `${c.parceiro_id}/${c.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("parceiro-comprovantes").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    await supabase.from("parceiro_comprovantes").insert({
      comissao_id: c.id, parceiro_id: c.parceiro_id,
      storage_path: path, nome: file.name, mime_type: file.type, tamanho: file.size,
    });
    await supabase.from("parceiro_comissoes").update({
      status: "paga", data_pagamento: new Date().toISOString().slice(0, 10),
    }).eq("id", c.id);
    toast.success("Comprovante anexado e comissão marcada como paga");
    setUploadFor(null); load();
  }

  async function removerComprovante(comp: Comprovante) {
    if (!confirm(`Remover o comprovante "${comp.nome}"?`)) return;
    await supabase.storage.from("parceiro-comprovantes").remove([comp.storage_path]);
    const { error } = await supabase.from("parceiro_comprovantes").delete().eq("id", comp.id);
    if (error) return toast.error(error.message);
    toast.success("Comprovante removido");
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Auditoria de Parceiros</h2>
            <p className="text-sm text-muted-foreground">Gestão de Comissões e Comprovantes</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTab("auditar")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "auditar" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>1. Auditar</button>
            <button onClick={() => setTab("anexar")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "anexar" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>2. Anexar Recibo</button>
            <button onClick={() => setTab("comprovantes")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "comprovantes" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>3. Comprovantes</button>
            <button onClick={() => setTab("historico")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "historico" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
              <History className="w-4 h-4 inline mr-1" /> Histórico
            </button>
          </div>
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar parceiro, cliente ou pedido..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {tab !== "historico" && (
        <div className="space-y-3">
          {lista.map((c) => {
            const valor = Number(c.valor_corrigido ?? c.valor_calculado);
            const cod = pedidoCod(c.pedido_id);
            const compsDaComissao = comprovantes.filter((cp) => cp.comissao_id === c.id);
            return (
              <div key={c.id} className="rounded-2xl border bg-card p-5 flex items-center gap-5">
                <div className="w-12 h-12 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{nomeParc(c.parceiro_id)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Cliente: {nomeCli(c.cliente_id)}</span>
                    {c.pedido_id && cod && (
                      <Link to={`/pedidos/${c.pedido_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" /> {cod}
                      </Link>
                    )}
                    {c.contrato_numero && <span>• Contrato: {c.contrato_numero}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</div>
                  <div className={`text-lg font-bold ${tab === "auditar" ? "bg-purple-100 px-2 rounded" : ""}`}>{BRL(valor)}</div>
                </div>
                {tab === "auditar" && (
                  <Button variant="outline" onClick={() => { setEdit(c); setEditDialog(true); }}>
                    <Pencil className="w-4 h-4 mr-1" /> Auditar
                  </Button>
                )}
                {tab === "anexar" && (
                  <Button onClick={() => setUploadFor(c)}><Upload className="w-4 h-4 mr-1" /> Anexar Recibo</Button>
                )}
                {tab === "comprovantes" && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge className="bg-emerald-500/15 text-emerald-700">PAGO em {c.data_pagamento ? new Date(c.data_pagamento).toLocaleDateString("pt-BR") : "—"}</Badge>
                    {compsDaComissao.map((cp) => (
                      <div key={cp.id} className="flex items-center gap-1 rounded-md border bg-muted/40 pl-2 pr-1 py-1">
                        <button
                          onClick={() => abrirComprovante(cp.storage_path)}
                          className="text-xs font-medium inline-flex items-center gap-1 hover:underline max-w-[180px] truncate"
                          title={`Visualizar ${cp.nome}`}
                        >
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{cp.nome}</span>
                        </button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => abrirComprovante(cp.storage_path)} title="Visualizar">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => baixarComprovante(cp.storage_path, cp.nome)} title="Baixar">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerComprovante(cp)} title={`Remover ${cp.nome}`}>
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!lista.length && (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              {tab === "auditar" && "Nenhuma comissão pendente de auditoria"}
              {tab === "anexar" && "Nenhuma comissão aprovada aguardando recibo"}
              {tab === "comprovantes" && "Nenhuma comissão paga"}
            </div>
          )}
        </div>
      )}

      {tab === "historico" && (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm font-medium mb-4">Histórico auditável de comprovantes (anexar / editar / remover)</div>
          <div className="divide-y">
            {historico.length === 0 && (
              <div className="text-center text-muted-foreground py-10">Nenhum evento registrado.</div>
            )}
            {historico.map((e) => (
              <div key={e.id} className="py-3 flex items-start gap-3 text-sm">
                <Badge variant={e.tipo === "comprovante_removido" ? "destructive" : "secondary"}>
                  {e.tipo.replace("comprovante_", "")}
                </Badge>
                <div className="flex-1">
                  <div>{e.descricao}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                    {e.usuario_id && <> • por {e.usuario_id.slice(0, 8)}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDITAR */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Auditar comissão — {edit && nomeParc(edit.parceiro_id)}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-muted-foreground">Valor base</div><div className="font-semibold">{BRL(edit.valor_base)}</div></div>
                <div><div className="text-muted-foreground">Percentual</div><div className="font-semibold">{Number(edit.percentual || 0).toFixed(2)}%</div></div>
                <div><div className="text-muted-foreground">Calculado</div><div className="font-semibold">{BRL(edit.valor_calculado)}</div></div>
                <div><div className="text-muted-foreground">Cliente</div><div className="font-semibold">{nomeCli(edit.cliente_id)}</div></div>
                {edit.pedido_id && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Pedido</div>
                    <Link to={`/pedidos/${edit.pedido_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {pedidoCod(edit.pedido_id) || "Abrir pedido"}
                    </Link>
                  </div>
                )}
              </div>
              <div>
                <Label>Valor corrigido (opcional)</Label>
                <Input type="number" step="0.01" placeholder={String(edit.valor_calculado)}
                  value={edit.valor_corrigido ?? ""}
                  onChange={(e) => setEdit({ ...edit, valor_corrigido: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={() => edit && aprovar(edit)}><Check className="w-4 h-4 mr-1" /> Aprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPLOAD */}
      <Dialog open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anexar comprovante</DialogTitle></DialogHeader>
          {uploadFor && (
            <div className="space-y-4">
              <div className="text-sm">
                Parceiro: <strong>{nomeParc(uploadFor.parceiro_id)}</strong><br />
                Valor: <strong>{BRL(Number(uploadFor.valor_corrigido ?? uploadFor.valor_calculado))}</strong>
              </div>
              <Input type="file" onChange={(e) => {
                const f = e.target.files?.[0]; if (f && uploadFor) uploadComprovante(uploadFor, f);
              }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

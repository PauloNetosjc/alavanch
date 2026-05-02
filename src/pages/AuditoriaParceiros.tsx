import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Pencil, Upload, FileText, Check, Trash2 } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";

type Comissao = {
  id: string; parceiro_id: string; pedido_id: string | null; cliente_id: string | null;
  contrato_numero: string | null; valor_base: number | null; percentual: number | null;
  valor_calculado: number; valor_corrigido: number | null; status: string;
  data_pagamento: string | null;
};
type Parceiro = { id: string; nome: string; tipo: string };
type Cliente = { id: string; nome: string };

export default function AuditoriaParceiros() {
  const [tab, setTab] = useState<"auditar" | "anexar" | "comprovantes">("auditar");
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");

  const [editDialog, setEditDialog] = useState(false);
  const [edit, setEdit] = useState<Comissao | null>(null);

  const [uploadFor, setUploadFor] = useState<Comissao | null>(null);

  async function load() {
    const [{ data: c }, { data: p }, { data: cl }] = await Promise.all([
      supabase.from("parceiro_comissoes").select("*").order("created_at", { ascending: false }),
      supabase.from("parceiros").select("id,nome,tipo"),
      supabase.from("clientes").select("id,nome"),
    ]);
    setComissoes((c as Comissao[]) || []);
    setParceiros((p as Parceiro[]) || []);
    setClientes((cl as Cliente[]) || []);
  }
  useEffect(() => { load(); }, []);

  function nomeParc(id: string) { return parceiros.find((p) => p.id === id)?.nome || "—"; }
  function nomeCli(id: string | null) { return clientes.find((c) => c.id === id)?.nome || "—"; }

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
             (nomeCli(c.cliente_id) || "").toLowerCase().includes(term);
    });

  async function aprovar(c: Comissao) {
    const valorFinal = Number(edit?.valor_corrigido ?? edit?.valor_calculado ?? c.valor_calculado);
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
          <div className="flex gap-2">
            <button onClick={() => setTab("auditar")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "auditar" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>1. Auditar</button>
            <button onClick={() => setTab("anexar")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "anexar" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>2. Anexar Recibo</button>
            <button onClick={() => setTab("comprovantes")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "comprovantes" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>3. Comprovantes</button>
          </div>
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar parceiro ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {lista.map((c) => {
          const valor = Number(c.valor_corrigido ?? c.valor_calculado);
          return (
            <div key={c.id} className="rounded-2xl border bg-card p-5 flex items-center gap-5">
              <div className="w-12 h-12 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{nomeParc(c.parceiro_id)}</div>
                <div className="text-xs text-muted-foreground">
                  Contrato: {c.contrato_numero || "—"} | Cliente: {nomeCli(c.cliente_id)}
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
                <Badge className="bg-emerald-500/15 text-emerald-700">PAGO em {c.data_pagamento ? new Date(c.data_pagamento).toLocaleDateString("pt-BR") : "—"}</Badge>
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

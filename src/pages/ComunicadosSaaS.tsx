import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Megaphone, Plus, Search, ArrowLeft, Send, Copy, Eye, Trash2, X, Check, Upload, FileText, Image as ImageIcon, Video, Link as LinkIcon, Paperclip } from "lucide-react";
import { AnexoView, anexoIcon, anexoLabel } from "@/components/comunicados/AnexoView";

type Comunicado = {
  id: string;
  titulo: string; mensagem: string;
  tipo: string; prioridade: string; status: string;
  exibir_popup: boolean; permitir_fechar: boolean;
  data_inicio: string | null; data_fim: string | null;
  link_url: string | null;
  criado_por: string | null;
  created_at: string;
  anexo_tipo?: string | null;
  anexo_url?: string | null;
  anexo_nome?: string | null;
  anexo_mime?: string | null;
  anexo_tamanho_bytes?: number | null;
  anexo_texto_botao?: string | null;
};
type Destinatario = {
  id: string; comunicado_id: string;
  base_cliente_id: string | null; loja_id: string | null;
  enviar_para_todas_bases: boolean;
};
type Base = { id: string; nome: string };
type Loja = { id: string; nome: string; base_cliente_id: string | null };

const TIPOS = ["novidade","aviso","manutencao","financeiro","treinamento","sistema","urgente","outro"];
const PRIORIDADES = ["baixa","normal","alta","critica"];
const STATUSES = ["rascunho","agendado","publicado","encerrado","cancelado"];

const tipoLabel: Record<string,string> = {
  novidade:"Novidade", aviso:"Aviso", manutencao:"Manutenção", financeiro:"Financeiro",
  treinamento:"Treinamento", sistema:"Sistema", urgente:"Urgente", outro:"Outro",
};
const statusColor: Record<string,string> = {
  rascunho: "bg-zinc-100 text-zinc-700",
  agendado: "bg-blue-100 text-blue-800",
  publicado: "bg-emerald-100 text-emerald-800",
  encerrado: "bg-amber-100 text-amber-800",
  cancelado: "bg-red-100 text-red-800",
};
const prioColor: Record<string,string> = {
  critica:"bg-red-100 text-red-800", alta:"bg-amber-100 text-amber-800",
  normal:"bg-blue-100 text-blue-800", baixa:"bg-zinc-100 text-zinc-700",
};

type FormState = {
  id?: string;
  titulo: string; mensagem: string;
  tipo: string; prioridade: string; status: string;
  exibir_popup: boolean; permitir_fechar: boolean;
  data_inicio: string; data_fim: string;
  link_url: string;
  destino: "todas" | "bases" | "lojas";
  bases: string[];
  lojas: string[];
  anexo_tipo: "nenhum" | "imagem" | "pdf" | "video" | "link";
  anexo_url: string;
  anexo_nome: string;
  anexo_mime: string;
  anexo_tamanho_bytes: number | null;
  anexo_texto_botao: string;
  anexo_video_modo: "upload" | "link";
};

const emptyForm = (): FormState => ({
  titulo: "", mensagem: "",
  tipo: "novidade", prioridade: "normal", status: "rascunho",
  exibir_popup: true, permitir_fechar: true,
  data_inicio: new Date().toISOString().slice(0,10), data_fim: "",
  link_url: "",
  destino: "todas", bases: [], lojas: [],
  anexo_tipo: "nenhum", anexo_url: "", anexo_nome: "", anexo_mime: "",
  anexo_tamanho_bytes: null, anexo_texto_botao: "",
  anexo_video_modo: "link",
});

const LIMITES_MB: Record<string, number> = { imagem: 10, pdf: 20, video: 100 };
const MIMES_OK: Record<string, string[]> = {
  imagem: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  pdf: ["application/pdf"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};
const ACCEPT: Record<string, string> = {
  imagem: "image/png,image/jpeg,image/webp",
  pdf: "application/pdf",
  video: "video/mp4,video/webm,video/quicktime",
};

export default function ComunicadosSaaS() {
  const { user } = useAuth();
  const [list, setList] = useState<Comunicado[]>([]);
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fPrio, setFPrio] = useState("todas");

  // modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  // leituras
  const [leiturasOpen, setLeiturasOpen] = useState<Comunicado | null>(null);
  const [leituras, setLeituras] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [c, d, b, l] = await Promise.all([
      (supabase.from("comunicados_saas" as any) as any).select("*").order("created_at",{ascending:false}),
      (supabase.from("comunicados_saas_destinatarios" as any) as any).select("*"),
      (supabase.from("bases_clientes" as any) as any).select("id,nome").order("nome"),
      (supabase.from("lojas") as any).select("id,nome,base_cliente_id").order("nome"),
    ]);
    setList((c.data as any) || []);
    setDestinatarios((d.data as any) || []);
    setBases((b.data as any) || []);
    setLojas((l.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const kpi = useMemo(() => {
    const publicados = list.filter(x => x.status === "publicado").length;
    const agendados = list.filter(x => x.status === "agendado").length;
    const rascunhos = list.filter(x => x.status === "rascunho").length;
    const encerrados = list.filter(x => x.status === "encerrado" || x.status === "cancelado").length;
    const basesImpactadas = new Set<string>();
    destinatarios.forEach(d => {
      if (d.enviar_para_todas_bases) bases.forEach(b => basesImpactadas.add(b.id));
      if (d.base_cliente_id) basesImpactadas.add(d.base_cliente_id);
      if (d.loja_id) {
        const lj = lojas.find(x => x.id === d.loja_id);
        if (lj?.base_cliente_id) basesImpactadas.add(lj.base_cliente_id);
      }
    });
    return { publicados, agendados, rascunhos, encerrados, basesImpactadas: basesImpactadas.size };
  }, [list, destinatarios, bases, lojas]);

  const filtered = useMemo(() => list.filter(c => {
    if (fStatus !== "todos" && c.status !== fStatus) return false;
    if (fTipo !== "todos" && c.tipo !== fTipo) return false;
    if (fPrio !== "todas" && c.prioridade !== fPrio) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!c.titulo.toLowerCase().includes(q) && !c.mensagem.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [list, fStatus, fTipo, fPrio, busca]);

  const abrirNovo = () => { setForm(emptyForm()); setOpen(true); };

  const abrirEdicao = (c: Comunicado) => {
    const dests = destinatarios.filter(d => d.comunicado_id === c.id);
    const todas = dests.some(d => d.enviar_para_todas_bases);
    const lojasIds = dests.filter(d => d.loja_id).map(d => d.loja_id as string);
    const basesIds = dests.filter(d => d.base_cliente_id && !d.loja_id).map(d => d.base_cliente_id as string);
    setForm({
      id: c.id,
      titulo: c.titulo, mensagem: c.mensagem,
      tipo: c.tipo, prioridade: c.prioridade, status: c.status,
      exibir_popup: c.exibir_popup, permitir_fechar: c.permitir_fechar,
      data_inicio: c.data_inicio ? c.data_inicio.slice(0,10) : "",
      data_fim: c.data_fim ? c.data_fim.slice(0,10) : "",
      link_url: c.link_url || "",
      destino: todas ? "todas" : lojasIds.length > 0 ? "lojas" : "bases",
      bases: basesIds, lojas: lojasIds,
    });
    setOpen(true);
  };

  const duplicar = (c: Comunicado) => {
    abrirEdicao(c);
    setForm(f => ({ ...f, id: undefined, status: "rascunho", titulo: f.titulo + " (cópia)" }));
  };

  const salvar = async (publicar: boolean) => {
    if (!form.titulo.trim()) { toast.error("Título obrigatório"); return; }
    if (!form.mensagem.trim()) { toast.error("Mensagem obrigatória"); return; }
    if (form.destino === "bases" && form.bases.length === 0) { toast.error("Selecione ao menos uma base"); return; }
    if (form.destino === "lojas" && form.lojas.length === 0) { toast.error("Selecione ao menos uma loja"); return; }
    if (form.data_inicio && form.data_fim && form.data_fim < form.data_inicio) {
      toast.error("Data final não pode ser anterior à inicial"); return;
    }

    const payload: any = {
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      tipo: form.tipo, prioridade: form.prioridade,
      status: publicar ? "publicado" : form.status,
      exibir_popup: form.exibir_popup, permitir_fechar: form.permitir_fechar,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      link_url: form.link_url || null,
      atualizado_por: user?.id,
    };

    let comunicadoId = form.id;
    if (form.id) {
      const { error } = await (supabase.from("comunicados_saas" as any) as any).update(payload).eq("id", form.id);
      if (error) { toast.error(error.message); return; }
    } else {
      payload.criado_por = user?.id;
      const { data, error } = await (supabase.from("comunicados_saas" as any) as any).insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      comunicadoId = (data as any).id;
    }

    // Reset destinatários
    if (comunicadoId) {
      await (supabase.from("comunicados_saas_destinatarios" as any) as any).delete().eq("comunicado_id", comunicadoId);
      const rows: any[] = [];
      if (form.destino === "todas") rows.push({ comunicado_id: comunicadoId, enviar_para_todas_bases: true });
      if (form.destino === "bases") form.bases.forEach(bid => rows.push({ comunicado_id: comunicadoId, base_cliente_id: bid }));
      if (form.destino === "lojas") form.lojas.forEach(lid => {
        const lj = lojas.find(x => x.id === lid);
        rows.push({ comunicado_id: comunicadoId, loja_id: lid, base_cliente_id: lj?.base_cliente_id || null });
      });
      if (rows.length) await (supabase.from("comunicados_saas_destinatarios" as any) as any).insert(rows);
    }

    toast.success(publicar ? "Comunicado publicado" : "Salvo com sucesso");
    setOpen(false);
    load();
  };

  const mudarStatus = async (c: Comunicado, status: string) => {
    const { error } = await (supabase.from("comunicados_saas" as any) as any)
      .update({ status, atualizado_por: user?.id }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado"); load();
  };

  const excluir = async (c: Comunicado) => {
    if (c.status !== "rascunho") { toast.error("Apenas rascunhos podem ser excluídos"); return; }
    if (!confirm(`Excluir "${c.titulo}"?`)) return;
    const { error } = await (supabase.from("comunicados_saas" as any) as any).delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído"); load();
  };

  const verLeituras = async (c: Comunicado) => {
    setLeiturasOpen(c);
    const { data } = await (supabase.from("comunicados_saas_leituras" as any) as any)
      .select("*").eq("comunicado_id", c.id);
    setLeituras((data as any) || []);
  };

  const destinoTexto = (c: Comunicado) => {
    const dests = destinatarios.filter(d => d.comunicado_id === c.id);
    if (dests.some(d => d.enviar_para_todas_bases)) return "Todas as bases";
    const nBases = dests.filter(d => d.base_cliente_id && !d.loja_id).length;
    const nLojas = dests.filter(d => d.loja_id).length;
    const parts: string[] = [];
    if (nBases) parts.push(`${nBases} base${nBases>1?"s":""}`);
    if (nLojas) parts.push(`${nLojas} loja${nLojas>1?"s":""}`);
    return parts.join(" + ") || "—";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Comunicados SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie comunicados, avisos e novidades para bases selecionadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <a href="/sistema/gestao-bases"><ArrowLeft className="w-4 h-4" /> Bases</a>
          </Button>
          <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Novo comunicado</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Publicados</div><div className="text-2xl font-display mt-1 text-emerald-700">{kpi.publicados}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Agendados</div><div className="text-2xl font-display mt-1 text-blue-700">{kpi.agendados}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Rascunhos</div><div className="text-2xl font-display mt-1">{kpi.rascunhos}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Encerrados</div><div className="text-2xl font-display mt-1 text-amber-700">{kpi.encerrados}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Bases impactadas</div><div className="text-2xl font-display mt-1">{kpi.basesImpactadas}</div></Card>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-7" placeholder="Título ou mensagem" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{TIPOS.map(s => <SelectItem key={s} value={s}>{tipoLabel[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Prioridade</Label>
          <Select value={fPrio} onValueChange={setFPrio}>
            <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{PRIORIDADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Título</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Prio.</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Destino</th>
                <th className="text-left px-3 py-2">Início</th>
                <th className="text-left px-3 py-2">Fim</th>
                <th className="text-center px-3 py-2">Pop-up</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nenhum comunicado.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium">{c.titulo}</td>
                  <td className="px-3 py-2 capitalize">{tipoLabel[c.tipo] || c.tipo}</td>
                  <td className="px-3 py-2"><Badge className={`${prioColor[c.prioridade]||""} border-0 capitalize text-[10px]`}>{c.prioridade}</Badge></td>
                  <td className="px-3 py-2"><Badge className={`${statusColor[c.status]||""} border-0 capitalize text-[10px]`}>{c.status}</Badge></td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">{destinoTexto(c)}</td>
                  <td className="px-3 py-2 text-[12px]">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-[12px]">{c.data_fim ? new Date(c.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-center">{c.exibir_popup ? <Check className="w-3.5 h-3.5 inline text-emerald-600" /> : <X className="w-3.5 h-3.5 inline text-muted-foreground" />}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => abrirEdicao(c)}>Editar</Button>
                      {c.status !== "publicado" && c.status !== "cancelado" && (
                        <Button size="sm" variant="ghost" title="Publicar" onClick={() => mudarStatus(c, "publicado")}><Send className="w-3.5 h-3.5"/></Button>
                      )}
                      {c.status === "publicado" && (
                        <Button size="sm" variant="ghost" title="Encerrar" onClick={() => mudarStatus(c, "encerrado")}>Encerrar</Button>
                      )}
                      {c.status !== "cancelado" && (
                        <Button size="sm" variant="ghost" title="Cancelar" onClick={() => mudarStatus(c, "cancelado")}>Cancelar</Button>
                      )}
                      <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicar(c)}><Copy className="w-3.5 h-3.5"/></Button>
                      <Button size="sm" variant="ghost" title="Leituras" onClick={() => verLeituras(c)}><Eye className="w-3.5 h-3.5"/></Button>
                      {c.status === "rascunho" && (
                        <Button size="sm" variant="ghost" title="Excluir" onClick={() => excluir(c)}><Trash2 className="w-3.5 h-3.5 text-red-600"/></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar comunicado" : "Novo comunicado"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}/>
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Textarea rows={6} value={form.mensagem} onChange={e => setForm({...form, mensagem: e.target.value})}/>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{TIPOS.map(s => <SelectItem key={s} value={s}>{tipoLabel[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm({...form, prioridade: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})}/>
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm({...form, data_fim: e.target.value})}/>
              </div>
              <div>
                <Label>Link (opcional)</Label>
                <Input value={form.link_url} onChange={e => setForm({...form, link_url: e.target.value})} placeholder="https://"/>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={form.exibir_popup} onCheckedChange={(v) => setForm({...form, exibir_popup: v})}/>
                Exibir como pop-up
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={form.permitir_fechar} onCheckedChange={(v) => setForm({...form, permitir_fechar: v})}/>
                Permitir fechar pop-up
              </label>
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label>Destinatários</Label>
              <Tabs value={form.destino} onValueChange={(v) => setForm({...form, destino: v as any})}>
                <TabsList>
                  <TabsTrigger value="todas">Todas as bases</TabsTrigger>
                  <TabsTrigger value="bases">Bases selecionadas</TabsTrigger>
                  <TabsTrigger value="lojas">Lojas selecionadas</TabsTrigger>
                </TabsList>
              </Tabs>

              {form.destino === "bases" && (
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-1.5">
                  {bases.map(b => (
                    <label key={b.id} className="flex items-center gap-2 text-[13px]">
                      <Checkbox
                        checked={form.bases.includes(b.id)}
                        onCheckedChange={(v) => setForm({
                          ...form,
                          bases: v ? [...form.bases, b.id] : form.bases.filter(x => x !== b.id),
                        })}
                      />
                      {b.nome}
                    </label>
                  ))}
                </div>
              )}

              {form.destino === "lojas" && (
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-1.5">
                  {lojas.map(l => (
                    <label key={l.id} className="flex items-center gap-2 text-[13px]">
                      <Checkbox
                        checked={form.lojas.includes(l.id)}
                        onCheckedChange={(v) => setForm({
                          ...form,
                          lojas: v ? [...form.lojas, l.id] : form.lojas.filter(x => x !== l.id),
                        })}
                      />
                      {l.nome}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => salvar(false)}>Salvar rascunho</Button>
            <Button onClick={() => salvar(true)}>Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal leituras */}
      <Dialog open={!!leiturasOpen} onOpenChange={(o) => { if (!o) setLeiturasOpen(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leituras — {leiturasOpen?.titulo}</DialogTitle>
          </DialogHeader>
          {leiturasOpen && (() => {
            const lidos = leituras.filter(l => l.lido).length;
            const fechados = leituras.filter(l => l.fechado_em && !l.lido).length;
            return (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Total registros</div><div className="text-xl font-display">{leituras.length}</div></Card>
                  <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Lidos</div><div className="text-xl font-display text-emerald-700">{lidos}</div></Card>
                  <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Apenas fechados</div><div className="text-xl font-display text-amber-700">{fechados}</div></Card>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-secondary/50 text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5">Usuário</th>
                        <th className="text-left px-2 py-1.5">Loja</th>
                        <th className="text-left px-2 py-1.5">Lido</th>
                        <th className="text-left px-2 py-1.5">Lido em</th>
                        <th className="text-left px-2 py-1.5">Fechado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leituras.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Sem leituras registradas.</td></tr>}
                      {leituras.map(l => (
                        <tr key={l.id} className="border-t">
                          <td className="px-2 py-1.5">{l.user_id?.slice(0,8)}…</td>
                          <td className="px-2 py-1.5">{lojas.find(x => x.id === l.loja_id)?.nome || "—"}</td>
                          <td className="px-2 py-1.5">{l.lido ? "Sim" : "Não"}</td>
                          <td className="px-2 py-1.5">{l.lido_em ? new Date(l.lido_em).toLocaleString("pt-BR") : "—"}</td>
                          <td className="px-2 py-1.5">{l.fechado_em ? new Date(l.fechado_em).toLocaleString("pt-BR") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

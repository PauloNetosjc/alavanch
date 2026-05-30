import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText, Plus, Search, Copy, Trash2, Eye, ArrowLeft, Star, StarOff, ScrollText,
} from "lucide-react";
import {
  renderContratoSaasTemplate, VARIAVEIS_CONTRATO_SAAS,
} from "@/lib/contratoSaasTemplate";

type Modelo = {
  id: string;
  nome: string;
  descricao: string | null;
  conteudo_html: string;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  nome: string;
  descricao: string;
  conteudo_html: string;
  ativo: boolean;
  padrao: boolean;
};

const empty = (): FormState => ({
  nome: "", descricao: "", conteudo_html: "", ativo: true, padrao: false,
});

const PREVIEW_DADOS = {
  base_nome: "Base Exemplo",
  razao_social: "Empresa Exemplo LTDA",
  cnpj: "12.345.678/0001-90",
  responsavel_nome: "João Silva",
  email_responsavel: "joao@exemplo.com",
  telefone_responsavel: "(12) 99999-9999",
  plano: "Profissional",
  valor_implantacao: 2500,
  valor_mensal: 499,
  dia_vencimento: 10,
  lojas_incluidas: 3,
  usuarios_incluidos: 10,
  armazenamento_incluido_mb: 10240,
  armazenamento_adicional_mb: 0,
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: null,
  modulos_contratados: ["Fábrica", "RH", "Notas Fiscais"],
};

export default function ModelosContratoSaaS() {
  const { user } = useAuth();
  const [list, setList] = useState<Modelo[]>([]);
  const [emUso, setEmUso] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty());
  const [preview, setPreview] = useState<Modelo | null>(null);

  const load = async () => {
    setLoading(true);
    const [m, c] = await Promise.all([
      (supabase.from("base_modelos_contrato" as any) as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("base_contratos" as any) as any).select("modelo_id"),
    ]);
    setList((m.data as any) || []);
    const used = new Set<string>();
    ((c.data as any[]) || []).forEach((x) => { if (x.modelo_id) used.add(x.modelo_id); });
    setEmUso(used);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((m) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return m.nome.toLowerCase().includes(q) || (m.descricao || "").toLowerCase().includes(q);
  }), [list, busca]);

  const abrirNovo = () => { setForm(empty()); setOpen(true); };
  const abrirEdicao = (m: Modelo) => {
    setForm({ id: m.id, nome: m.nome, descricao: m.descricao || "", conteudo_html: m.conteudo_html, ativo: m.ativo, padrao: m.padrao });
    setOpen(true);
  };
  const duplicar = (m: Modelo) => {
    setForm({ nome: m.nome + " (cópia)", descricao: m.descricao || "", conteudo_html: m.conteudo_html, ativo: true, padrao: false });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    if (!form.conteudo_html.trim()) { toast.error("Conteúdo obrigatório"); return; }

    // Se marcado como padrão, desmarcar outros
    if (form.padrao) {
      await (supabase.from("base_modelos_contrato" as any) as any)
        .update({ padrao: false }).neq("id", form.id || "00000000-0000-0000-0000-000000000000");
    }

    const payload: any = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      conteudo_html: form.conteudo_html,
      ativo: form.ativo, padrao: form.padrao,
      atualizado_por: user?.id,
    };

    if (form.id) {
      const { error } = await (supabase.from("base_modelos_contrato" as any) as any).update(payload).eq("id", form.id);
      if (error) { toast.error(error.message); return; }
    } else {
      payload.criado_por = user?.id;
      const { error } = await (supabase.from("base_modelos_contrato" as any) as any).insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Modelo salvo");
    setOpen(false); load();
  };

  const toggleAtivo = async (m: Modelo) => {
    const { error } = await (supabase.from("base_modelos_contrato" as any) as any)
      .update({ ativo: !m.ativo, atualizado_por: user?.id }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const tornarPadrao = async (m: Modelo) => {
    await (supabase.from("base_modelos_contrato" as any) as any).update({ padrao: false }).neq("id", m.id);
    const { error } = await (supabase.from("base_modelos_contrato" as any) as any)
      .update({ padrao: true, atualizado_por: user?.id }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo definido como padrão"); load();
  };

  const excluir = async (m: Modelo) => {
    if (emUso.has(m.id)) { toast.error("Modelo em uso. Inative em vez de excluir."); return; }
    if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
    const { error } = await (supabase.from("base_modelos_contrato" as any) as any).delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído"); load();
  };

  const conteudoPreview = useMemo(() => {
    return renderContratoSaasTemplate(form.conteudo_html || "", PREVIEW_DADOS as any);
  }, [form.conteudo_html]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <ScrollText className="w-5 h-5" /> Modelos de Contrato SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cláusulas e layouts utilizados para gerar contratos das bases.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <a href="/sistema/gestao-bases"><ArrowLeft className="w-4 h-4" /> Bases</a>
          </Button>
          <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Novo modelo</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-7" placeholder="Buscar modelo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/50 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Descrição</th>
              <th className="text-center px-3 py-2">Padrão</th>
              <th className="text-center px-3 py-2">Ativo</th>
              <th className="text-center px-3 py-2">Em uso</th>
              <th className="text-left px-3 py-2">Atualizado</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum modelo cadastrado.</td></tr>}
            {filtered.map((m) => (
              <tr key={m.id} className="border-t hover:bg-secondary/30">
                <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />{m.nome}
                </td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground max-w-md truncate">{m.descricao || "—"}</td>
                <td className="px-3 py-2 text-center">{m.padrao ? <Star className="w-3.5 h-3.5 inline text-amber-500 fill-amber-500" /> : <StarOff className="w-3.5 h-3.5 inline text-muted-foreground" />}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className={m.ativo ? "bg-emerald-100 text-emerald-800 border-0" : "bg-zinc-100 text-zinc-700 border-0"}>
                    {m.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center text-[12px]">{emUso.has(m.id) ? "Sim" : "—"}</td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground">{new Date(m.updated_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Prévia" onClick={() => setPreview(m)}><Eye className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" title="Editar" onClick={() => abrirEdicao(m)}>Editar</Button>
                    {!m.padrao && <Button size="sm" variant="ghost" title="Tornar padrão" onClick={() => tornarPadrao(m)}><Star className="w-3.5 h-3.5" /></Button>}
                    <Button size="sm" variant="ghost" title={m.ativo ? "Inativar" : "Ativar"} onClick={() => toggleAtivo(m)}>{m.ativo ? "Inativar" : "Ativar"}</Button>
                    <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicar(m)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" title="Excluir" onClick={() => excluir(m)} disabled={emUso.has(m.id)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-[13px]">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />Ativo
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <Switch checked={form.padrao} onCheckedChange={(v) => setForm({ ...form, padrao: v })} />Padrão
                </label>
              </div>
              <div>
                <Label>Conteúdo HTML *</Label>
                <Textarea
                  rows={20}
                  value={form.conteudo_html}
                  onChange={(e) => setForm({ ...form, conteudo_html: e.target.value })}
                  className="font-mono text-[12px]"
                  placeholder="<h1>Contrato</h1><p>Contratante: {{razao_social}}…</p>"
                />
              </div>
              <div>
                <Label className="text-xs">Variáveis disponíveis (clique para copiar)</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {VARIAVEIS_CONTRATO_SAAS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success(`Variável {{${v}}} copiada`); }}
                      className="text-[10.5px] px-1.5 py-0.5 rounded border bg-secondary/40 hover:bg-secondary"
                    >{`{{${v}}}`}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prévia (com dados de exemplo)</Label>
              <div className="border rounded-md p-4 bg-white max-h-[68vh] overflow-y-auto text-[12.5px] prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: conteudoPreview }} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.nome}</DialogTitle></DialogHeader>
          <div className="border rounded-md p-4 bg-white text-[13px] prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: renderContratoSaasTemplate(preview?.conteudo_html || "", PREVIEW_DADOS as any) }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

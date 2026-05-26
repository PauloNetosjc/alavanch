import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Save, Copy, Plus, Trash2, Pencil, ShieldCheck, Layers,
} from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin",       label: "Administrador",         desc: "Acesso total ao sistema. Não editável." },
  { value: "diretor",     label: "Diretor",               desc: "Visão estratégica e relatórios gerenciais." },
  { value: "gerente",     label: "Gerente de Loja",       desc: "Operação da loja, equipe e indicadores." },
  { value: "vendedor",    label: "Vendedor / Consultor",  desc: "Atendimento, orçamentos e pedidos." },
  { value: "projetista",  label: "Projetista",            desc: "Projetos e revisões técnicas." },
  { value: "financeiro",  label: "Financeiro",            desc: "Lançamentos, contas e conciliação." },
  { value: "tecnico",     label: "Técnico",               desc: "Assistência técnica e atendimentos pós-venda." },
  { value: "montador",    label: "Montador",              desc: "Agenda de montagem e checklists." },
  { value: "assistencia", label: "Assistência / Pós-venda", desc: "Atendimento e acompanhamento de chamados." },
];

const GRUPOS_ORDEM = ["Comercial","Operacional","Financeiro","Cadastros","Documentos","Relatórios","Sistema","Outros"];

type Cat = { id?: string; modulo: string; acao: string; descricao: string | null; grupo: string | null };

// =================== PAGE ===================
export default function CargosAdmin() {
  return (
    <div>
      <PageHeader
        title="Cargos & Autorizações"
        subtitle="Gerencie cargos, atribua funções e configure o acesso a cada tela e relatório do sistema."
        icon={Shield}
      />
      <Tabs defaultValue="cargos">
        <TabsList>
          <TabsTrigger value="cargos"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Cargos</TabsTrigger>
          <TabsTrigger value="autorizacoes"><Layers className="w-3.5 h-3.5 mr-1.5" />Autorizações</TabsTrigger>
        </TabsList>
        <TabsContent value="cargos" className="mt-4"><CargosTab /></TabsContent>
        <TabsContent value="autorizacoes" className="mt-4"><AutorizacoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =================== CARGOS TAB ===================
function CargosTab() {
  const [selected, setSelected] = useState<string>("vendedor");
  const [catalog, setCatalog] = useState<Cat[]>([]);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("permissoes_modulos_catalogo" as any)
        .select("modulo,acao,descricao,grupo")
        .order("grupo").order("modulo").order("acao");
      setCatalog(((data as unknown) as Cat[]) || []);
    })();
  }, []);

  useEffect(() => { loadGranted(selected); }, [selected]);

  async function loadGranted(role: string) {
    const { data } = await supabase.from("role_permissoes" as any).select("modulo,acao").eq("role", role);
    setGranted(new Set(((data as any) || []).map((x: any) => `${x.modulo}:${x.acao}`)));
  }

  const toggle = (modulo: string, acao: string, value: boolean) => {
    const key = `${modulo}:${acao}`;
    const next = new Set(granted);
    value ? next.add(key) : next.delete(key);
    setGranted(next);
  };

  const toggleModulo = (modulo: string, items: Cat[], allChecked: boolean) => {
    const next = new Set(granted);
    for (const it of items) {
      const k = `${it.modulo}:${it.acao}`;
      if (allChecked) next.delete(k);
      else next.add(k);
    }
    setGranted(next);
  };

  const salvar = async () => {
    if (selected === "admin") return;
    setSaving(true);
    try {
      await supabase.from("role_permissoes" as any).delete().eq("role", selected);
      const rows = Array.from(granted).map((k) => {
        const [modulo, acao] = k.split(":");
        return { role: selected, modulo, acao };
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("role_permissoes" as any).insert(rows);
        if (error) throw error;
      }
      toast.success(`Permissões do cargo ${ROLES.find(r => r.value === selected)?.label} salvas`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const copiarDe = async () => {
    if (!copyFrom) return;
    const { data } = await supabase.from("role_permissoes" as any).select("modulo,acao").eq("role", copyFrom);
    setGranted(new Set(((data as any) || []).map((x: any) => `${x.modulo}:${x.acao}`)));
    toast.success(`Permissões copiadas de ${ROLES.find(r => r.value === copyFrom)?.label}. Clique em salvar para aplicar.`);
  };

  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Cat[]>> = {};
    for (const c of catalog) {
      const g = c.grupo || "Outros";
      (out[g] ||= {});
      (out[g][c.modulo] ||= []).push(c);
    }
    return out;
  }, [catalog]);

  const selectedRole = ROLES.find(r => r.value === selected)!;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Sidebar de cargos */}
      <div className="surface-card p-3 h-fit">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pb-2">Cargos do sistema</div>
        <div className="flex flex-col gap-1">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`text-left px-3 py-2 rounded-md text-[13px] transition ${
                selected === r.value ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className={`w-3.5 h-3.5 ${selected === r.value ? "text-primary" : "text-muted-foreground"}`} />
                {r.label}
              </div>
              <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground p-2 mt-2 border-t border-border">
          Os cargos são fixos pelo sistema, mas você controla exatamente o que cada um pode acessar.
        </div>
      </div>

      {/* Editor de permissões */}
      <div className="space-y-4">
        <div className="surface-card p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="text-[16px] font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> {selectedRole.label}
            </div>
            <div className="text-[12px] text-muted-foreground">{selectedRole.desc}</div>
          </div>
          {selected !== "admin" && (
            <>
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Copiar permissões de</label>
                  <Select value={copyFrom} onValueChange={setCopyFrom}>
                    <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Selecionar cargo…" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter(r => r.value !== selected).map(r =>
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={copiarDe} disabled={!copyFrom}>
                  <Copy className="w-4 h-4 mr-1" /> Copiar
                </Button>
              </div>
              <Button onClick={salvar} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </>
          )}
          {selected === "admin" && (
            <Badge variant="outline" className="text-[12px]">Acesso total — não editável</Badge>
          )}
        </div>

        {GRUPOS_ORDEM.filter(g => grouped[g]).map((g) => (
          <div key={g} className="surface-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <div className="text-[13px] font-semibold">{g}</div>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(grouped[g]).map(([modulo, items]) => {
                const allChecked = items.every(it => granted.has(`${it.modulo}:${it.acao}`));
                const someChecked = !allChecked && items.some(it => granted.has(`${it.modulo}:${it.acao}`));
                return (
                  <div key={modulo} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={allChecked || (someChecked && "indeterminate" as any)}
                        disabled={selected === "admin"}
                        onCheckedChange={() => toggleModulo(modulo, items, allChecked)}
                      />
                      <div className="text-[13px] font-semibold uppercase tracking-wide">{modulo}</div>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {items.filter(it => granted.has(`${it.modulo}:${it.acao}`)).length}/{items.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pl-6">
                      {items.map((it) => {
                        const key = `${it.modulo}:${it.acao}`;
                        return (
                          <label key={key} className="flex items-start gap-2 text-[12.5px] cursor-pointer">
                            <Checkbox
                              checked={granted.has(key)}
                              disabled={selected === "admin"}
                              onCheckedChange={(v) => toggle(it.modulo, it.acao, !!v)}
                            />
                            <span>
                              <span className="font-medium">{it.acao}</span>
                              {it.descricao && <span className="text-muted-foreground"> — {it.descricao}</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================== AUTORIZAÇÕES TAB ===================
function AutorizacoesTab() {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroGrupo, setFiltroGrupo] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Cat | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("permissoes_modulos_catalogo" as any)
      .select("modulo,acao,descricao,grupo")
      .order("grupo").order("modulo").order("acao");
    setItems(((data as unknown) as Cat[]) || []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const visiveis = useMemo(() => {
    return items.filter((i) => {
      if (filtroGrupo !== "all" && (i.grupo || "Outros") !== filtroGrupo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!i.modulo.toLowerCase().includes(q) && !i.acao.toLowerCase().includes(q) && !(i.descricao || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filtroGrupo, busca]);

  const grupos = useMemo(() => Array.from(new Set(items.map(i => i.grupo || "Outros"))).sort(), [items]);

  const excluir = async (it: Cat) => {
    if (!confirm(`Excluir a autorização ${it.modulo}:${it.acao}?\nIsso também removerá esta permissão de todos os cargos e usuários.`)) return;
    const { error } = await supabase
      .from("permissoes_modulos_catalogo" as any)
      .delete()
      .eq("modulo", it.modulo).eq("acao", it.acao);
    if (error) return toast.error(error.message);
    toast.success("Autorização removida");
    reload();
  };

  return (
    <div className="space-y-3">
      <div className="surface-card p-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar módulo, ação ou descrição…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-[280px] h-9"
        />
        <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-[12px] text-muted-foreground">
          {visiveis.length} de {items.length} autorizações
        </div>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova autorização
        </Button>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : visiveis.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma autorização encontrada.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Grupo</th>
                <th className="px-3 py-2 font-semibold">Módulo</th>
                <th className="px-3 py-2 font-semibold">Ação</th>
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visiveis.map((it) => (
                <tr key={`${it.modulo}:${it.acao}`} className="hover:bg-muted/30">
                  <td className="px-3 py-2"><Badge variant="outline">{it.grupo || "Outros"}</Badge></td>
                  <td className="px-3 py-2 font-medium">{it.modulo}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{it.acao}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{it.descricao || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(it)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluir(it)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AutorizacaoDialog
        open={creating || !!editing}
        item={editing}
        grupos={grupos}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />
    </div>
  );
}

function AutorizacaoDialog({ open, item, grupos, onClose, onSaved }: {
  open: boolean; item: Cat | null; grupos: string[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!item;
  const [modulo, setModulo] = useState("");
  const [acao, setAcao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [grupo, setGrupo] = useState("");

  useEffect(() => {
    if (open) {
      setModulo(item?.modulo || "");
      setAcao(item?.acao || "");
      setDescricao(item?.descricao || "");
      setGrupo(item?.grupo || "Outros");
    }
  }, [open, item]);

  const salvar = async () => {
    if (!modulo.trim() || !acao.trim()) return toast.error("Módulo e ação são obrigatórios");
    const payload = { modulo: modulo.trim(), acao: acao.trim(), descricao: descricao.trim() || null, grupo: grupo.trim() || "Outros" };
    if (isEdit && item) {
      const { error } = await supabase
        .from("permissoes_modulos_catalogo" as any)
        .update(payload)
        .eq("modulo", item.modulo).eq("acao", item.acao);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("permissoes_modulos_catalogo" as any).insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Autorização salva");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Editar autorização" : "Nova autorização"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground">Módulo</label>
              <Input value={modulo} onChange={(e) => setModulo(e.target.value)} placeholder="ex.: orcamentos" disabled={isEdit} />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground">Ação</label>
              <Input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="ex.: view, create, edit, delete" disabled={isEdit} />
            </div>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Grupo</label>
            <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="ex.: Comercial" list="grupos-cat" />
            <datalist id="grupos-cat">{grupos.map(g => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Descrição</label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Para que serve esta autorização" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

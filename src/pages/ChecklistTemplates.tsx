import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Plus, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

type Template = { id: string; nome: string; tipo_servico: string; ativo: boolean; ordem: number };
type Item = { id?: string; descricao: string; obrigatorio: boolean; ordem: number };

const TIPOS = ["kanban", "operacional", "comercial", "outro"];
const TIPOS_ASSISTENCIA = ["garantia", "reparo", "ajuste", "substituicao"];

export default function ChecklistTemplates() {
  const { role } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Template | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("garantia");
  const [ativo, setAtivo] = useState(true);
  const [itens, setItens] = useState<Item[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [loading, setLoading] = useState(false);

  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const load = async () => {
    const { data } = await supabase
      .from("checklist_templates")
      .select("*")
      .not("tipo_servico", "in", `(${TIPOS_ASSISTENCIA.join(",")})`)
      .order("ordem");
    setTemplates((data || []) as any);
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEdit(null);
    setNome("");
    setTipo("garantia");
    setAtivo(true);
    setItens([]);
    setOpen(true);
  };

  const openEdit = async (t: Template) => {
    setEdit(t);
    setNome(t.nome);
    setTipo(t.tipo_servico);
    setAtivo(t.ativo);
    const { data } = await supabase
      .from("checklist_template_itens")
      .select("id, descricao, obrigatorio, ordem")
      .eq("template_id", t.id)
      .order("ordem");
    setItens((data || []) as any);
    setOpen(true);
  };

  const addItem = () => {
    if (!novoItem.trim()) return;
    setItens([...itens, { descricao: novoItem.trim(), obrigatorio: true, ordem: itens.length + 1 }]);
    setNovoItem("");
  };

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    setLoading(true);
    let templateId = edit?.id;
    if (edit) {
      await supabase
        .from("checklist_templates")
        .update({ nome, tipo_servico: tipo, ativo })
        .eq("id", edit.id);
      await supabase.from("checklist_template_itens").delete().eq("template_id", edit.id);
    } else {
      const { data: ins } = await supabase
        .from("checklist_templates")
        .insert({ nome, tipo_servico: tipo, ativo, ordem: templates.length + 1 })
        .select()
        .maybeSingle();
      templateId = ins?.id;
    }
    if (templateId && itens.length > 0) {
      await supabase.from("checklist_template_itens").insert(
        itens.map((i, idx) => ({
          template_id: templateId,
          descricao: i.descricao,
          obrigatorio: i.obrigatorio,
          ordem: idx + 1,
        }))
      );
    }
    setLoading(false);
    setOpen(false);
    toast.success("Modelo salvo!");
    load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Remover modelo "${t.nome}"?`)) return;
    await supabase.from("checklist_templates").delete().eq("id", t.id);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        iconVariant="purple"
        title="Modelos de Checklist"
        subtitle="MODELOS POR TIPO DE SERVIÇO"
      />

      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo modelo
        </Button>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="surface-card p-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold">{t.nome}</div>
              <div className="text-[12px] text-muted-foreground capitalize">
                Tipo: {t.tipo_servico} {!t.ativo && <span className="ml-2 text-red-500">(inativo)</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(t)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de serviço</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} id="ativo" />
              <Label htmlFor="ativo">Ativo</Label>
            </div>

            <div>
              <Label>Itens</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  placeholder="Descrição do item"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
                />
                <Button onClick={addItem} type="button">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border border-border rounded">
                    <Checkbox
                      checked={it.obrigatorio}
                      onCheckedChange={(v) => {
                        const novo = [...itens];
                        novo[i].obrigatorio = !!v;
                        setItens(novo);
                      }}
                    />
                    <span className="flex-1 text-[13px]">{it.descricao}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {it.obrigatorio ? "Obrigatório" : "Opcional"}
                    </span>
                    <button onClick={() => setItens(itens.filter((_, x) => x !== i))}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="text-[12px] text-muted-foreground">Nenhum item</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

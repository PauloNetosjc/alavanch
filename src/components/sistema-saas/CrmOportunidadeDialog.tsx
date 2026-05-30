import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { maskCnpj, maskPhone } from "@/lib/masks";
import { ORIGENS_CRM, ETAPAS_CRM, type Oportunidade, registrarHistoricoCrm } from "@/lib/sistema-saas/crmSaas";

type Sistema = { id: string; nome: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oportunidade?: Oportunidade | null;
  onSaved?: () => void;
}

export function CrmOportunidadeDialog({ open, onOpenChange, oportunidade, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [form, setForm] = useState<Partial<Oportunidade>>({});

  useEffect(() => {
    if (!open) return;
    supabase.from("sistemas_saas" as any).select("id,nome").eq("ativo", true).order("ordem")
      .then(({ data }) => setSistemas((data as any) ?? []));
    setForm(oportunidade ? { ...oportunidade } : { etapa: "lead_novo", status: "aberto" });
  }, [open, oportunidade]);

  const set = (k: keyof Oportunidade, v: any) => setForm(s => ({ ...s, [k]: v }));

  async function handleSave() {
    if (!form.nome_empresa?.trim()) { toast.error("Nome da empresa é obrigatório"); return; }
    if (!form.sistema_saas_id) { toast.error("Selecione o sistema de interesse"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        nome_empresa: form.nome_empresa,
        razao_social: form.razao_social || null,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        responsavel_nome: form.responsavel_nome || null,
        email: form.email || null,
        telefone: form.telefone || null,
        origem: form.origem || null,
        sistema_saas_id: form.sistema_saas_id,
        plano_interesse: form.plano_interesse || null,
        valor_implantacao_proposto: Number(form.valor_implantacao_proposto) || 0,
        valor_mensal_proposto: Number(form.valor_mensal_proposto) || 0,
        lojas_previstas: form.lojas_previstas ? Number(form.lojas_previstas) : null,
        usuarios_previstos: form.usuarios_previstos ? Number(form.usuarios_previstos) : null,
        armazenamento_previsto_gb: form.armazenamento_previsto_gb ? Number(form.armazenamento_previsto_gb) : null,
        data_prevista_fechamento: form.data_prevista_fechamento || null,
        probabilidade: form.probabilidade ? Number(form.probabilidade) : null,
        observacoes: form.observacoes || null,
        atualizado_por: u.user?.id ?? null,
      };
      if (oportunidade?.id) {
        const { error } = await supabase.from("saas_crm_oportunidades" as any).update(payload).eq("id", oportunidade.id);
        if (error) throw error;
        await registrarHistoricoCrm({ oportunidade_id: oportunidade.id, tipo_evento: "atualizacao", descricao: "Dados atualizados" });
      } else {
        payload.criado_por = u.user?.id ?? null;
        payload.etapa = "lead_novo";
        payload.status = "aberto";
        const { data, error } = await supabase.from("saas_crm_oportunidades" as any).insert(payload).select("id").single();
        if (error) throw error;
        const newId = (data as any)?.id;
        if (newId) await registrarHistoricoCrm({ oportunidade_id: newId, tipo_evento: "criacao", descricao: "Oportunidade criada", etapa_nova: "lead_novo" });
      }
      toast.success("Oportunidade salva");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oportunidade ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Dados da empresa</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome da empresa *</Label>
                <Input value={form.nome_empresa ?? ""} onChange={e => set("nome_empresa", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Razão social</Label>
                <Input value={form.razao_social ?? ""} onChange={e => set("razao_social", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nome fantasia</Label>
                <Input value={form.nome_fantasia ?? ""} onChange={e => set("nome_fantasia", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input value={form.cnpj ?? ""} onChange={e => set("cnpj", maskCnpj(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel_nome ?? ""} onChange={e => set("responsavel_nome", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone ?? ""} onChange={e => set("telefone", maskPhone(e.target.value))} />
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Comercial</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={form.origem ?? ""} onValueChange={v => set("origem", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS_CRM.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sistema de interesse *</Label>
                <Select value={form.sistema_saas_id ?? ""} onValueChange={v => set("sistema_saas_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {sistemas.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Plano de interesse</Label>
                <Input value={form.plano_interesse ?? ""} onChange={e => set("plano_interesse", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data prevista de fechamento</Label>
                <Input type="date" value={form.data_prevista_fechamento ?? ""} onChange={e => set("data_prevista_fechamento", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor implantação proposto</Label>
                <Input type="number" step="0.01" value={form.valor_implantacao_proposto ?? ""} onChange={e => set("valor_implantacao_proposto", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor mensal proposto</Label>
                <Input type="number" step="0.01" value={form.valor_mensal_proposto ?? ""} onChange={e => set("valor_mensal_proposto", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Lojas previstas</Label>
                <Input type="number" value={form.lojas_previstas ?? ""} onChange={e => set("lojas_previstas", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Usuários previstos</Label>
                <Input type="number" value={form.usuarios_previstos ?? ""} onChange={e => set("usuarios_previstos", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Armazenamento previsto (GB)</Label>
                <Input type="number" step="0.1" value={form.armazenamento_previsto_gb ?? ""} onChange={e => set("armazenamento_previsto_gb", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={form.probabilidade ?? ""} onChange={e => set("probabilidade", e.target.value)} />
              </div>
              {oportunidade && (
                <div className="col-span-2">
                  <Label className="text-xs">Etapa</Label>
                  <Select value={form.etapa ?? "lead_novo"} onValueChange={v => set("etapa", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ETAPAS_CRM.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={3} value={form.observacoes ?? ""} onChange={e => set("observacoes", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

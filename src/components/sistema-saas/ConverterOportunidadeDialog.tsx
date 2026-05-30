import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { maskCnpj, maskPhone } from "@/lib/masks";
import { registrarHistoricoCrm, type Oportunidade } from "@/lib/sistema-saas/crmSaas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oportunidade: Oportunidade;
  onConverted?: () => void;
}

export function ConverterOportunidadeDialog({ open, onOpenChange, oportunidade, onConverted }: Props) {
  const [saving, setSaving] = useState(false);
  const [duplicada, setDuplicada] = useState<{ id: string; nome: string } | null>(null);
  const [criarLoja, setCriarLoja] = useState(false);
  const [form, setForm] = useState({
    nome: "", razao_social: "", nome_fantasia: "", cnpj: "",
    responsavel_nome: "", email: "", telefone: "",
    plano: "personalizado",
    valor_implantacao: 0, valor_mensal: 0,
    lojas: 1, usuarios: 1, armazenamento_gb: 0,
    status: "teste" as "teste" | "ativo",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nome: oportunidade.nome_empresa,
      razao_social: oportunidade.razao_social ?? "",
      nome_fantasia: oportunidade.nome_fantasia ?? "",
      cnpj: oportunidade.cnpj ?? "",
      responsavel_nome: oportunidade.responsavel_nome ?? "",
      email: oportunidade.email ?? "",
      telefone: oportunidade.telefone ?? "",
      plano: oportunidade.plano_interesse || "personalizado",
      valor_implantacao: Number(oportunidade.valor_implantacao_proposto) || 0,
      valor_mensal: Number(oportunidade.valor_mensal_proposto) || 0,
      lojas: Number(oportunidade.lojas_previstas) || 1,
      usuarios: Number(oportunidade.usuarios_previstos) || 1,
      armazenamento_gb: Number(oportunidade.armazenamento_previsto_gb) || 0,
      status: "teste",
    });
    setCriarLoja(false);
    setDuplicada(null);
    // checagem CNPJ
    if (oportunidade.cnpj) {
      supabase.from("bases_clientes" as any).select("id,nome").eq("cnpj", oportunidade.cnpj).limit(1)
        .then(({ data }) => {
          const arr = (data as any[]) ?? [];
          if (arr[0]) setDuplicada({ id: arr[0].id, nome: arr[0].nome });
        });
    }
  }, [open, oportunidade]);

  async function vincularExistente() {
    if (!duplicada) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("saas_crm_oportunidades" as any).update({
        base_cliente_id: duplicada.id,
        status: "convertido",
        etapa: "convertido_em_base",
        data_fechamento: new Date().toISOString().slice(0, 10),
        atualizado_por: u.user?.id ?? null,
      }).eq("id", oportunidade.id);
      if (error) throw error;
      await registrarHistoricoCrm({
        oportunidade_id: oportunidade.id, tipo_evento: "vinculacao_base",
        descricao: `Vinculada à base existente: ${duplicada.nome}`,
        etapa_anterior: oportunidade.etapa, etapa_nova: "convertido_em_base",
      });
      toast.success("Oportunidade vinculada à base existente");
      onOpenChange(false);
      onConverted?.();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSaving(false); }
  }

  async function handleConverter() {
    if (!form.nome.trim()) { toast.error("Nome da base é obrigatório"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      // 1) criar base
      const basePayload: any = {
        nome: form.nome,
        razao_social: form.razao_social || null,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        responsavel_nome: form.responsavel_nome || null,
        email_responsavel: form.email || null,
        telefone_responsavel: form.telefone || null,
        sistema_saas_id: oportunidade.sistema_saas_id,
        plano: form.plano,
        status: form.status,
        criado_por: u.user?.id ?? null,
        atualizado_por: u.user?.id ?? null,
      };
      const { data: baseData, error: baseErr } = await supabase
        .from("bases_clientes" as any).insert(basePayload).select("id").single();
      if (baseErr) throw baseErr;
      const baseId = (baseData as any)?.id;

      // 2) assinatura (best-effort, se tabela existir)
      try {
        await supabase.from("base_assinaturas" as any).insert({
          base_cliente_id: baseId,
          plano: form.plano,
          valor_mensal: form.valor_mensal,
          valor_implantacao: form.valor_implantacao,
          status: "ativa",
          data_inicio: new Date().toISOString().slice(0, 10),
          lojas_incluidas: form.lojas,
          usuarios_incluidos: form.usuarios,
          armazenamento_gb: form.armazenamento_gb,
          criado_por: u.user?.id ?? null,
        });
      } catch { /* ignora se schema diferir */ }

      // 3) opcional: criar loja inicial
      if (criarLoja) {
        try {
          await supabase.from("lojas" as any).insert({
            base_cliente_id: baseId,
            nome: form.nome_fantasia || form.nome,
            ativa: true,
          });
        } catch { /* ignora */ }
      }

      // 4) atualizar oportunidade
      const { error: opErr } = await supabase.from("saas_crm_oportunidades" as any).update({
        base_cliente_id: baseId,
        status: "convertido",
        etapa: "convertido_em_base",
        data_fechamento: new Date().toISOString().slice(0, 10),
        atualizado_por: u.user?.id ?? null,
      }).eq("id", oportunidade.id);
      if (opErr) throw opErr;

      await registrarHistoricoCrm({
        oportunidade_id: oportunidade.id, tipo_evento: "conversao_base",
        descricao: `Convertida em base: ${form.nome}`,
        etapa_anterior: oportunidade.etapa, etapa_nova: "convertido_em_base",
        dados_novos: { base_cliente_id: baseId },
      });

      toast.success("Oportunidade convertida em base");
      onOpenChange(false);
      onConverted?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao converter");
    } finally { setSaving(false); }
  }

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter oportunidade em base</DialogTitle>
        </DialogHeader>

        {duplicada && (
          <div className="border border-amber-300 bg-amber-50 rounded-md p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-900">Já existe uma base com este CNPJ: {duplicada.nome}</div>
              <div className="text-amber-800 text-xs mt-1">Você pode vincular esta oportunidade à base existente em vez de criar uma nova.</div>
              <Button size="sm" className="mt-2" onClick={vincularExistente} disabled={saving}>
                Vincular à base existente
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">
            <Label className="text-xs">Nome da base *</Label>
            <Input value={form.nome} onChange={e => set("nome", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Razão social</Label>
            <Input value={form.razao_social} onChange={e => set("razao_social", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Nome fantasia</Label>
            <Input value={form.nome_fantasia} onChange={e => set("nome_fantasia", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input value={form.cnpj} onChange={e => set("cnpj", maskCnpj(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <Input value={form.responsavel_nome} onChange={e => set("responsavel_nome", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={form.telefone} onChange={e => set("telefone", maskPhone(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Plano</Label>
            <Input value={form.plano} onChange={e => set("plano", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Status inicial</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teste">Teste</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor implantação</Label>
            <Input type="number" step="0.01" value={form.valor_implantacao} onChange={e => set("valor_implantacao", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Valor mensal</Label>
            <Input type="number" step="0.01" value={form.valor_mensal} onChange={e => set("valor_mensal", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Lojas incluídas</Label>
            <Input type="number" value={form.lojas} onChange={e => set("lojas", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Usuários incluídos</Label>
            <Input type="number" value={form.usuarios} onChange={e => set("usuarios", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Armazenamento (GB)</Label>
            <Input type="number" step="0.1" value={form.armazenamento_gb} onChange={e => set("armazenamento_gb", Number(e.target.value))} />
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <Checkbox id="criar-loja" checked={criarLoja} onCheckedChange={v => setCriarLoja(!!v)} />
            <Label htmlFor="criar-loja" className="text-xs cursor-pointer">Criar loja inicial vinculada a esta base</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConverter} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Converter em base
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

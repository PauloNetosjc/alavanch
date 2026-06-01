import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Copy, Power, FlaskConical } from "lucide-react";
import { toast } from "sonner";

type Cfg = any;
type Op = { id: string; nome: string; codigo_cfop: string | null; tipo_nota: string };
type Cfop = { id: string; codigo: string; descricao: string };

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function ConfiguracoesTributariasPanel() {
  const { selectedLojaId } = useLoja();
  const [list, setList] = useState<Cfg[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [cfops, setCfops] = useState<Cfop[]>([]);
  const [edit, setEdit] = useState<Partial<Cfg> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selectedLojaId) return;
    const { data } = await supabase.from("fiscal_configuracoes_tributarias" as any)
      .select("*, fiscal_operacoes:operacao_fiscal_id(nome,codigo_cfop)")
      .eq("loja_id", selectedLojaId).order("created_at", { ascending: false });
    setList((data as any) || []);
    const { data: o } = await supabase.from("fiscal_operacoes" as any)
      .select("id,nome,codigo_cfop,tipo_nota").or(`loja_id.eq.${selectedLojaId},loja_id.is.null`).eq("ativo", true);
    setOps((o as any) || []);
    const { data: c } = await supabase.from("fiscal_cfops" as any).select("id,codigo,descricao").eq("ativo", true).order("codigo");
    setCfops((c as any) || []);
  };
  useEffect(() => { load(); }, [selectedLojaId]);

  const salvar = async () => {
    if (!selectedLojaId) return;
    if (!edit?.operacao_fiscal_id) { toast.error("Selecione a operação fiscal"); return; }
    setSaving(true);
    try {
      const cfop = cfops.find((c) => c.id === edit.cfop_id);
      const payload: any = {
        loja_id: selectedLojaId,
        operacao_fiscal_id: edit.operacao_fiscal_id,
        grupo_tributario: edit.grupo_tributario || "nacional",
        destino_uf: edit.destino_uf || null,
        indicador_ie_destinatario: edit.indicador_ie_destinatario || null,
        consumidor_final: edit.consumidor_final ?? true,
        contribuinte_icms: !!edit.contribuinte_icms,
        cfop_id: edit.cfop_id || null,
        codigo_cfop: cfop?.codigo || edit.codigo_cfop || null,
        icms_cst: edit.icms_cst || null, icms_csosn: edit.icms_csosn || null,
        icms_origem: edit.icms_origem || "0",
        icms_modalidade_bc: edit.icms_modalidade_bc || null,
        icms_aliquota: num(edit.icms_aliquota), icms_reducao_bc: num(edit.icms_reducao_bc),
        icms_mva: num(edit.icms_mva), icms_aliquota_st: num(edit.icms_aliquota_st),
        icms_reducao_bc_st: num(edit.icms_reducao_bc_st),
        icms_credito_simples_aliquota: num(edit.icms_credito_simples_aliquota),
        icms_fcp_aliquota: num(edit.icms_fcp_aliquota),
        icms_partilha_modo_calculo: edit.icms_partilha_modo_calculo || null,
        icms_interestadual_aliquota: num(edit.icms_interestadual_aliquota),
        icms_interno_aliquota: num(edit.icms_interno_aliquota),
        pis_cst: edit.pis_cst || null, pis_aliquota: num(edit.pis_aliquota), pis_base_calculo: num(edit.pis_base_calculo),
        cofins_cst: edit.cofins_cst || null, cofins_aliquota: num(edit.cofins_aliquota), cofins_base_calculo: num(edit.cofins_base_calculo),
        ipi_cst: edit.ipi_cst || null, ipi_aliquota: num(edit.ipi_aliquota), ipi_enquadramento: edit.ipi_enquadramento || null,
        adicionar_ipi_base_icms: !!edit.adicionar_ipi_base_icms,
        adicionar_frete_base_icms: !!edit.adicionar_frete_base_icms,
        adicionar_seguro_base_icms: !!edit.adicionar_seguro_base_icms,
        adicionar_outras_despesas_base_icms: !!edit.adicionar_outras_despesas_base_icms,
        observacoes: edit.observacoes || null,
        ativo: edit.ativo ?? true,
      };
      if (edit.id) {
        const { error } = await supabase.from("fiscal_configuracoes_tributarias" as any).update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fiscal_configuracoes_tributarias" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Configuração tributária salva");
      setEdit(null); load();
    } catch (e: any) { toast.error(e?.message); } finally { setSaving(false); }
  };

  const duplicar = (c: Cfg) => setEdit({ ...c, id: undefined });
  const toggleAtivo = async (c: Cfg) => {
    await supabase.from("fiscal_configuracoes_tributarias" as any).update({ ativo: !c.ativo }).eq("id", c.id);
    load();
  };
  const testar = (c: Cfg) => {
    const issues: string[] = [];
    if (!c.codigo_cfop) issues.push("CFOP ausente");
    if (!c.icms_cst && !c.icms_csosn) issues.push("CST/CSOSN ICMS ausente");
    if (!c.pis_cst) issues.push("CST PIS ausente");
    if (!c.cofins_cst) issues.push("CST COFINS ausente");
    if (issues.length) toast.error("Configuração incompleta: " + issues.join("; "));
    else toast.success("Configuração tributária aplicável a NF-e.");
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-medium">Configurações Tributárias</h3>
        <Button size="sm" onClick={() => setEdit({ grupo_tributario: "nacional", consumidor_final: true, ativo: true, icms_origem: "0" })} className="gap-1">
          <Plus className="w-3.5 h-3.5"/> Nova configuração
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Operação</th>
              <th className="text-left p-2">Grupo</th>
              <th className="text-left p-2">Destino</th>
              <th className="text-left p-2">CFOP</th>
              <th className="text-left p-2">CST / CSOSN</th>
              <th className="text-left p-2">Ativo</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-2">{c.fiscal_operacoes?.nome || "—"}</td>
                <td className="p-2 capitalize">{c.grupo_tributario.replace("_"," ")}</td>
                <td className="p-2">{c.destino_uf || "—"}</td>
                <td className="p-2 font-mono">{c.codigo_cfop || "—"}</td>
                <td className="p-2">{c.icms_cst || c.icms_csosn || "—"}</td>
                <td className="p-2">{c.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => testar(c)} title="Testar"><FlaskConical className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(c)}><Pencil className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicar(c)}><Copy className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleAtivo(c)}><Power className="w-3.5 h-3.5"/></Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">Nenhuma configuração tributária cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Alterar" : "Nova"} configuração tributária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 space-y-3">
              <h4 className="text-sm font-medium">Identificação</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Operação fiscal *</Label>
                  <Select value={edit?.operacao_fiscal_id || ""} onValueChange={(v) => setEdit({ ...edit, operacao_fiscal_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>{ops.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome} {o.codigo_cfop ? `(${o.codigo_cfop})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grupo tributário *</Label>
                  <Select value={edit?.grupo_tributario || "nacional"} onValueChange={(v) => setEdit({ ...edit, grupo_tributario: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">Nacional</SelectItem>
                      <SelectItem value="importado">Importado</SelectItem>
                      <SelectItem value="substituicao_tributaria">Substituição Tributária</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destino UF</Label>
                  <Select value={edit?.destino_uf || ""} onValueChange={(v) => setEdit({ ...edit, destino_uf: v })}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CFOP</Label>
                  <Select value={edit?.cfop_id || ""} onValueChange={(v) => setEdit({ ...edit, cfop_id: v, codigo_cfop: cfops.find((c) => c.id === v)?.codigo })}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{cfops.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Indicador IE destinatário</Label>
                  <Select value={edit?.indicador_ie_destinatario || ""} onValueChange={(v) => setEdit({ ...edit, indicador_ie_destinatario: v })}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contribuinte_icms">Contribuinte ICMS</SelectItem>
                      <SelectItem value="contribuinte_isento">Contribuinte isento</SelectItem>
                      <SelectItem value="nao_contribuinte">Não contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SwitchRow label="Consumidor final" value={edit?.consumidor_final ?? true} onChange={(v) => setEdit({ ...edit, consumidor_final: v })}/>
                <SwitchRow label="Contribuinte ICMS" value={!!edit?.contribuinte_icms} onChange={(v) => setEdit({ ...edit, contribuinte_icms: v })}/>
              </div>
            </Card>

            <Card className="p-3 space-y-3">
              <h4 className="text-sm font-medium">ICMS</h4>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>CST</Label><Input value={edit?.icms_cst || ""} onChange={(e) => setEdit({ ...edit, icms_cst: e.target.value })}/></div>
                <div><Label>CSOSN</Label><Input value={edit?.icms_csosn || ""} onChange={(e) => setEdit({ ...edit, icms_csosn: e.target.value })}/></div>
                <div><Label>Origem</Label><Input value={edit?.icms_origem || "0"} onChange={(e) => setEdit({ ...edit, icms_origem: e.target.value })}/></div>
                <div><Label>Mod. BC</Label><Input value={edit?.icms_modalidade_bc || ""} onChange={(e) => setEdit({ ...edit, icms_modalidade_bc: e.target.value })}/></div>
                <NumField label="Alíq. interna" v={edit?.icms_interno_aliquota} onChange={(x) => setEdit({ ...edit, icms_interno_aliquota: x })}/>
                <NumField label="Alíq. interestadual" v={edit?.icms_interestadual_aliquota} onChange={(x) => setEdit({ ...edit, icms_interestadual_aliquota: x })}/>
                <NumField label="FCP %" v={edit?.icms_fcp_aliquota} onChange={(x) => setEdit({ ...edit, icms_fcp_aliquota: x })}/>
                <NumField label="Crédito simples %" v={edit?.icms_credito_simples_aliquota} onChange={(x) => setEdit({ ...edit, icms_credito_simples_aliquota: x })}/>
                <NumField label="Redução BC %" v={edit?.icms_reducao_bc} onChange={(x) => setEdit({ ...edit, icms_reducao_bc: x })}/>
                <NumField label="MVA %" v={edit?.icms_mva} onChange={(x) => setEdit({ ...edit, icms_mva: x })}/>
                <NumField label="Alíq. ST %" v={edit?.icms_aliquota_st} onChange={(x) => setEdit({ ...edit, icms_aliquota_st: x })}/>
                <NumField label="Redução BC ST %" v={edit?.icms_reducao_bc_st} onChange={(x) => setEdit({ ...edit, icms_reducao_bc_st: x })}/>
                <div><Label>Partilha modo</Label><Input value={edit?.icms_partilha_modo_calculo || ""} onChange={(e) => setEdit({ ...edit, icms_partilha_modo_calculo: e.target.value })}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SwitchRow label="Adicionar frete na base ICMS" value={!!edit?.adicionar_frete_base_icms} onChange={(v) => setEdit({ ...edit, adicionar_frete_base_icms: v })}/>
                <SwitchRow label="Adicionar seguro na base ICMS" value={!!edit?.adicionar_seguro_base_icms} onChange={(v) => setEdit({ ...edit, adicionar_seguro_base_icms: v })}/>
                <SwitchRow label="Adicionar outras despesas na base ICMS" value={!!edit?.adicionar_outras_despesas_base_icms} onChange={(v) => setEdit({ ...edit, adicionar_outras_despesas_base_icms: v })}/>
                <SwitchRow label="Adicionar IPI na base ICMS" value={!!edit?.adicionar_ipi_base_icms} onChange={(v) => setEdit({ ...edit, adicionar_ipi_base_icms: v })}/>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 space-y-2">
                <h4 className="text-sm font-medium">PIS</h4>
                <div><Label>CST</Label><Input value={edit?.pis_cst || ""} onChange={(e) => setEdit({ ...edit, pis_cst: e.target.value })}/></div>
                <NumField label="Alíquota %" v={edit?.pis_aliquota} onChange={(x) => setEdit({ ...edit, pis_aliquota: x })}/>
                <NumField label="Base" v={edit?.pis_base_calculo} onChange={(x) => setEdit({ ...edit, pis_base_calculo: x })}/>
              </Card>
              <Card className="p-3 space-y-2">
                <h4 className="text-sm font-medium">COFINS</h4>
                <div><Label>CST</Label><Input value={edit?.cofins_cst || ""} onChange={(e) => setEdit({ ...edit, cofins_cst: e.target.value })}/></div>
                <NumField label="Alíquota %" v={edit?.cofins_aliquota} onChange={(x) => setEdit({ ...edit, cofins_aliquota: x })}/>
                <NumField label="Base" v={edit?.cofins_base_calculo} onChange={(x) => setEdit({ ...edit, cofins_base_calculo: x })}/>
              </Card>
              <Card className="p-3 space-y-2">
                <h4 className="text-sm font-medium">IPI</h4>
                <div><Label>CST</Label><Input value={edit?.ipi_cst || ""} onChange={(e) => setEdit({ ...edit, ipi_cst: e.target.value })}/></div>
                <NumField label="Alíquota %" v={edit?.ipi_aliquota} onChange={(x) => setEdit({ ...edit, ipi_aliquota: x })}/>
                <div><Label>Enquadramento</Label><Input value={edit?.ipi_enquadramento || ""} onChange={(e) => setEdit({ ...edit, ipi_enquadramento: e.target.value })}/></div>
              </Card>
            </div>

            <div><Label>Observações</Label><Textarea value={edit?.observacoes || ""} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            {edit?.id && <Button variant="outline" onClick={() => duplicar(edit as Cfg)}>Duplicar</Button>}
            <Button onClick={salvar} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function num(v: any) { const n = parseFloat(String(v ?? "0")); return isNaN(n) ? 0 : n; }

function NumField({ label, v, onChange }: { label: string; v: any; onChange: (n: number) => void }) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <Input type="number" step="0.0001" value={v ?? ""} onChange={(e) => onChange(parseFloat(e.target.value || "0"))}/>
    </div>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange}/>
    </div>
  );
}

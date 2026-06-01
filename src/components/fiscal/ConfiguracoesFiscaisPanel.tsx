import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Settings } from "lucide-react";
import { maskCnpj } from "@/lib/masks";

const REGIMES = [
  { v: "simples_nacional", l: "Simples Nacional" },
  { v: "lucro_presumido", l: "Lucro Presumido" },
  { v: "lucro_real", l: "Lucro Real" },
];
const PROVEDORES = [
  { v: "nacional", l: "Nacional (NFS-e Padrão Nacional)" },
  { v: "prefeitura_sp", l: "Prefeitura de São Paulo" },
  { v: "ginfes", l: "Ginfes" },
  { v: "betha", l: "Betha" },
  { v: "issnet", l: "ISSNet" },
  { v: "webiss", l: "WebISS" },
  { v: "outro", l: "Outro" },
];

export function ConfiguracoesFiscaisPanel() {
  const { selectedLojaId } = useLoja();
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selectedLojaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("configuracoes_fiscais" as any)
      .select("*")
      .eq("loja_id", selectedLojaId)
      .maybeSingle();
    setCfg(data || { loja_id: selectedLojaId, ambiente: "homologacao", emitir_nfe: false, emitir_nfse: false });
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedLojaId]);

  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));

  const salvar = async () => {
    if (!selectedLojaId) return;
    setSaving(true);
    try {
      const payload: any = { ...cfg, loja_id: selectedLojaId };
      const { error } = await supabase
        .from("configuracoes_fiscais" as any)
        .upsert(payload, { onConflict: "loja_id" });
      if (error) throw error;
      toast.success("Configuração fiscal salva");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display flex items-center gap-2"><Settings className="w-5 h-5"/> Configurações Fiscais</h2>
          <p className="text-xs text-muted-foreground">Por loja selecionada. Configure antes de emitir notas reais.</p>
        </div>
        <Badge variant={cfg?.ambiente === "producao" ? "default" : "secondary"}>
          Ambiente: {cfg?.ambiente === "producao" ? "Produção" : "Homologação"}
        </Badge>
      </div>

      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium">Dados da empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Razão social</Label><Input value={cfg?.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)}/></div>
          <div><Label>Nome fantasia</Label><Input value={cfg?.nome_fantasia || ""} onChange={(e) => set("nome_fantasia", e.target.value)}/></div>
          <div><Label>CNPJ</Label><Input value={cfg?.cnpj || ""} onChange={(e) => set("cnpj", maskCnpj(e.target.value))}/></div>
          <div><Label>Inscrição Estadual</Label><Input value={cfg?.inscricao_estadual || ""} onChange={(e) => set("inscricao_estadual", e.target.value)}/></div>
          <div><Label>Inscrição Municipal</Label><Input value={cfg?.inscricao_municipal || ""} onChange={(e) => set("inscricao_municipal", e.target.value)}/></div>
          <div><Label>CNAE principal</Label><Input value={cfg?.cnae_principal || ""} onChange={(e) => set("cnae_principal", e.target.value)}/></div>
          <div>
            <Label>Regime tributário</Label>
            <Select value={cfg?.regime_tributario || ""} onValueChange={(v) => set("regime_tributario", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>{REGIMES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>CRT</Label><Input type="number" value={cfg?.crt ?? ""} onChange={(e) => set("crt", e.target.value ? parseInt(e.target.value) : null)}/></div>
          <div><Label>UF</Label><Input maxLength={2} value={cfg?.uf || ""} onChange={(e) => set("uf", e.target.value.toUpperCase())}/></div>
          <div><Label>Município</Label><Input value={cfg?.municipio || ""} onChange={(e) => set("municipio", e.target.value)}/></div>
          <div><Label>Código IBGE do município</Label><Input value={cfg?.codigo_municipio_ibge || ""} onChange={(e) => set("codigo_municipio_ibge", e.target.value)}/></div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium">Ambiente e emissão</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Ambiente</Label>
            <Select value={cfg?.ambiente || "homologacao"} onValueChange={(v) => set("ambiente", v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm h-10">
            <Switch checked={!!cfg?.emitir_nfe} onCheckedChange={(v) => set("emitir_nfe", v)}/> Emitir NF-e
          </label>
          <label className="flex items-center gap-2 text-sm h-10">
            <Switch checked={!!cfg?.emitir_nfse} onCheckedChange={(v) => set("emitir_nfse", v)}/> Emitir NFS-e
          </label>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium">NF-e (produto)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Série NF-e</Label><Input type="number" value={cfg?.serie_nfe ?? 1} onChange={(e) => set("serie_nfe", parseInt(e.target.value || "1"))}/></div>
          <div><Label>Próximo número NF-e</Label><Input type="number" value={cfg?.proximo_numero_nfe ?? 1} onChange={(e) => set("proximo_numero_nfe", parseInt(e.target.value || "1"))}/></div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium">NFS-e (serviço)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Provedor NFS-e</Label>
            <Select value={cfg?.provedor_nfse || ""} onValueChange={(v) => set("provedor_nfse", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>{PROVEDORES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Código de serviço municipal</Label><Input value={cfg?.codigo_servico_municipal || ""} onChange={(e) => set("codigo_servico_municipal", e.target.value)}/></div>
          <div><Label>Alíquota ISS padrão (%)</Label><Input type="number" step="0.01" value={cfg?.aliquota_iss_padrao ?? ""} onChange={(e) => set("aliquota_iss_padrao", e.target.value ? parseFloat(e.target.value) : null)}/></div>
          <div><Label>Série RPS</Label><Input type="number" value={cfg?.serie_nfse ?? 1} onChange={(e) => set("serie_nfse", parseInt(e.target.value || "1"))}/></div>
          <div><Label>Próximo número RPS</Label><Input type="number" value={cfg?.proximo_numero_rps ?? 1} onChange={(e) => set("proximo_numero_rps", parseInt(e.target.value || "1"))}/></div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

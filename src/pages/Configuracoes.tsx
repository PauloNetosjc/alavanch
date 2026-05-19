import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, FileText, CreditCard, Target, Building2, Calendar, DollarSign, TrendingUp, Save } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Configuracoes() {
  const { role } = useAuth();
  if (role !== "admin" && role !== "diretor") return <Navigate to="/dashboard" replace />;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1>Configurações</h1>
          <p className="text-[12px] text-muted-foreground mt-1">Parâmetros operacionais e gestão de consultores</p>
        </div>
      </div>

      <Tabs defaultValue="politicas" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="politicas"><Settings className="w-3.5 h-3.5 mr-1.5" />Políticas</TabsTrigger>
          <TabsTrigger value="empresa"><FileText className="w-3.5 h-3.5 mr-1.5" />Dados da Empresa</TabsTrigger>
          <TabsTrigger value="taxas"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Taxas Financeiras</TabsTrigger>
          <TabsTrigger value="metas"><Target className="w-3.5 h-3.5 mr-1.5" />Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="politicas" className="mt-6"><PoliticasTab /></TabsContent>
        <TabsContent value="empresa" className="mt-6"><EmpresaTab /></TabsContent>
        <TabsContent value="taxas" className="mt-6"><TaxasTab /></TabsContent>
        <TabsContent value="metas" className="mt-6"><MetasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- HOOK CONFIG ----------
function useConfig(lojaId: string | null) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const branding = useBranding();

  useEffect(() => {
    if (!lojaId) { setConfig(null); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("configuracoes_empresa" as any).select("*").eq("loja_id", lojaId).maybeSingle();
      setConfig(data || { loja_id: lojaId });
      setLoading(false);
    })();
  }, [lojaId]);

  const save = async (patch: any) => {
    if (!lojaId) return;
    const merged = { ...config, ...patch, loja_id: lojaId };
    const { data, error } = await supabase
      .from("configuracoes_empresa" as any)
      .upsert(merged, { onConflict: "loja_id" })
      .select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    setConfig(data);
    branding.refresh();
    toast.success("Configurações salvas");
  };

  return { config, setConfig, save, loading };
}

// ---------- POLÍTICAS ----------
function PoliticasTab() {
  const { selectedLojaId, lojas } = useLoja();
  const lojaId = selectedLojaId || lojas[0]?.id || null;
  const { config, setConfig, save, loading } = useConfig(lojaId);
  if (loading) return <div className="text-[12px] text-muted-foreground">Carregando…</div>;
  if (!config) return <div className="text-[12px] text-muted-foreground">Selecione uma loja.</div>;
  const c = config;
  const set = (k: string, v: any) => setConfig({ ...c, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-emerald-500/15 flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-500" /></div>
            <div className="text-[15px] font-medium">Cálculos Base</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Markup Padrão (%)</Label>
              <Input type="number" value={c.markup_padrao ?? ""} onChange={(e) => set("markup_padrao", parseFloat(e.target.value))} disabled={!c.usar_markup} />
            </div>
            <div>
              <Label className="text-rose-500">Desc. Máximo (%)</Label>
              <Input type="number" value={c.desconto_maximo ?? ""} onChange={(e) => set("desconto_maximo", parseFloat(e.target.value))} />
            </div>
          </div>
          <label className="flex items-start gap-3 mt-4 p-3 rounded bg-secondary cursor-pointer">
            <Checkbox checked={!!c.usar_markup} onCheckedChange={(v) => set("usar_markup", !!v)} />
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide">Usar Markup nos Orçamentos</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Quando desativado, o markup deixa de aparecer no resumo financeiro e na tabela de ambientes.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 mt-2 p-3 rounded bg-secondary cursor-pointer">
            <Checkbox checked={!!c.mostrar_desconto_contrato} onCheckedChange={(v) => set("mostrar_desconto_contrato", !!v)} />
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide">Mostrar Desconto no Contrato</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Quando desativado, o contrato mostra apenas os valores finais já com desconto.</div>
            </div>
          </label>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center"><Calendar className="w-4 h-4 text-primary" /></div>
            <div className="text-[15px] font-medium">Prazo de Entrega</div>
          </div>
          <div>
            <Label>Prazo Padrão (dias)</Label>
            <Input type="number" value={c.prazo_padrao_dias ?? ""} onChange={(e) => set("prazo_padrao_dias", parseInt(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <div className="text-[14px] font-medium uppercase tracking-wide">Formação de Preço e Alíquotas Operacionais</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { k: "frete_compra_perc", label: "Frete Compra (%)" },
            { k: "frete_venda_perc", label: "Frete Venda (%)" },
            { k: "comissao_loja_perc", label: "Comissão Loja (%)" },
            { k: "icms_compra_perc", label: "ICMS Compra (%)" },
            { k: "montagem_perc", label: "Montagem (%)" },
            { k: "imp_saida_perc", label: "Imp. Saída (%)" },
            { k: "outros_perc", label: "Outros (%)" },
          ].map((f) => (
            <div key={f.k} className="surface-card p-3">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{f.label}</div>
              <Input
                type="number"
                step="0.1"
                className="mt-1 h-8 border-0 bg-transparent text-[18px] font-medium text-primary p-0"
                value={c[f.k] ?? ""}
                onChange={(e) => set(f.k, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Esses percentuais alimentam a Composição de Custos exibida no Resumo Financeiro dos orçamentos.</p>
      </div>

      <div className="surface-card p-5">
        <div className="text-[14px] font-medium uppercase tracking-wide text-primary mb-1">% Tabela de Comissões Consultores (Loja)</div>
        <p className="text-[11px] uppercase text-muted-foreground tracking-wider mb-4">Esta tabela define a alíquota de comissão da loja aplicada automaticamente sobre o VPL.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FaixaComissao titulo="BRONZE (ATÉ)" valorKey="comissao_bronze_ate" percKey="comissao_bronze_perc" config={c} setConfig={setConfig} />
          <FaixaComissao titulo="PRATA (ATÉ)" valorKey="comissao_prata_ate" percKey="comissao_prata_perc" config={c} setConfig={setConfig} />
          <FaixaComissao titulo="OURO (ACIMA)" valorKey="comissao_prata_ate" percKey="comissao_ouro_perc" config={c} setConfig={setConfig} acima />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save(c)} className="gap-2"><Save className="w-3.5 h-3.5" />Salvar</Button>
      </div>
    </div>
  );
}

function FaixaComissao({ titulo, valorKey, percKey, config, setConfig, acima }: any) {
  return (
    <div className="surface-card p-4">
      <div className="text-[10px] uppercase text-amber-500 tracking-wider font-medium">{titulo}</div>
      <Input
        type="number"
        className="mt-2 h-8 border-0 bg-transparent text-[16px] font-medium p-0"
        value={config[valorKey] ?? ""}
        readOnly={acima}
        onChange={(e) => setConfig({ ...config, [valorKey]: parseFloat(e.target.value) })}
      />
      {acima && <div className="text-[10px] text-muted-foreground">Acima do valor de Prata</div>}
      <div className="flex items-baseline gap-1 mt-3">
        <Input
          type="number"
          step="0.1"
          className="h-9 border-0 bg-transparent text-[22px] font-medium text-primary p-0 w-20"
          value={config[percKey] ?? ""}
          onChange={(e) => setConfig({ ...config, [percKey]: parseFloat(e.target.value) })}
        />
        <span className="text-[12px] text-muted-foreground">%</span>
      </div>
    </div>
  );
}

// ---------- EMPRESA ----------
function EmpresaTab() {
  const { selectedLojaId, lojas } = useLoja();
  const lojaId = selectedLojaId || lojas[0]?.id || null;
  const { config, setConfig, save, loading } = useConfig(lojaId);
  const [uploading, setUploading] = useState(false);
  if (loading) return <div className="text-[12px] text-muted-foreground">Carregando…</div>;
  if (!config) return <div className="text-[12px] text-muted-foreground">Selecione uma loja.</div>;
  const c = config;
  const set = (k: string, v: any) => setConfig({ ...c, [k]: v });

  const handleLogoUpload = async (file: File) => {
    if (!lojaId) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo deve ter até 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `lojas/${lojaId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      const url = pub.publicUrl;
      set("logo_url", url);
      await save({ ...c, logo_url: url });
      toast.success("Logo atualizado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center"><Building2 className="w-4 h-4 text-primary" /></div>
          <div className="text-[15px] font-medium">Identidade Visual</div>
        </div>
        <div className="flex items-start gap-5">
          <div
            className="w-24 h-24 rounded-md flex items-center justify-center overflow-hidden bg-secondary shrink-0"
            style={{ border: "0.5px solid hsl(var(--border))" }}
          >
            {c.logo_url ? (
              <img src={c.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <Label>Logo da Empresa</Label>
            <p className="text-[11px] text-muted-foreground mb-2">PNG, JPG ou SVG até 2MB. Aparece no menu lateral.</p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                className="max-w-xs"
              />
              {c.logo_url && (
                <Button variant="ghost" size="sm" onClick={() => { set("logo_url", null); save({ ...c, logo_url: null }); }}>
                  Remover
                </Button>
              )}
            </div>
            {uploading && <div className="text-[11px] text-muted-foreground mt-2">Enviando…</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center"><FileText className="w-4 h-4 text-primary" /></div>
            <div className="text-[15px] font-medium">Dados Básicos</div>
          </div>
          <div className="space-y-3">
            <div><Label>Nome da Empresa (Razão Social)</Label><Input value={c.nome_empresa ?? ""} onChange={(e) => set("nome_empresa", e.target.value)} /></div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input
                value={c.nome_fantasia ?? ""}
                onChange={(e) => set("nome_fantasia", e.target.value)}
                placeholder="Exibido no menu lateral"
              />
            </div>
            <div><Label>CNPJ</Label><Input value={c.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} /></div>
            <div><Label>Inscrição Estadual</Label><Input value={c.inscricao_estadual ?? ""} onChange={(e) => set("inscricao_estadual", e.target.value)} /></div>
            <div><Label>Endereço</Label><Input value={c.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-emerald-500/15 flex items-center justify-center"><Settings className="w-4 h-4 text-emerald-500" /></div>
            <div className="text-[15px] font-medium">Contato</div>
          </div>
          <div className="space-y-3">
            <div><Label>Telefone</Label><Input placeholder="(11) 3000-0000" value={c.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" placeholder="contato@empresa.com.br" value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Website</Label><Input placeholder="https://www.empresa.com.br" value={c.website ?? ""} onChange={(e) => set("website", e.target.value)} /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save(c)} className="gap-2"><Save className="w-3.5 h-3.5" />Salvar</Button>
      </div>
    </div>
  );
}

// ---------- TAXAS ----------
function TaxasTab() {
  const { selectedLojaId, lojas } = useLoja();
  const lojaId = selectedLojaId || lojas[0]?.id || null;
  const { config, setConfig, save, loading } = useConfig(lojaId);
  if (loading) return <div className="text-[12px] text-muted-foreground">Carregando…</div>;
  if (!config) return <div className="text-[12px] text-muted-foreground">Selecione uma loja.</div>;
  const c = config;
  const set = (k: string, v: any) => setConfig({ ...c, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChoiceCard
          checked={c.taxa_modo === "fixa"}
          onClick={() => set("taxa_modo", "fixa")}
          title="Taxa Fixa" desc="Uma única taxa para todas as operações"
        />
        <ChoiceCard
          checked={c.taxa_modo === "variavel"}
          onClick={() => set("taxa_modo", "variavel")}
          title="Taxa Variável" desc="Diferentes taxas por método de pagamento"
        />
      </div>

      <div className="surface-card p-5">
        <div className="text-[14px] font-medium">Responsável pela Taxa</div>
        <p className="text-[12px] text-muted-foreground mt-1 mb-4">Defina quem assume as taxas financeiras na operação</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChoiceCard
            checked={c.taxa_responsavel === "empresa"}
            onClick={() => set("taxa_responsavel", "empresa")}
            title="Empresa Assume" desc="Empresa absorve as taxas (VPL normal)"
          />
          <ChoiceCard
            checked={c.taxa_responsavel === "cliente"}
            onClick={() => set("taxa_responsavel", "cliente")}
            title="Cliente Assume" desc="Cliente paga as taxas adicionais"
          />
        </div>
      </div>

      {c.taxa_modo === "fixa" && (
        <div className="surface-card p-5">
          <Label>Taxa Fixa (%)</Label>
          <Input type="number" step="0.01" value={c.taxa_fixa_perc ?? ""} onChange={(e) => set("taxa_fixa_perc", parseFloat(e.target.value))} className="max-w-xs" />
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => save(c)} className="gap-2"><Save className="w-3.5 h-3.5" />Salvar</Button>
      </div>
    </div>
  );
}

function ChoiceCard({ checked, onClick, title, desc }: { checked: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-md transition-all ${checked ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-secondary"}`}
      style={{ border: "0.5px solid hsl(var(--border))" }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 ${checked ? "bg-primary" : "bg-muted"}`}>
          {checked && <span className="text-primary-foreground text-[12px]">✓</span>}
        </div>
        <div>
          <div className="text-[13px] font-medium">{title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
        </div>
      </div>
    </button>
  );
}

// ---------- METAS ----------
function MetasTab() {
  const { lojas } = useLoja();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [lojaId, setLojaId] = useState<string>(lojas[0]?.id || "");
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [metas, setMetas] = useState<Map<string | "global", number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lojaId && lojas[0]) setLojaId(lojas[0].id);
  }, [lojas, lojaId]);

  useEffect(() => {
    if (!lojaId) return;
    (async () => {
      setLoading(true);
      const [{ data: profs }, { data: metasData }] = await Promise.all([
        supabase.from("profiles").select("user_id, nome_completo, loja_id").eq("loja_id", lojaId),
        supabase.from("metas_vendas" as any).select("vendedor_id, meta_valor").eq("loja_id", lojaId).eq("ano", ano).eq("mes", mes),
      ]);
      setVendedores(profs || []);
      const m = new Map<string | "global", number>();
      ((metasData as any[]) || []).forEach((x) => m.set(x.vendedor_id || "global", Number(x.meta_valor)));
      setMetas(m);
      setLoading(false);
    })();
  }, [lojaId, ano, mes]);

  const setMeta = (key: string | "global", v: number) => {
    const nm = new Map(metas);
    nm.set(key, v);
    setMetas(nm);
  };

  const salvar = async () => {
    if (!lojaId) return;
    const rows = Array.from(metas.entries())
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({
        loja_id: lojaId,
        vendedor_id: k === "global" ? null : (k as string),
        ano, mes,
        meta_valor: v,
      }));
    // Apaga e reinserir para essa janela (admin only)
    await supabase.from("metas_vendas" as any).delete().eq("loja_id", lojaId).eq("ano", ano).eq("mes", mes);
    if (rows.length) {
      const { error } = await supabase.from("metas_vendas" as any).insert(rows);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Metas salvas");
  };

  const totalIndiv = useMemo(
    () => Array.from(metas.entries()).filter(([k]) => k !== "global").reduce((s, [, v]) => s + (v || 0), 0),
    [metas]
  );

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <div className="text-[14px] font-medium">Definir Metas Mensais</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Loja</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(parseInt(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <div className="text-[14px] font-medium">Meta Global da Loja</div>
          </div>
          <div className="text-[11px] text-muted-foreground">Soma das metas individuais: <span className="text-foreground font-medium">{fmtBRL(totalIndiv)}</span></div>
        </div>
        <div className="max-w-md">
          <Label>Meta mensal (R$)</Label>
          <Input
            type="number"
            value={metas.get("global") ?? ""}
            onChange={(e) => setMeta("global", parseFloat(e.target.value) || 0)}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="text-[14px] font-medium mb-4">Metas Individuais (Vendedores)</div>
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : vendedores.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Nenhum vendedor vinculado a esta loja.</div>
        ) : (
          <div className="space-y-2">
            {vendedores.map((v) => (
              <div key={v.user_id} className="grid grid-cols-2 gap-3 items-center">
                <div className="text-[12px] font-medium">{v.nome_completo || "—"}</div>
                <Input
                  type="number"
                  value={metas.get(v.user_id) ?? ""}
                  onChange={(e) => setMeta(v.user_id, parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} className="gap-2"><Save className="w-3.5 h-3.5" />Salvar Metas</Button>
      </div>
    </div>
  );
}

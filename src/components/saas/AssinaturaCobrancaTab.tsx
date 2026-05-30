import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, CreditCard, HardDrive, Receipt, ShoppingCart } from "lucide-react";

type Assinatura = {
  id: string;
  base_cliente_id: string;
  plano: string;
  status_assinatura: string;
  valor_implantacao: number;
  implantacao_paga: boolean;
  valor_mensal: number;
  dia_vencimento: number;
  forma_pagamento: string | null;
  lojas_incluidas: number;
  usuarios_incluidos: number;
  valor_loja_adicional: number;
  valor_usuario_adicional: number;
  armazenamento_incluido_mb: number;
  armazenamento_adicional_mb: number;
  valor_por_gb_adicional: number;
  armazenamento_usado_mb: number;
  observacoes: string | null;
  data_inicio: string | null;
  data_cancelamento: string | null;
};

type Cobranca = {
  id: string;
  tipo_cobranca: string;
  descricao: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
};

type Compra = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  quantidade_armazenamento_mb: number | null;
  data_compra: string;
  status_pagamento: string;
  observacoes: string | null;
};

const STATUS_ASSINATURA = ["ativa", "teste", "inadimplente", "suspensa", "cancelada"];
const FORMAS_PAGAMENTO = ["pix", "boleto", "cartao", "transferencia", "outro"];
const TIPOS_COBRANCA = [
  "mensalidade", "implantacao", "loja_adicional", "usuario_adicional",
  "modulo_extra", "armazenamento_adicional", "compra_avulsa", "customizacao",
  "treinamento", "suporte", "outro",
];
const STATUS_COBRANCA = ["pendente", "pago", "vencido", "cancelado"];
const TIPOS_COMPRA = [
  "usuario_adicional", "loja_adicional", "modulo_extra", "armazenamento_adicional",
  "treinamento", "suporte", "customizacao", "integracao", "outro",
];

const PLANO_ARMAZENAMENTO_GB: Record<string, number> = {
  basico: 10, profissional: 50, completo: 100, personalizado: 0,
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMB = (mb: number) => {
  if (!mb) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
};

function statusBadge(s: string) {
  const colors: Record<string, string> = {
    ativa: "bg-emerald-100 text-emerald-800",
    teste: "bg-blue-100 text-blue-800",
    inadimplente: "bg-orange-100 text-orange-800",
    suspensa: "bg-amber-100 text-amber-800",
    cancelada: "bg-red-100 text-red-800",
    pendente: "bg-amber-100 text-amber-800",
    pago: "bg-emerald-100 text-emerald-800",
    vencido: "bg-red-100 text-red-800",
    cancelado: "bg-zinc-200 text-zinc-700",
  };
  return <Badge className={`${colors[s] || "bg-zinc-200 text-zinc-700"} border-0 capitalize`}>{s}</Badge>;
}

export function AssinaturaCobrancaTab({
  baseId, basePlano, lojasCount, usuariosCount, userId, onChanged,
}: {
  baseId: string;
  basePlano: string;
  lojasCount: number;
  usuariosCount: number;
  userId: string | null;
  onChanged?: () => void;
}) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showGerar, setShowGerar] = useState(false);
  const [showCompra, setShowCompra] = useState(false);
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [{ data: ass }, { data: cobs }, { data: cps }] = await Promise.all([
      supabase.from("base_assinaturas" as any).select("*").eq("base_cliente_id", baseId).maybeSingle(),
      supabase.from("base_cobrancas" as any).select("*").eq("base_cliente_id", baseId).order("data_vencimento", { ascending: false }),
      supabase.from("base_compras_avulsas" as any).select("*").eq("base_cliente_id", baseId).order("data_compra", { ascending: false }),
    ]);
    setAssinatura((ass as any) || null);
    setCobrancas((cobs as any) || []);
    setCompras((cps as any) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [baseId]);

  const registrarHist = async (evento: string, descricao: string, detalhes?: any) => {
    await supabase.from("bases_clientes_historico" as any).insert({
      base_id: baseId, evento, descricao, detalhes: detalhes ?? null, usuario_id: userId,
    } as any);
  };

  const criarAssinatura = async () => {
    setSalvando(true);
    const armPlano = (PLANO_ARMAZENAMENTO_GB[basePlano] || 0) * 1024;
    const payload: any = {
      base_cliente_id: baseId,
      plano: basePlano,
      status_assinatura: "ativa",
      lojas_incluidas: Math.max(1, lojasCount),
      armazenamento_incluido_mb: armPlano,
      data_inicio: new Date().toISOString().slice(0, 10),
      criado_por: userId,
    };
    const { error } = await supabase.from("base_assinaturas" as any).insert(payload);
    if (error) { toast.error(error.message); setSalvando(false); return; }
    await registrarHist("assinatura_criada", `Assinatura criada (plano ${basePlano})`);
    toast.success("Assinatura criada");
    setSalvando(false);
    carregar();
    onChanged?.();
  };

  const salvarAssinatura = async (patch: Partial<Assinatura>) => {
    if (!assinatura) return;
    const { error } = await supabase.from("base_assinaturas" as any).update({
      ...patch, atualizado_por: userId,
    }).eq("id", assinatura.id);
    if (error) { toast.error(error.message); return; }
    setAssinatura({ ...assinatura, ...patch });
    onChanged?.();
  };

  // ===== Cálculos =====
  const calc = useMemo(() => {
    if (!assinatura) return null;
    const armPagoAdicional = compras
      .filter((c) => c.tipo === "armazenamento_adicional" && c.status_pagamento === "pago")
      .reduce((s, c) => s + Number(c.quantidade_armazenamento_mb || 0), 0);
    const armAdicionalTotal = Number(assinatura.armazenamento_adicional_mb || 0) + armPagoAdicional;
    const armTotal = Number(assinatura.armazenamento_incluido_mb || 0) + armAdicionalTotal;
    const armUsado = Number(assinatura.armazenamento_usado_mb || 0);
    const armDisp = Math.max(0, armTotal - armUsado);
    const perc = armTotal > 0 ? (armUsado / armTotal) * 100 : 0;

    const lojasAdicionais = Math.max(0, lojasCount - (assinatura.lojas_incluidas || 0));
    const usuariosAdicionais = Math.max(0, usuariosCount - (assinatura.usuarios_incluidos || 0));
    const valAdicLojas = lojasAdicionais * Number(assinatura.valor_loja_adicional || 0);
    const valAdicUsuarios = usuariosAdicionais * Number(assinatura.valor_usuario_adicional || 0);
    const totalMensal = Number(assinatura.valor_mensal || 0) + valAdicLojas + valAdicUsuarios;

    const pendentes = cobrancas.filter((c) => c.status === "pendente");
    const hoje = new Date().toISOString().slice(0, 10);
    const vencidas = pendentes.filter((c) => c.data_vencimento && c.data_vencimento < hoje);
    const proxVencimento = pendentes
      .filter((c) => c.data_vencimento && c.data_vencimento >= hoje)
      .sort((a, b) => (a.data_vencimento! < b.data_vencimento! ? -1 : 1))[0];

    return {
      armTotal, armAdicionalTotal, armUsado, armDisp, perc,
      lojasAdicionais, usuariosAdicionais, valAdicLojas, valAdicUsuarios, totalMensal,
      pendentes: pendentes.length, vencidas: vencidas.length,
      proxVencimento: proxVencimento?.data_vencimento || null,
    };
  }, [assinatura, cobrancas, compras, lojasCount, usuariosCount]);

  // ===== Ações cobranças =====
  const gerarMensalidade = async (data: {
    tipo: "unica" | "recorrente";
    mes: number; ano: number; vencimento: string; valor: number; obs?: string;
    qtdMeses?: number; diaVencimento?: number;
  }) => {
    if (!assinatura) return;

    // monta lista de competências
    const lista: { mes: number; ano: number; vencimento: string }[] = [];
    if (data.tipo === "unica") {
      lista.push({ mes: data.mes, ano: data.ano, vencimento: data.vencimento });
    } else {
      const dia = Math.min(Math.max(1, data.diaVencimento || 10), 28);
      let m = data.mes, y = data.ano;
      for (let i = 0; i < (data.qtdMeses || 1); i++) {
        const venc = `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        lista.push({ mes: m, ano: y, vencimento: venc });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    // checa duplicatas
    const duplicadas = lista.filter((l) =>
      cobrancas.some((c) => c.tipo_cobranca === "mensalidade" && c.competencia_mes === l.mes && c.competencia_ano === l.ano && c.status !== "cancelado")
    );
    if (duplicadas.length > 0) {
      const labels = duplicadas.map((d) => `${String(d.mes).padStart(2, "0")}/${d.ano}`).join(", ");
      if (!confirm(`Já existe mensalidade para: ${labels}. Deseja gerar mesmo assim?`)) return;
    }

    const payload = lista.map((l) => ({
      base_cliente_id: baseId,
      assinatura_id: assinatura.id,
      tipo_cobranca: "mensalidade",
      descricao: `Mensalidade ${String(l.mes).padStart(2, "0")}/${l.ano}`,
      competencia_mes: l.mes,
      competencia_ano: l.ano,
      data_vencimento: l.vencimento,
      valor: data.valor,
      status: "pendente",
      observacoes: data.obs || null,
      criado_por: userId,
    }));

    const { error } = await supabase.from("base_cobrancas" as any).insert(payload as any);
    if (error) { toast.error(error.message); return; }
    await registrarHist(
      data.tipo === "recorrente" ? "mensalidades_recorrentes_geradas" : "cobranca_gerada",
      data.tipo === "recorrente"
        ? `${lista.length} mensalidades recorrentes geradas (${brl(data.valor)} cada)`
        : `Mensalidade ${data.mes}/${data.ano} gerada (${brl(data.valor)})`,
    );
    toast.success(`${lista.length} cobrança(s) gerada(s)`);
    setShowGerar(false);
    carregar();
  };

  const marcarPaga = async (c: Cobranca) => {
    const { error } = await supabase.from("base_cobrancas" as any).update({
      status: "pago", data_pagamento: new Date().toISOString().slice(0, 10), atualizado_por: userId,
    }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist("cobranca_paga", `Cobrança ${c.descricao || c.tipo_cobranca} marcada como paga`);
    toast.success("Cobrança paga");
    carregar();
  };

  const cancelarCobranca = async (c: Cobranca) => {
    const { error } = await supabase.from("base_cobrancas" as any).update({ status: "cancelado", atualizado_por: userId }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist("cobranca_cancelada", `Cobrança ${c.descricao || c.tipo_cobranca} cancelada`);
    toast.success("Cobrança cancelada");
    carregar();
  };

  const excluirCobranca = async (c: Cobranca) => {
    if (c.data_pagamento) { toast.error("Não é possível excluir cobrança paga"); return; }
    if (!confirm("Excluir esta cobrança?")) return;
    const { error } = await supabase.from("base_cobrancas" as any).delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    carregar();
  };

  // ===== Compras avulsas =====
  const salvarCompra = async (c: Partial<Compra>) => {
    const payload: any = { ...c, base_cliente_id: baseId, criado_por: userId };
    const { error } = await supabase.from("base_compras_avulsas" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    await registrarHist("compra_avulsa_criada", `Compra avulsa: ${c.tipo} - ${brl(Number(c.valor || 0))}`);
    toast.success("Compra registrada");
    setShowCompra(false);
    carregar();
  };

  const togglePagoCompra = async (c: Compra) => {
    const novo = c.status_pagamento === "pago" ? "pendente" : "pago";
    const { error } = await supabase.from("base_compras_avulsas" as any).update({ status_pagamento: novo, atualizado_por: userId }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist("compra_avulsa_atualizada", `Compra avulsa ${c.tipo} → ${novo}`);
    carregar();
  };

  const cancelarCompra = async (c: Compra) => {
    const { error } = await supabase.from("base_compras_avulsas" as any).update({ status_pagamento: "cancelado", atualizado_por: userId }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist("compra_avulsa_cancelada", `Compra avulsa ${c.tipo} cancelada`);
    carregar();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!assinatura) {
    return (
      <Card className="p-6 text-center space-y-3">
        <CreditCard className="w-8 h-8 mx-auto text-muted-foreground" />
        <div className="text-sm">Esta base ainda não tem assinatura SaaS configurada.</div>
        <Button onClick={criarAssinatura} disabled={salvando}>
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}Criar assinatura
        </Button>
      </Card>
    );
  }

  const armColor = !calc ? "" :
    calc.perc >= 100 ? "bg-red-600" :
    calc.perc >= 90 ? "bg-red-500" :
    calc.perc >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-4">
      {/* Cards superiores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiMini label="Status" value={<>{statusBadge(assinatura.status_assinatura)}</>} />
        <KpiMini label="Mensal" value={brl(Number(assinatura.valor_mensal))} />
        <KpiMini label="Implantação" value={
          <span className="flex items-center gap-1 text-sm">
            {brl(Number(assinatura.valor_implantacao))}
            {assinatura.implantacao_paga ? <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px]">Pago</Badge> : <Badge className="bg-amber-100 text-amber-800 border-0 text-[9px]">Em aberto</Badge>}
          </span>
        } />
        <KpiMini label="Próximo venc." value={calc?.proxVencimento ? new Date(calc.proxVencimento).toLocaleDateString("pt-BR") : "—"} />
        <KpiMini label="Pendentes" value={String(calc?.pendentes ?? 0)} />
        <KpiMini label="Vencidas" value={String(calc?.vencidas ?? 0)} valueClass={calc && calc.vencidas > 0 ? "text-red-600" : ""} />
        <KpiMini label="Lojas" value={`${lojasCount} / ${assinatura.lojas_incluidas}`} />
        <KpiMini label="Usuários" value={`${usuariosCount} / ${assinatura.usuarios_incluidos}`} />
      </div>

      {/* Armazenamento */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium text-sm"><HardDrive className="w-4 h-4" /> Armazenamento</div>
          {calc && calc.armTotal > 0 && (
            <Badge className={`border-0 ${
              calc.perc >= 100 ? "bg-red-100 text-red-800" :
              calc.perc >= 90 ? "bg-red-100 text-red-700" :
              calc.perc >= 70 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            }`}>
              {calc.perc >= 100 ? "Limite excedido" : calc.perc >= 90 ? "Crítico" : calc.perc >= 70 ? "Atenção" : "Normal"}
            </Badge>
          )}
        </div>
        {calc && calc.armTotal > 0 ? (
          <>
            <div className="text-xs text-muted-foreground">
              {fmtMB(calc.armUsado)} usados de {fmtMB(calc.armTotal)} ({calc.perc.toFixed(1)}%)
            </div>
            <div className="w-full h-2 bg-muted rounded overflow-hidden">
              <div className={`h-full ${armColor}`} style={{ width: `${Math.min(100, calc.perc)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted-foreground">Incluído</div>{fmtMB(assinatura.armazenamento_incluido_mb)}</div>
              <div><div className="text-muted-foreground">Adicional</div>{fmtMB(calc.armAdicionalTotal)}</div>
              <div><div className="text-muted-foreground">Disponível</div>{fmtMB(calc.armDisp)}</div>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Armazenamento não definido. Configure abaixo.</div>
        )}
      </Card>

      {/* Dados da assinatura */}
      <Card className="p-4 space-y-3">
        <div className="font-medium text-sm">Dados da Assinatura</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="Plano">
            <Input value={assinatura.plano} onChange={(e) => setAssinatura({ ...assinatura, plano: e.target.value })} onBlur={() => salvarAssinatura({ plano: assinatura.plano })} />
          </Field>
          <Field label="Status">
            <Select value={assinatura.status_assinatura} onValueChange={(v) => { setAssinatura({ ...assinatura, status_assinatura: v }); salvarAssinatura({ status_assinatura: v }); registrarHist("assinatura_status", `Status: ${assinatura.status_assinatura} → ${v}`); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_ASSINATURA.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Forma de pagamento">
            <Select value={assinatura.forma_pagamento || ""} onValueChange={(v) => { setAssinatura({ ...assinatura, forma_pagamento: v }); salvarAssinatura({ forma_pagamento: v }); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{FORMAS_PAGAMENTO.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valor implantação">
            <Input type="number" step="0.01" value={assinatura.valor_implantacao} onChange={(e) => setAssinatura({ ...assinatura, valor_implantacao: Number(e.target.value) })} onBlur={() => salvarAssinatura({ valor_implantacao: assinatura.valor_implantacao })} />
          </Field>
          <Field label="Implantação paga">
            <div className="flex items-center h-9"><Switch checked={assinatura.implantacao_paga} onCheckedChange={(v) => { setAssinatura({ ...assinatura, implantacao_paga: v }); salvarAssinatura({ implantacao_paga: v }); }} /></div>
          </Field>
          <Field label="Valor mensal">
            <Input type="number" step="0.01" value={assinatura.valor_mensal} onChange={(e) => setAssinatura({ ...assinatura, valor_mensal: Number(e.target.value) })} onBlur={() => { salvarAssinatura({ valor_mensal: assinatura.valor_mensal }); registrarHist("valor_mensal_alterado", `Valor mensal: ${brl(assinatura.valor_mensal)}`); }} />
          </Field>
          <Field label="Dia vencimento">
            <Input type="number" min={1} max={31} value={assinatura.dia_vencimento} onChange={(e) => setAssinatura({ ...assinatura, dia_vencimento: Number(e.target.value) })} onBlur={() => salvarAssinatura({ dia_vencimento: assinatura.dia_vencimento })} />
          </Field>
          <Field label="Lojas incluídas">
            <Input type="number" min={0} value={assinatura.lojas_incluidas} onChange={(e) => setAssinatura({ ...assinatura, lojas_incluidas: Number(e.target.value) })} onBlur={() => salvarAssinatura({ lojas_incluidas: assinatura.lojas_incluidas })} />
          </Field>
          <Field label="Usuários incluídos">
            <Input type="number" min={0} value={assinatura.usuarios_incluidos} onChange={(e) => setAssinatura({ ...assinatura, usuarios_incluidos: Number(e.target.value) })} onBlur={() => salvarAssinatura({ usuarios_incluidos: assinatura.usuarios_incluidos })} />
          </Field>
          <Field label="Valor por loja adicional">
            <Input type="number" step="0.01" value={assinatura.valor_loja_adicional} onChange={(e) => setAssinatura({ ...assinatura, valor_loja_adicional: Number(e.target.value) })} onBlur={() => salvarAssinatura({ valor_loja_adicional: assinatura.valor_loja_adicional })} />
          </Field>
          <Field label="Valor por usuário adicional">
            <Input type="number" step="0.01" value={assinatura.valor_usuario_adicional} onChange={(e) => setAssinatura({ ...assinatura, valor_usuario_adicional: Number(e.target.value) })} onBlur={() => salvarAssinatura({ valor_usuario_adicional: assinatura.valor_usuario_adicional })} />
          </Field>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-medium mb-2 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Armazenamento</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="Incluído (GB)">
              <Input type="number" step="0.1" value={(Number(assinatura.armazenamento_incluido_mb) / 1024).toFixed(2)}
                onChange={(e) => setAssinatura({ ...assinatura, armazenamento_incluido_mb: Number(e.target.value) * 1024 })}
                onBlur={() => salvarAssinatura({ armazenamento_incluido_mb: assinatura.armazenamento_incluido_mb })} />
            </Field>
            <Field label="Adicional contratado (GB)">
              <Input type="number" step="0.1" value={(Number(assinatura.armazenamento_adicional_mb) / 1024).toFixed(2)}
                onChange={(e) => setAssinatura({ ...assinatura, armazenamento_adicional_mb: Number(e.target.value) * 1024 })}
                onBlur={() => salvarAssinatura({ armazenamento_adicional_mb: assinatura.armazenamento_adicional_mb })} />
            </Field>
            <Field label="Valor por GB adicional">
              <Input type="number" step="0.01" value={assinatura.valor_por_gb_adicional}
                onChange={(e) => setAssinatura({ ...assinatura, valor_por_gb_adicional: Number(e.target.value) })}
                onBlur={() => salvarAssinatura({ valor_por_gb_adicional: assinatura.valor_por_gb_adicional })} />
            </Field>
            <Field label="Usado (GB) - manual">
              <Input type="number" step="0.1" value={(Number(assinatura.armazenamento_usado_mb) / 1024).toFixed(2)}
                onChange={(e) => setAssinatura({ ...assinatura, armazenamento_usado_mb: Number(e.target.value) * 1024 })}
                onBlur={() => salvarAssinatura({ armazenamento_usado_mb: assinatura.armazenamento_usado_mb })} />
            </Field>
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea value={assinatura.observacoes || ""} onChange={(e) => setAssinatura({ ...assinatura, observacoes: e.target.value })} onBlur={() => salvarAssinatura({ observacoes: assinatura.observacoes })} />
        </div>
      </Card>

      {/* Resumo adicionais */}
      {calc && (
        <Card className="p-4 space-y-2">
          <div className="font-medium text-sm">Resumo mensal</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div><div className="text-muted-foreground">Mensalidade base</div>{brl(Number(assinatura.valor_mensal))}</div>
            <div><div className="text-muted-foreground">Lojas adicionais</div>{calc.lojasAdicionais} ({brl(calc.valAdicLojas)})</div>
            <div><div className="text-muted-foreground">Usuários adicionais</div>{calc.usuariosAdicionais} ({brl(calc.valAdicUsuarios)})</div>
            <div className="font-medium"><div className="text-muted-foreground font-normal">Total estimado</div>{brl(calc.totalMensal)}</div>
          </div>
        </Card>
      )}

      {/* Cobranças */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm flex items-center gap-1"><Receipt className="w-4 h-4" /> Cobranças</div>
          <Button size="sm" onClick={() => setShowGerar(true)} className="gap-1"><Plus className="w-3.5 h-3.5" />Gerar mensalidade</Button>
        </div>
        {cobrancas.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhuma cobrança gerada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Descrição</th>
                  <th className="text-left p-2">Comp.</th>
                  <th className="text-left p-2">Venc.</th>
                  <th className="text-left p-2">Valor</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Pago em</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 capitalize">{c.tipo_cobranca.replace(/_/g, " ")}</td>
                    <td className="p-2">{c.descricao || "—"}</td>
                    <td className="p-2">{c.competencia_mes ? `${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}` : "—"}</td>
                    <td className="p-2">{c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-2">{brl(Number(c.valor))}</td>
                    <td className="p-2">{statusBadge(c.status)}</td>
                    <td className="p-2">{c.data_pagamento ? new Date(c.data_pagamento).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status === "pendente" && <Button size="sm" variant="ghost" onClick={() => marcarPaga(c)}>Pagar</Button>}
                        {c.status !== "cancelado" && c.status !== "pago" && <Button size="sm" variant="ghost" onClick={() => cancelarCobranca(c)}>Cancelar</Button>}
                        {!c.data_pagamento && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => excluirCobranca(c)}>Excluir</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Compras avulsas */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm flex items-center gap-1"><ShoppingCart className="w-4 h-4" /> Compras avulsas</div>
          <Button size="sm" onClick={() => setShowCompra(true)} className="gap-1"><Plus className="w-3.5 h-3.5" />Nova compra</Button>
        </div>
        {compras.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhuma compra avulsa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Descrição</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Qtd. arm.</th>
                  <th className="text-left p-2">Valor</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 capitalize">{c.tipo.replace(/_/g, " ")}</td>
                    <td className="p-2">{c.descricao || "—"}</td>
                    <td className="p-2">{new Date(c.data_compra).toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">{c.quantidade_armazenamento_mb ? fmtMB(Number(c.quantidade_armazenamento_mb)) : "—"}</td>
                    <td className="p-2">{brl(Number(c.valor))}</td>
                    <td className="p-2">{statusBadge(c.status_pagamento)}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status_pagamento !== "cancelado" && <Button size="sm" variant="ghost" onClick={() => togglePagoCompra(c)}>{c.status_pagamento === "pago" ? "Reabrir" : "Pagar"}</Button>}
                        {c.status_pagamento !== "cancelado" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancelarCompra(c)}>Cancelar</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showGerar && assinatura && (
        <GerarMensalidadeDialog
          onClose={() => setShowGerar(false)}
          onGerar={gerarMensalidade}
          valorBase={Number(assinatura.valor_mensal) + (calc?.valAdicLojas || 0) + (calc?.valAdicUsuarios || 0)}
          diaVencimento={assinatura.dia_vencimento}
        />
      )}
      {showCompra && (
        <CompraDialog onClose={() => setShowCompra(false)} onSalvar={salvarCompra} />
      )}
    </div>
  );
}

function KpiMini({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <Card className="p-2.5">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm mt-0.5 ${valueClass || ""}`}>{value}</div>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function GerarMensalidadeDialog({
  onClose, onGerar, valorBase, diaVencimento,
}: {
  onClose: () => void;
  onGerar: (d: { mes: number; ano: number; vencimento: string; valor: number; obs?: string }) => void;
  valorBase: number;
  diaVencimento: number;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [valor, setValor] = useState(valorBase);
  const [obs, setObs] = useState("");
  const venc = useMemo(() => {
    const d = new Date(ano, mes - 1, Math.min(diaVencimento || 10, 28));
    return d.toISOString().slice(0, 10);
  }, [mes, ano, diaVencimento]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar mensalidade</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Mês"><Input type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Number(e.target.value))} /></Field>
          <Field label="Ano"><Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} /></Field>
          <Field label="Vencimento"><Input type="date" value={venc} readOnly /></Field>
          <Field label="Valor"><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
          <div className="col-span-2"><Field label="Observações"><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onGerar({ mes, ano, vencimento: venc, valor, obs })}>Gerar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompraDialog({
  onClose, onSalvar,
}: {
  onClose: () => void;
  onSalvar: (c: Partial<Compra>) => void;
}) {
  const [tipo, setTipo] = useState("armazenamento_adicional");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [qtdGb, setQtdGb] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("pendente");
  const [obs, setObs] = useState("");
  const isArm = tipo === "armazenamento_adicional";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova compra avulsa</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Tipo">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_COMPRA.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <div className="col-span-2"><Field label="Descrição"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field></div>
          {isArm && (
            <Field label="Quantidade (GB)"><Input type="number" step="0.1" value={qtdGb} onChange={(e) => setQtdGb(Number(e.target.value))} /></Field>
          )}
          <Field label="Valor"><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2"><Field label="Observações"><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSalvar({
            tipo, descricao: descricao || null, valor, data_compra: data, status_pagamento: status,
            quantidade_armazenamento_mb: isArm ? qtdGb * 1024 : 0, observacoes: obs || null,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

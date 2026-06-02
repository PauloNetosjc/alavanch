import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Calculator, Check, Plus, Printer, Save, CheckCircle2, Trash2, Eye,
  Lock, Unlock, AlertTriangle, FileText, X as XIcon, Pencil, Banknote, DollarSign, ScrollText,
  Maximize2, Minimize2, ChevronUp, ChevronDown,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClienteFormDialog, ClienteRow } from "@/components/clientes/ClienteFormDialog";
import { renderContratoHtml, type ContratoTemplate, type ContratoCtx } from "@/lib/contratoTemplate";
import { dispatchKanbanTrigger } from "@/lib/kanbanTriggers";
import { getLegacyPublicContractUrl } from "@/lib/publicLinks";
import { prepararContratoParaAssinatura } from "@/lib/contratoAssinaturaDoc";
import { calcularValidade, tempoRestante, formatarValidade, isVencida, resolverTexto, type GatilhosTemplate } from "@/lib/gatilhosVenda";

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const FORMAS_PAGAMENTO_FALLBACK = ["Boleto", "PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência", "Cheque", "Crediário Próprio"];

type Ambiente = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
  custo_aquisicao?: number | null;
  custo_fabrica?: number | null;
  negociavel?: boolean;        // incluir no orçamento
  aplicar_desconto?: boolean;  // recebe desconto rateado
};
type Item = {
  id: string;
  descricao: string;
  quantidade: number;
  custo_fabrica: number | null;
  custo_loja: number | null;
  custo_cliente: number | null;
  ambiente_id: string;
};
type Pagamento = {
  id?: string;
  metodo: string;
  valor: number;
  parcelas: number;
  data_vencimento: string | null;
  parcelas_detalhe?: number[] | null;
  parcelas_vencimentos?: (string | null)[];
  parcelas_formas?: string[];
  parcelas_locked?: boolean[];
  parcelas_confirmadas?: boolean[];
};
type ParcelaCfg = { numero: number; juros_perc?: number; forma_pagamento?: string; desconto_perc?: number };
type Metodo = { id: string; nome: string; taxa_perc_parcela?: number; max_parcelas?: number; parcelas_config?: ParcelaCfg[]; juros_modo?: "absorver" | "repassar" | string };
type Regra = { role: string; desconto_max_perc: number };

/* ========================== SENHA ADMIN DIALOG ========================== */
function SenhaAdminDialog({
  open, onOpenChange, percent, limite, onAuthorized,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  percent: number;
  limite: number;
  onAuthorized: (adminEmail: string) => void;
}) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setSenha(""); }, [open]);

  const submit = async () => {
    if (!senha) return toast.error("Informe a senha");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-admin-password", {
      body: { password: senha },
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "Senha do gestor inválida");
      return;
    }
    toast.success("Desconto autorizado pelo gestor");
    onAuthorized(data.admin_email || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex gap-3 items-start">
          <div className="w-11 h-11 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <DialogHeader className="p-0">
              <DialogTitle>Autorizar Desconto</DialogTitle>
            </DialogHeader>
            <p className="text-[13px] text-muted-foreground mt-1">
              Desconto de <b>{percent.toFixed(2)}%</b> ultrapassa o limite de{" "}
              <b>{limite.toFixed(2)}%</b>. Informe a senha do gestor para continuar.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label>Senha do Gestor</Label>
          <Input
            type="password"
            placeholder="Insira a senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
          <p className="text-[12px] text-muted-foreground">
            Senha do gestor é necessária para autorizar este desconto.
          </p>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
            {loading ? "Verificando…" : "Autorizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================== RESUMO FINANCEIRO ========================== */
function ResumoFinanceiroDialog({
  open, onOpenChange, valorInicial, descPerc, descValor, totalProposta,
  totalContrato,
  parceiroNome, parceiroPerc, parceiroValor, custoFabrica, custoFabricaReferencia,
  jurosAbsorvido, jurosRepassado,
  config, usarMarkup,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  valorInicial: number; descPerc: number; descValor: number; totalProposta: number;
  totalContrato: number;
  parceiroNome?: string; parceiroPerc: number; parceiroValor: number; custoFabrica: number;
  custoFabricaReferencia: number;
  jurosAbsorvido: number;
  jurosRepassado: number;
  config: any; usarMarkup: boolean;
}) {
  const { can } = usePermissions();
  const podeVerCusto = can("itens", "view_custo");
  const podeVerMarkup = can("itens", "view_markup") && usarMarkup;
  const podeVerComissao = can("parceiros", "view_comissao");
  const jurosCliente = jurosAbsorvido + jurosRepassado;
  // Indicador incide sobre o Valor Total da Venda (recalcula a partir do %)
  const parceiroValorReal = totalProposta * (parceiroPerc / 100);
  const valorSemJuros = totalProposta - jurosAbsorvido;
  const totalVPL = valorSemJuros - parceiroValorReal;

  // Itens fixos da Formação de Preço (alinhado com Configurações)
  const FIXED_ITEMS = [
    { key: "frete_compra_perc",  defLabel: "Frete Compra",  color: "#7C3AED", base: "vpl" as const },
    { key: "frete_venda_perc",   defLabel: "Frete",         color: "#A855F7", base: "vpl" as const },
    { key: "comissao_loja_perc", defLabel: "Comissão Loja", color: "#F59E0B", base: "vpl" as const },
    { key: "icms_compra_perc",   defLabel: "ICMS Compra",   color: "#EAB308", base: "vpl" as const },
    { key: "montagem_perc",      defLabel: "Montagem",      color: "#06B6D4", base: "vpl" as const },
    { key: "imp_saida_perc",     defLabel: "Impostos Saída",color: "#F97316", base: "venda" as const },
    { key: "outros_perc",        defLabel: "Outros",        color: "#94A3B8", base: "vpl" as const },
  ];
  const EXTRA_COLORS = ["#0EA5E9","#10B981","#EC4899","#6366F1","#14B8A6","#F43F5E","#84CC16","#D946EF"];
  const labelsCfg = (config?.formacao_preco_labels && typeof config.formacao_preco_labels === "object") ? config.formacao_preco_labels : {};
  const extrasCfg: any[] = Array.isArray(config?.formacao_preco_extras) ? config.formacao_preco_extras : [];

  const [percs, setPercs] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!config) return;
    const next: Record<string, number> = {};
    FIXED_ITEMS.forEach((f) => { next[f.key] = Number((config as any)?.[f.key]) || 0; });
    extrasCfg.forEach((e: any) => { next[`extra:${e.id}`] = Number(e?.value) || 0; });
    setPercs(next);
  }, [config]);

  const itensCusto = [
    ...FIXED_ITEMS.map((f) => {
      const label = labelsCfg[f.key] ?? f.defLabel;
      const perc = percs[f.key] ?? 0;
      const base = f.base === "venda" ? totalProposta : totalVPL;
      return { id: f.key, label, perc, color: f.color, valor: base * (perc / 100) };
    }),
    ...extrasCfg.map((e: any, idx: number) => {
      const id = `extra:${e.id}`;
      const perc = percs[id] ?? 0;
      return { id, label: e.label || "Item", perc, color: EXTRA_COLORS[idx % EXTRA_COLORS.length], valor: totalVPL * (perc / 100) };
    }),
  ];
  const setPerc = (id: string, v: number) => setPercs((p) => ({ ...p, [id]: v }));

  const totalItensCusto = itensCusto.reduce((s, i) => s + i.valor, 0);
  const totalCustos = custoFabrica + totalItensCusto;
  const lucro = totalVPL - totalCustos;
  const margem = totalProposta > 0 ? (lucro / totalProposta) * 100 : 0;
  const markup = custoFabrica > 0 ? totalVPL / custoFabrica : 0;

  const Row = ({ label, valor, perc, color, percValue, onPercChange, editable = true }: { label: string; valor: number; perc: number; color: string; percValue?: number; onPercChange?: (v: number) => void; editable?: boolean }) => (
    <div>
      <div className="flex items-center justify-between text-[13px] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editable && onPercChange && (
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                step="0.01"
                value={percValue ?? 0}
                onChange={(e) => onPercChange(Number(e.target.value) || 0)}
                className="w-14 h-6 text-[12px] text-right bg-background border border-input rounded px-1"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>
          )}
          <span className="text-mono font-semibold tabular-nums w-24 text-right">{fmtBrl(valor)}</span>
        </div>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, perc)}%`, background: color }} />
      </div>
      <div className="text-right text-[11px] text-muted-foreground mt-0.5">{perc.toFixed(2)}% do custo</div>
    </div>
  );

  const composicaoTotal = totalCustos > 0 ? totalCustos : 1;
  const pct = (v: number) => (v / composicaoTotal) * 100;

  const Field = ({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) => (
    <div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-[18px] font-semibold text-mono leading-tight" style={color ? { color } : {}}>
        {value}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumo Financeiro</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-2">
          {/* VALORES PRINCIPAIS */}
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valores Principais</div>
            {(() => {
              const fator = 1 + (parceiroPerc / 100);
              const valorInicialSemInd = fator > 0 ? valorInicial / fator : valorInicial;
              const valorInicialComInd = valorInicial;
              return (
                <>
                  <Field label="Valor Inicial" value={fmtBrl(valorInicialSemInd)} />
                  {parceiroPerc > 0 && <Field label="Valor Inicial + Ind." value={fmtBrl(valorInicialComInd)} />}
                </>
              );
            })()}
            <Field label="Descontos" color="#B83232"
              value={<>-{fmtBrl(descValor)} <span className="text-[12px] text-muted-foreground">({descPerc.toFixed(2)}%)</span></>}
            />
            {(() => {
              const descMetodo = Math.max(0, valorInicial - descValor - totalProposta);
              const descMetodoPerc = valorInicial > 0 ? (descMetodo / valorInicial) * 100 : 0;
              if (descMetodo <= 0.01) return null;
              return (
                <Field label="Desconto Forma Pagamento" color="#B83232" value={<>-{fmtBrl(descMetodo)} <span className="text-[12px] text-muted-foreground">({descMetodoPerc.toFixed(2)}%)</span></>} />
              );
            })()}
            <Field label="Valor da Proposta (sem juros)" value={fmtBrl(totalProposta)} />
            {jurosRepassado > 0.01 && (
              <>
                <Field label="Juros repassado ao cliente" color="#B83232" value={<>+{fmtBrl(jurosRepassado)}</>} />
                <Field label="Valor final com juros (contrato)" color="#1F5235" value={fmtBrl(totalContrato)} />
              </>
            )}
            {parceiroNome && podeVerComissao && (
              <Field label={`Indicador (${parceiroNome})`} color="#B83232"
                value={<>-{fmtBrl(parceiroValorReal)} <span className="text-[12px] text-muted-foreground">({parceiroPerc.toFixed(2)}%)</span></>} />
            )}
            {podeVerCusto && <Field label="VPL (Valor Presente Líquido)" color="#16A34A" value={fmtBrl(totalVPL)} />}
            {podeVerMarkup && (
              <>
                <div>
                  <div className="text-[12px] text-muted-foreground">Markup Médio</div>
                  <div className="text-[20px] font-semibold text-emerald-600">{markup.toFixed(2)}x</div>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Cálculo:</div>
                  <div className="text-[12px] text-muted-foreground">VPL ÷ Custo Base = Markup</div>
                  <div className="text-[12px] text-muted-foreground">{fmtBrl(totalVPL)} ÷ {fmtBrl(custoFabrica)} = {markup.toFixed(2)}x</div>
                </div>
              </>
            )}
          </div>

          {/* COMPOSIÇÃO DE CUSTOS */}
          {podeVerCusto && (
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Composição de Custos</div>
            <div className="text-[10px] text-muted-foreground -mt-2">% sobre VPL · Impostos sobre Valor Total da Venda · edite para simular</div>
            <Row label="Custo CMV" valor={custoFabrica} perc={pct(custoFabrica)} color="#3F8B5C" editable={false} />
            <div className="pl-4 -mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Custo Fábrica <span className="italic">(referência interna)</span></span>
              <span className="text-mono">{fmtBrl(custoFabricaReferencia)}</span>
            </div>
            {itensCusto.map((i) => (
              <Row key={i.id} label={i.label} valor={i.valor} perc={pct(i.valor)} color={i.color} percValue={i.perc} onPercChange={(v) => setPerc(i.id, v)} />
            ))}
            <div className="border-t border-border pt-2 flex items-center justify-between text-[14px] font-semibold">
              <span>Total</span>
              <span className="text-mono">{fmtBrl(totalCustos)}</span>
            </div>
          </div>
          )}

          {/* RESULTADO */}
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado Estimado</div>
            <div className="flex flex-col items-center py-2">
              <div className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{ background: `conic-gradient(#3F8B5C ${Math.max(0, margem)}%, #E5E7EB 0)` }}>
                <div className="w-24 h-24 rounded-full bg-background flex flex-col items-center justify-center">
                  <div className="text-[20px] font-semibold">{margem.toFixed(1)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">margem</div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[11px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Lucro</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Custos</span>
              </div>
            </div>
            {(() => {
              const custoCmv = custoFabrica;
              const custoFab = custoFabricaReferencia;
              const totalCustosSimulado = totalCustos - custoCmv + custoFab;
              const lucroEstimadoCmvFabrica = totalVPL - totalCustosSimulado;
              const markupLoja = totalCustos > 0 ? totalVPL / totalCustos : null;
              const margemLoja = totalVPL > 0 ? ((totalVPL - totalCustos) / totalVPL) * 100 : null;
              const markupCmvFabrica = totalCustosSimulado > 0 ? totalVPL / totalCustosSimulado : null;
              const margemCmvFabrica = totalVPL > 0 ? ((totalVPL - totalCustosSimulado) / totalVPL) * 100 : null;
              const lucroFabrica = custoCmv > 0 && custoFab > 0 ? custoCmv - custoFab : null;
              const fmtX = (v: number | null) => v !== null ? `${v.toFixed(2).replace(".", ",")}x` : "—";
              const fmtPct = (v: number | null) => v !== null ? `${v.toFixed(2).replace(".", ",")}%` : "—";
              const mkpMargemLoja = (markupLoja === null && margemLoja === null) ? "—" : `${fmtX(markupLoja)} / ${fmtPct(margemLoja)}`;
              const mkpMargemCmvFab = (markupCmvFabrica === null && margemCmvFabrica === null) ? "—" : `${fmtX(markupCmvFabrica)} / ${fmtPct(margemCmvFabrica)}`;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Total VPL</span>
                    <span className="text-mono font-semibold">{fmtBrl(totalVPL)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Total Custos</span>
                    <span className="text-mono font-semibold text-rose-600">-{fmtBrl(totalCustos)}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[12px] text-muted-foreground">Lucro Estimado</div>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">CMV Loja</span>
                    </div>
                    <div className="text-[24px] font-semibold text-emerald-600 text-mono">{fmtBrl(lucro)}</div>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">MKP / Margem CMV Loja</span>
                    <span className="text-mono font-semibold">{mkpMargemLoja}</span>
                  </div>
                  <div className="border-t border-border pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Lucro Estimado CMV Fábrica</span>
                      <span className="text-mono font-semibold text-emerald-600">{fmtBrl(lucroEstimadoCmvFabrica)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">MKP / Margem Lucro CMV Fábrica</span>
                      <span className="text-mono font-semibold">{mkpMargemCmvFab}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Lucro Fábrica</span>
                      <span className={`text-mono font-semibold ${lucroFabrica !== null && lucroFabrica < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {lucroFabrica !== null ? fmtBrl(lucroFabrica) : "—"}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================== VALIDAR CLIENTE DIALOG ========================== */
const camposObrigatorios: { key: keyof ClienteRow; label: string }[] = [
  { key: "cpf_cnpj", label: "CPF/CNPJ" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone" },
  { key: "endereco_cobranca", label: "Endereço" },
];

function ValidarClienteDialog({
  open, onOpenChange, missing, onAtualizar, onContinuar,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  missing: string[]; onAtualizar: () => void; onContinuar: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex gap-3 items-start">
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <DialogHeader className="p-0">
              <DialogTitle>Dados do Cliente Incompletos</DialogTitle>
            </DialogHeader>
            <p className="text-[13px] text-muted-foreground mt-1">
              Para gerar um orçamento completo, preencha os dados do cliente clicando no botão "Atualizar Dados do Cliente".
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            {missing.length} campo(s) não preenchido(s):
          </div>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[12px]">
                <XIcon className="w-3 h-3" /> {m}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground mt-3">
          ℹ Você pode preencher posteriormente; o orçamento será emitido sem todas as informações neste momento.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onAtualizar} className="w-full">
            <Pencil className="w-4 h-4 mr-1.5" /> Atualizar Dados do Cliente
          </Button>
          <Button variant="outline" onClick={onContinuar} className="w-full">
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir sem preencher
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================== CONFIRMAR / GERAR CONTRATO ========================== */
function ConfirmarPedidoDialog({
  open, onOpenChange, observacoesPadrao, onConfirm, loading,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  observacoesPadrao: string;
  onConfirm: (obs: string, previsaoMedicao: string | null) => void;
  loading: boolean;
}) {
  const [obs, setObs] = useState("");
  const [previsaoMedicao, setPrevisaoMedicao] = useState("");
  useEffect(() => { if (open) { setObs(observacoesPadrao || ""); setPrevisaoMedicao(""); } }, [open, observacoesPadrao]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="flex gap-3 items-start">
          <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <ScrollText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <DialogHeader className="p-0">
              <DialogTitle>Gerar Contrato</DialogTitle>
            </DialogHeader>
            <p className="text-[13px] text-muted-foreground mt-1">
              Adicione observações e a previsão de medição que devem aparecer no pedido e contrato.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Previsão de medição</Label>
          <Input type="date" value={previsaoMedicao} onChange={(e) => setPrevisaoMedicao(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Data prevista para realização da medição técnica.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Notas / Observações adicionais</Label>
          <Textarea
            rows={8}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: Prazo de entrega de 45 dias úteis após assinatura do caderno técnico…"
          />
          <p className="text-[11px] text-muted-foreground">
            Estas notas aparecerão no contrato e ficarão registradas no pedido (somente leitura).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(obs, previsaoMedicao || null)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="w-4 h-4 mr-1.5" /> {loading ? "Gerando…" : "Confirmar e Gerar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default function ComercialNegociacao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orc, setOrc] = useState<any>(null);
  const [pedidoRef, setPedidoRef] = useState<{ id: string; codigo: string; tipo: "complemento" | "adendo" } | null>(null);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [parceiro, setParceiro] = useState<{ nome: string } | null>(null);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [usarMarkup, setUsarMarkup] = useState<boolean>(false);

  // regras
  const [meuLimite, setMeuLimite] = useState<number>(0);
  const [autorizadoPorGestor, setAutorizadoPorGestor] = useState(false);
  const [aprovadorEmail, setAprovadorEmail] = useState<string>("");

  // desconto (campos editados)
  const [descPerc, setDescPerc] = useState<number>(0);
  const [descValor, setDescValor] = useState<number>(0);
  // desconto aplicado (efetivo)
  const [descPercAplicado, setDescPercAplicado] = useState<number>(0);
  const [descValorAplicado, setDescValorAplicado] = useState<number>(0);

  // novo pagamento
  const [novoMetodo, setNovoMetodo] = useState("");
  
  const [novoParcelas, setNovoParcelas] = useState<number>(24);
  const [novoVenc, setNovoVenc] = useState<string>("");
  const [entrada, setEntrada] = useState<number>(0);
  const [FORMAS_PAGAMENTO, setFormasPagamento] = useState<string[]>(FORMAS_PAGAMENTO_FALLBACK);
  type EntradaCfg = { id: string; nome: string; forma_pagamento: string; percentual_desconto: number; ativo: boolean };
  const [entradasCfg, setEntradasCfg] = useState<EntradaCfg[]>([]);
  const [entradaCfgId, setEntradaCfgId] = useState<string>("");
  const [confirmTrocaMetodo, setConfirmTrocaMetodo] = useState<{ metodo: string; parcelas: number } | null>(null);

  useEffect(() => {
    supabase.from("formas_pagamento").select("nome").eq("ativo", true).order("ordem").then(({ data }) => {
      const list = (data || []).map((r: any) => r.nome).filter(Boolean);
      if (list.length) setFormasPagamento(list);
    });
    supabase
      .from("formas_pagamento_entrada")
      .select("id, nome, forma_pagamento, percentual_desconto, ativo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        const list = ((data || []) as any[]).map((r) => ({
          id: r.id, nome: r.nome, forma_pagamento: r.forma_pagamento,
          percentual_desconto: Number(r.percentual_desconto) || 0, ativo: !!r.ativo,
        })) as EntradaCfg[];
        setEntradasCfg(list);
      });
  }, []);

  // dialogs
  const [openSenha, setOpenSenha] = useState(false);
  const [openSolicitarDesc, setOpenSolicitarDesc] = useState(false);
  const [motivoDesc, setMotivoDesc] = useState("");
  const [enviandoDesc, setEnviandoDesc] = useState(false);
  const [aprovacaoDescPendente, setAprovacaoDescPendente] = useState(false);
  const [openResumo, setOpenResumo] = useState(false);
  const [openValidar, setOpenValidar] = useState(false);
  const [openClienteEdit, setOpenClienteEdit] = useState(false);
  const [actionAfterValidate, setActionAfterValidate] = useState<"print" | "save" | "confirmar" | null>(null);
  const [openConfirmar, setOpenConfirmar] = useState(false);
  const [tplContrato, setTplContrato] = useState<ContratoTemplate | null>(null);
  const [tplOrcamento, setTplOrcamento] = useState<any>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Recolhe sidebar automaticamente ao abrir a negociação (foco total)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sidebar:set-collapsed", { detail: { collapsed: true } }));
  }, []);

  // Modo tela cheia (Fullscreen API real do navegador)
  const negociacaoRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function entrarTelaCheia() {
    const el = negociacaoRef.current;
    if (el && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[fullscreen] requestFullscreen falhou", err);
        setIsFullscreen(true); // fallback CSS
      }
    } else {
      if (import.meta.env.DEV) console.warn("[fullscreen] API indisponível, usando fallback CSS");
      setIsFullscreen(true);
    }
  }

  async function sairTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[fullscreen] exitFullscreen falhou", err);
    }
    setIsFullscreen(false);
  }

  // Sincronizar estado com mudanças do navegador (ESC nativo etc.)
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ENTER fora de campos sai da tela cheia (ESC já é tratado pelo navegador)
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          tag === "button" ||
          (document.activeElement as HTMLElement | null)?.isContentEditable;
        if (!isEditable) sairTelaCheia();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);


  /* ----------------------------- load ----------------------------- */
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: amb }, { data: m }, { data: pgs }, { data: u }] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("id, codigo, nome_projeto, subtotal, total, desconto_perc, desconto_valor, parceiro_perc, parceiro_id, status, cliente_id, loja_id, is_complemento, pedido_origem_complemento_id, is_adendo, adendo_descricao, adendo_tipo, cliente:clientes(*), parceiro:parceiros(nome)")
          .eq("id", id)
          .single(),
        supabase
          .from("ambientes")
          .select("id, nome, descricao, preco_sugerido, custo_aquisicao, custo_fabrica, negociavel, aplicar_desconto")
          .eq("orcamento_id", id)
          .order("ordem"),
        supabase.from("metodos_pagamento").select("id, nome, taxa_perc_parcela, max_parcelas, parcelas_config, juros_modo").eq("ativo", true).order("nome"),
        supabase.from("pagamentos_orcamento")
          .select("id, metodo, valor, parcelas, data_vencimento, parcelas_detalhe, parcelas_vencimentos, parcelas_formas")
          .eq("orcamento_id", id),
        supabase.auth.getUser(),
      ]);
      setOrc(o);
      // Carrega pedido de origem (complemento ou adendo) para referência visual no topo
      try {
        if ((o as any)?.is_complemento && (o as any)?.pedido_origem_complemento_id) {
          const { data: p } = await supabase.from("pedidos").select("id, codigo").eq("id", (o as any).pedido_origem_complemento_id).maybeSingle();
          if (p) setPedidoRef({ id: p.id, codigo: p.codigo || "", tipo: "complemento" });
        } else if ((o as any)?.is_adendo && (o as any)?.pedido_origem_id) {
          const { data: p } = await supabase.from("pedidos").select("id, codigo").eq("id", (o as any).pedido_origem_id).maybeSingle();
          if (p) setPedidoRef({ id: p.id, codigo: p.codigo || "", tipo: "adendo" });
        } else {
          setPedidoRef(null);
        }
      } catch { setPedidoRef(null); }
      setCliente((o?.cliente ?? null) as ClienteRow | null);
      setParceiro((o?.parceiro ?? null) as any);
      setAmbientes((amb ?? []) as Ambiente[]);
      setMetodos(((m ?? []) as any[]).map((mm) => ({ ...mm, parcelas_config: Array.isArray(mm.parcelas_config) ? mm.parcelas_config : [] })) as Metodo[]);
      setPagamentos(((pgs ?? []) as any).map((p: any) => ({
        ...p,
        parcelas_detalhe: Array.isArray(p.parcelas_detalhe) ? p.parcelas_detalhe.map(Number) : null,
        parcelas_vencimentos: Array.isArray(p.parcelas_vencimentos) ? p.parcelas_vencimentos.map((v: any) => v || null) : null,
        parcelas_formas: Array.isArray(p.parcelas_formas) ? p.parcelas_formas.map(String) : null,
      })));

      const ambIds = (amb ?? []).map((a: any) => a.id);
      if (ambIds.length) {
        const { data: its } = await supabase
          .from("sub_itens_ambiente")
          .select("id, descricao, quantidade, custo_fabrica, custo_loja, custo_cliente, ambiente_id")
          .in("ambiente_id", ambIds);
        setItens((its ?? []) as Item[]);
      }

      const dp = Number(o?.desconto_perc) || 0;
      const dv = Number(o?.desconto_valor) || 0;
      setDescPerc(dp); setDescValor(dv);
      setDescPercAplicado(dp); setDescValorAplicado(dv);

      // limite do usuário (individual sobrepõe o do cargo)
      const userId = u?.user?.id;
      if (userId) {
        const [{ data: roles }, { data: regras }, { data: prof }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase.from("regras_aprovacao").select("role, desconto_max_perc").eq("ativo", true),
          supabase.from("profiles").select("desconto_max_perc").eq("user_id", userId).maybeSingle(),
        ]);
        const meusRoles = (roles ?? []).map((r: any) => r.role);
        const maxRole = (regras ?? [])
          .filter((r: Regra) => meusRoles.includes(r.role))
          .reduce((mx, r) => Math.max(mx, Number(r.desconto_max_perc) || 0), 0);
        const indiv = (prof as any)?.desconto_max_perc;
        setMeuLimite(indiv != null ? Number(indiv) : maxRole);
      }

      // Template de contrato da loja do orçamento
      const { data: tplLoja } = o?.loja_id
        ? await supabase
            .from("contratos_template")
            .select("*")
            .eq("ativo", true)
            .eq("loja_id", o.loja_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : ({ data: null } as any);
      setTplContrato((tplLoja ?? null) as ContratoTemplate | null);

      // Template de orçamento — primeiro tenta da loja do orçamento, depois fallback global
      {
        let tplOrc: any = null;
        if (o?.loja_id) {
          const { data } = await (supabase as any)
            .from("orcamento_templates")
            .select("*")
            .eq("loja_id", o.loja_id)
            .eq("ativo", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          tplOrc = data || null;
        }
        if (!tplOrc) {
          // Fallback: template global (loja_id NULL) ativo
          const { data } = await (supabase as any)
            .from("orcamento_templates")
            .select("*")
            .is("loja_id", null)
            .eq("ativo", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          tplOrc = data || null;
        }
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[Gatilhos negociação] template carregado", {
            lojaIdOrcamento: o?.loja_id,
            templateId: tplOrc?.id,
            templateLojaId: tplOrc?.loja_id,
            mostrar_gatilhos_venda: tplOrc?.mostrar_gatilhos_venda,
            mostrar_gatilhos_na_negociacao: tplOrc?.mostrar_gatilhos_na_negociacao,
            usar_gatilho_escassez: tplOrc?.usar_gatilho_escassez,
            quantidade_contratos_restantes: tplOrc?.quantidade_contratos_restantes,
            usar_gatilho_urgencia: tplOrc?.usar_gatilho_urgencia,
            validade_horas: tplOrc?.validade_horas,
            validade_data_hora: tplOrc?.validade_data_hora,
          });
          if (!tplOrc) console.warn("Template de orçamento ativo não encontrado para a loja do orçamento.");
        }
        setTplOrcamento(tplOrc);
      }


      // Configurações da empresa (composição de custos e markup)
      const lojaId = (o as any)?.loja_id;
      if (lojaId) {
        const { data: cfg } = await supabase.from("configuracoes_empresa" as any).select("*").eq("loja_id", lojaId).maybeSingle();
        setConfig(cfg || null);
        setUsarMarkup(!!(cfg as any)?.usar_markup);
      } else {
        const { data: cfg } = await supabase.from("configuracoes_empresa" as any).select("*").limit(1).maybeSingle();
        setConfig(cfg || null);
        setUsarMarkup(!!(cfg as any)?.usar_markup);
      }

      // Estado de aprovação de desconto (Central de Autorizações)
      try {
        const { data: autExist } = await (supabase as any)
          .from("autorizacoes")
          .select("status")
          .eq("origem_modulo", "negociacao")
          .eq("origem_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const st = (autExist as any)?.status;
        if (st === "aprovada") setAutorizadoPorGestor(true);
        if (st === "pendente") setAprovacaoDescPendente(true);
      } catch {}

      setLoading(false);
    })();
  }, [id]);

  /* --------------------------- derived --------------------------- */
  // Apenas ambientes "incluídos" (negociavel !== false) entram no orçamento.
  const ambientesIncluidos = useMemo(
    () => ambientes.filter((a) => a.negociavel !== false),
    [ambientes],
  );
  const subtotalComDesconto = useMemo(
    () => ambientesIncluidos.filter((a) => a.aplicar_desconto !== false).reduce((s, a) => s + (Number(a.preco_sugerido) || 0), 0),
    [ambientesIncluidos],
  );
  const subtotalSemDesconto = useMemo(
    () => ambientesIncluidos.filter((a) => a.aplicar_desconto === false).reduce((s, a) => s + (Number(a.preco_sugerido) || 0), 0),
    [ambientesIncluidos],
  );
  const isAdendo = !!(orc as any)?.is_adendo;
  const adendoTipo = (orc as any)?.adendo_tipo as ("receber" | "pagar" | undefined);
  const adendoValor = Number((orc as any)?.total) || 0;
  const subtotalAmbientes = isAdendo ? adendoValor : (subtotalComDesconto + subtotalSemDesconto);
  const parceiroPerc = isAdendo ? 0 : (Number(orc?.parceiro_perc) || 0);
  const parceiroValor = subtotalAmbientes * (parceiroPerc / 100);
  const valorInicial = subtotalAmbientes + parceiroValor;
  // Desconto incide apenas sobre os ambientes marcados como "Aplicar desconto"
  const baseDescontavel = isAdendo ? 0 : (subtotalComDesconto + subtotalComDesconto * (parceiroPerc / 100));
  const descValorEfetivo = isAdendo ? 0 : Math.min(descValorAplicado, baseDescontavel);
  // Desconto adicional vindo da forma de pagamento (parcelas_config[parcelas].desconto_perc)
  // incide sobre o valor bruto (após desconto manual), SEM descontar a entrada.
  const metodoSelecionado = metodos.find((m) => m.nome === novoMetodo);
  const cfgParcelaSel = metodoSelecionado?.parcelas_config?.find((p) => Number(p.numero) === Number(novoParcelas));
  const descontoMetodoPerc = Number(cfgParcelaSel?.desconto_perc) || 0;
  const _somaEntradasAdicionadas = pagamentos.reduce((s, p: any) => s + (p.is_entrada ? (p.valor || 0) : 0), 0);
  // Base do desconto da forma de pagamento = valor bruto (após desconto manual). Entrada NÃO reduz a base.
  const baseParaMetodo = Math.max(0, isAdendo ? adendoValor : Math.max(0, valorInicial - descValorEfetivo));
  const descontoMetodoValor = baseParaMetodo * (descontoMetodoPerc / 100);
  // Subtotal após desconto da forma de pagamento (antes do desconto adicional da entrada).
  const subtotalAposFormaPag = Math.max(0, baseParaMetodo - descontoMetodoValor);
  // Desconto adicional gerado pela entrada: aplicado sobre cada entrada conforme a forma escolhida na própria parcela.
  // Cada entrada usa o percentual configurado em Formas de Pagamento > ENTRADA para a forma_pagamento escolhida.
  const cfgPorForma = (forma?: string | null) => {
    if (!forma) return null;
    return entradasCfg.find((c) => c.forma_pagamento?.toLowerCase() === forma.toLowerCase()) || null;
  };
  const entradaCfgSelecionada = entradasCfg[0] || null;
  const descontoEntradaSemConfig = entradasCfg.length === 0;
  const totalEntrada = _somaEntradasAdicionadas;
  const descontoEntradaValor = pagamentos.reduce((s, p: any) => {
    if (!p.is_entrada) return s;
    const cfg = cfgPorForma(p.metodo);
    const perc = Number(cfg?.percentual_desconto) || 0;
    return s + (Number(p.valor) || 0) * (perc / 100);
  }, 0);
  // Percentual exibido (referência da primeira entrada ou da config padrão).
  const descontoEntradaPerc = Number(
    cfgPorForma((pagamentos.find((p: any) => p.is_entrada) as any)?.metodo)?.percentual_desconto
    ?? entradaCfgSelecionada?.percentual_desconto
    ?? 0,
  );
  // Valor final negociado: subtotal - desconto da entrada. A entrada continua preservada.
  const totalProposta = Math.max(0, subtotalAposFormaPag - descontoEntradaValor);
  const saldoAParcelar = Math.max(0, totalProposta - totalEntrada);
  const totalAlocado = pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
  const restante = totalProposta - totalAlocado;
  const allocPerc = totalProposta > 0 ? Math.min(100, (totalAlocado / totalProposta) * 100) : 0;
  // Custo CMV = soma do "valor de custo" dos ambientes (custo_aquisicao).
  // Entra no Total de Custos e no cálculo de margem.
  const custoFabricaTotal = useMemo(
    () => ambientesIncluidos.reduce((s, a) => s + (Number(a.custo_aquisicao) || 0), 0),
    [ambientesIncluidos],
  );
  // Custo Fábrica (referência) = soma do "valor de fábrica" dos ambientes (custo_fabrica).
  // Apenas informativo — NÃO entra no Total de Custos nem na margem.
  const custoFabricaReferencia = useMemo(
    () => ambientesIncluidos.reduce((s, a) => s + (Number(a.custo_fabrica) || 0), 0),
    [ambientesIncluidos],
  );
  // Calcula juros por pagamento, separando por modo (absorver x repassar).
  // - "absorver": loja banca → não acresce contrato; vira juros_previsto no financeiro.
  // - "repassar": cliente paga → acresce contrato e pagamentos_orcamento.valor.
  const calcJurosDoPagamento = (p: Pagamento) => {
    const n = Number(p.parcelas) || 1;
    const met = metodos.find((m) => m.nome === p.metodo);
    const cfg = Array.isArray((met as any)?.parcelas_config)
      ? (met as any).parcelas_config.find((c: any) => Number(c?.numero) === n)
      : null;
    let jurosPerc = Number(cfg?.juros_perc) || 0;
    let valor = 0;
    if (jurosPerc > 0) {
      valor = (Number(p.valor || 0) * jurosPerc) / 100;
    } else if (n > 1) {
      const taxa = (Number((met as any)?.taxa_perc_parcela) || 0) / 100;
      if (taxa) {
        const principal = (Number(p.valor) || 0) / n;
        let total = 0;
        for (let i = 1; i < n; i++) total += principal * taxa * i;
        valor = total;
        jurosPerc = (Number(p.valor) || 0) > 0 ? (valor / Number(p.valor)) * 100 : 0;
      }
    }
    const modo = ((met as any)?.juros_modo || "repassar") as string;
    return { valor, jurosPerc, repassar: modo !== "absorver" };
  };

  const jurosBreakdown = useMemo(() => {
    let absorvido = 0;
    let repassado = 0;
    pagamentos.forEach((p) => {
      const j = calcJurosDoPagamento(p);
      if (j.repassar) repassado += j.valor;
      else absorvido += j.valor;
    });
    return { absorvido, repassado };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamentos, metodos]);

  const jurosAbsorvido = jurosBreakdown.absorvido;
  const jurosRepassado = jurosBreakdown.repassado;
  // Total exibido no contrato/PDF/orcamentos.total: base + juros repassados ao cliente.
  const totalContrato = totalProposta + jurosRepassado;
  // Compatibilidade com chamadas existentes (ResumoFinanceiroDialog soma os dois)
  const jurosCliente = jurosAbsorvido + jurosRepassado;

  /* ------------------------- handlers ------------------------- */
  // Desconto incide APENAS sobre os ambientes marcados com "Aplicar desconto"
  // (baseDescontavel = subtotal dos ambientes descontáveis + parceria proporcional)
  const onPercChange = (v: number) => {
    setDescPerc(v);
    setDescValor(Number((baseDescontavel * (v / 100)).toFixed(2)));
  };
  const onValorChange = (v: number) => {
    setDescValor(v);
    setDescPerc(baseDescontavel > 0 ? Number(((v / baseDescontavel) * 100).toFixed(2)) : 0);
  };
  // Recalcula valores de desconto quando a base descontável mudar
  // (ex.: usuário marcou/desmarcou "Desconto" em algum ambiente)
  useEffect(() => {
    if (descPerc > 0) {
      setDescValor(Number((baseDescontavel * (descPerc / 100)).toFixed(2)));
    }
    if (descPercAplicado > 0) {
      setDescValorAplicado(Number((baseDescontavel * (descPercAplicado / 100)).toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDescontavel]);

  const acimaDoLimite = descPerc > meuLimite + 0.001;

  const registrarAprovacao = async (adminEmail: string, percUsado: number, valorUsado: number) => {
    if (!id) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("aprovacoes_desconto").insert({
      orcamento_id: id,
      solicitante_id: u?.user?.id ?? null,
      aprovador_email: adminEmail || null,
      desconto_perc: percUsado,
      desconto_valor: valorUsado,
      limite_solicitante: meuLimite,
      observacao: `Aprovação concedida via senha de gestor`,
    });
  };

  const aplicarDesconto = () => {
    if (descPerc <= meuLimite + 0.001 || autorizadoPorGestor) {
      setDescPercAplicado(descPerc);
      setDescValorAplicado(descValor);
      toast.success("Desconto aplicado");
      return;
    }
    setMotivoDesc("");
    setOpenSolicitarDesc(true);
  };
  const cancelarDesconto = () => {
    setDescPerc(0); setDescValor(0);
    setDescPercAplicado(0); setDescValorAplicado(0);
    setAutorizadoPorGestor(false);
    setAprovadorEmail("");
  };

  // helper: distribui valor restante igualmente nas parcelas seguintes (NÃO travadas)
  const recalcParcelas = (det: number[], total: number, idxAlterado: number, locked: boolean[]): number[] => {
    const n = det.length;
    if (n <= 1) return [total];
    const novo = [...det];
    // somas das parcelas fixadas (até idxAlterado) e das travadas após
    const somaFixas = novo.slice(0, idxAlterado + 1).reduce((s, v) => s + (Number(v) || 0), 0);
    const idxsRedist: number[] = [];
    let somaTravadasDepois = 0;
    for (let i = idxAlterado + 1; i < n; i++) {
      if (locked[i]) somaTravadasDepois += Number(novo[i]) || 0;
      else idxsRedist.push(i);
    }
    if (idxsRedist.length === 0) {
      // só ajusta a última pra fechar o total
      const soma = novo.reduce((s, v) => s + (Number(v) || 0), 0);
      novo[n - 1] = Number((Number(novo[n - 1]) + (total - soma)).toFixed(2));
      return novo;
    }
    const restoTotal = total - somaFixas - somaTravadasDepois;
    const valorEach = Number((restoTotal / idxsRedist.length).toFixed(2));
    idxsRedist.forEach((i) => (novo[i] = valorEach));
    // ajusta o último redistribuído para fechar arredondamento
    const soma = novo.reduce((s, v) => s + (Number(v) || 0), 0);
    const ultimo = idxsRedist[idxsRedist.length - 1];
    novo[ultimo] = Number((Number(novo[ultimo]) + (total - soma)).toFixed(2));
    return novo;
  };

  const addDays = (iso: string | null, days: number): string | null => {
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const ensureArrays = (p: Pagamento) => {
    const n = p.parcelas;
    const det = (p.parcelas_detalhe && p.parcelas_detalhe.length === n)
      ? [...p.parcelas_detalhe]
      : (() => {
          const base = Number((p.valor / n).toFixed(2));
          const arr = Array(n).fill(base);
          arr[n - 1] = Number((p.valor - base * (n - 1)).toFixed(2));
          return arr;
        })();
    const vencs: (string | null)[] = (p.parcelas_vencimentos && p.parcelas_vencimentos.length === n)
      ? [...p.parcelas_vencimentos]
      : Array.from({ length: n }, (_, i) => addDays(p.data_vencimento || new Date().toISOString().slice(0, 10), i * 30));
    const met = metodos.find((m) => m.nome === p.metodo);
    const formaCfgRaw = met?.parcelas_config?.find((c) => Number(c.numero) === Number(n))?.forma_pagamento;
    const formaCfg = Array.isArray(formaCfgRaw) ? formaCfgRaw[0] : formaCfgRaw;
    const formaDefault = formaCfg || "Boleto";
    const formas: string[] = (p.parcelas_formas && p.parcelas_formas.length === n)
      ? [...p.parcelas_formas]
      : Array(n).fill(formaDefault);
    const locked: boolean[] = (p.parcelas_locked && p.parcelas_locked.length === n)
      ? [...p.parcelas_locked]
      : Array(n).fill(false);
    const confirmadas: boolean[] = (p.parcelas_confirmadas && p.parcelas_confirmadas.length === n)
      ? [...p.parcelas_confirmadas]
      : Array(n).fill(false);
    return { det, vencs, formas, locked, confirmadas };
  };

  // Mantido para compat (renderização legada)
  const ensureDetalhe = (p: Pagamento): number[] => ensureArrays(p).det;

  // Confirmação de cascata +30d
  const [askCascade, setAskCascade] = useState<{ idxPag: number; idxParc: number } | null>(null);

  // Estado de minimização de cada card de pagamento
  // Apenas um card de pagamento expandido por vez (null = todos minimizados).
  const [expandedPagIdx, setExpandedPagIdx] = useState<number | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const toggleMinimizar = (idx: number) =>
    setExpandedPagIdx((cur) => (cur === idx ? null : idx));

  // Click-outside: recolhe o card expandido quando o usuário clica fora dele.
  // Ignora cliques em portais do Radix (Select/Tooltip/Popover) e do datepicker nativo.
  useEffect(() => {
    if (expandedPagIdx === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (expandedCardRef.current && expandedCardRef.current.contains(target)) return;
      // Cliques dentro de portais do Radix (Select/Popover/Tooltip) não recolhem o card.
      if (target.closest('[data-radix-popper-content-wrapper]')) return;
      if (target.closest('[role="listbox"]')) return;
      if (target.closest('[role="dialog"]')) return;
      setExpandedPagIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedPagIdx]);


  const editarParcelaValor = (idxPag: number, idxParc: number, novoValor: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      const novo = Number(novoValor) || 0;
      // Para pagamentos de 1 parcela (ex.: entrada), editar o valor da parcela atualiza o p.valor.
      if (Number(p.parcelas) === 1) {
        det[0] = novo;
        return { ...p, valor: novo, parcelas_detalhe: [novo], parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
      }
      det[idxParc] = novo;
      const recalc = recalcParcelas(det, p.valor, idxParc, locked);
      return { ...p, parcelas_detalhe: recalc, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
  };

  const editarParcelaVenc = (idxPag: number, idxParc: number, novaData: string) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      vencs[idxParc] = novaData || null;
      confirmadas[idxParc] = true;
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
    // pergunta sobre cascata de +30 dias nas próximas
    if (idxParc < (pagamentos[idxPag]?.parcelas ?? 0) - 1) {
      setAskCascade({ idxPag, idxParc });
    }
  };

  const confirmarParcelaVenc = (idxPag: number, idxParc: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      if (confirmadas[idxParc]) return p;
      confirmadas[idxParc] = true;
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
  };

  const editarParcelaForma = (idxPag: number, idxParc: number, novaForma: string) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      formas[idxParc] = novaForma;
      // Para entrada (1 parcela), a forma escolhida define também o método do pagamento,
      // o que reflete no rótulo do card e no cálculo do desconto adicional da entrada.
      const isEntrada = !!(p as any).is_entrada;
      const novoMetodoPag = isEntrada ? novaForma : p.metodo;
      return { ...p, metodo: novoMetodoPag, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
  };

  const toggleLockParcela = (idxPag: number, idxParc: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      locked[idxParc] = !locked[idxParc];
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
  };

  const aplicarCascataVenc = (idxPag: number, idxParc: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
      const base = vencs[idxParc];
      for (let k = idxParc + 1; k < vencs.length; k++) {
        if (!locked[k]) {
          vencs[k] = addDays(base, (k - idxParc) * 30);
          confirmadas[k] = true;
        }
      }
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked, parcelas_confirmadas: confirmadas };
    }));
  };


  const removePagamento = (idx: number) =>
    setPagamentos((p) => p.filter((_, i) => i !== idx));

  /**
   * Reseta tudo que depende do método/parcelamento anterior.
   * Chamado ao trocar Método de Pagamento ou Nº de Parcelas.
   */
  const resetPagamentosEEntrada = () => {
    setPagamentos([]);            // limpa principal, entradas e qualquer pagamento residual
    setEntrada(0);
    setEntradaCfgId("");
    // Limpa também o desconto manual aplicado e os campos do bloco "Aplicar desconto"
    setDescPerc(0);
    setDescValor(0);
    setDescPercAplicado(0);
    setDescValorAplicado(0);
    setAutorizadoPorGestor(false);
    setAprovadorEmail("");
  };

  const temDadosPagamento = () =>
    pagamentos.length > 0 ||
    (entrada || 0) > 0 ||
    (descPercAplicado || 0) > 0 ||
    (descValorAplicado || 0) > 0;

  const trocarMetodo = (novoMet: string, novasParc = 0) => {
    if (temDadosPagamento()) {
      setConfirmTrocaMetodo({ metodo: novoMet, parcelas: novasParc });
      return;
    }
    resetPagamentosEEntrada();
    setNovoMetodo(novoMet);
    setNovoParcelas(novasParc);
  };

  const trocarParcelas = (novasParc: number) => {
    if (novasParc === novoParcelas) return;
    if (temDadosPagamento()) {
      setConfirmTrocaMetodo({ metodo: novoMetodo, parcelas: novasParc });
      return;
    }
    resetPagamentosEEntrada();
    setNovoParcelas(novasParc);
  };

  const confirmarTrocaMetodo = () => {
    if (!confirmTrocaMetodo) return;
    resetPagamentosEEntrada();
    setNovoMetodo(confirmTrocaMetodo.metodo);
    setNovoParcelas(confirmTrocaMetodo.parcelas);
    setConfirmTrocaMetodo(null);
  };

  const somaEntradas = useMemo(
    () => pagamentos.filter((p: any) => p.is_entrada).reduce((s, p) => s + (p.valor || 0), 0),
    [pagamentos],
  );

  const aplicarEntrada = () => {
    if (!entrada || entrada <= 0) return toast.error("Informe o valor da entrada");
    const cfgEnt = entradaCfgSelecionada;
    if (!cfgEnt?.forma_pagamento) {
      return toast.error("Selecione um Tipo de Entrada cadastrado em Formas de Pagamento > Entrada");
    }
    setPagamentos((prev) => {
      const hoje = new Date().toISOString().slice(0, 10);
      return [
        ...prev,
        { metodo: cfgEnt.forma_pagamento, valor: entrada, parcelas: 1, data_vencimento: novoVenc || hoje, parcelas_detalhe: null, is_entrada: true } as any,
      ];
    });
    setEntrada(0);
    toast.success("Entrada adicionada");
  };

  // Adiciona um card de entrada vazio (R$ 0,00) na seção DESCRIÇÃO DE PAGAMENTO.
  // A forma da entrada é escolhida diretamente na parcela (campo Forma prevista).
  const adicionarEntradaCard = () => {
    const cfgEnt = entradasCfg[0];
    if (!cfgEnt?.forma_pagamento) {
      return toast.error("Nenhuma forma de entrada ativa cadastrada.");
    }
    const valor = Number(entrada) || 0;
    if (valor <= 0) {
      return toast.error("Informe o valor da entrada antes de adicionar.");
    }
    const hoje = new Date().toISOString().slice(0, 10);
    setPagamentos((prev) => [
      ...prev,
      {
        metodo: cfgEnt.forma_pagamento,
        valor,
        parcelas: 1,
        data_vencimento: novoVenc || hoje,
        parcelas_detalhe: null,
        is_entrada: true,
      } as any,
    ]);
    setEntrada(0);
    toast.success("Entrada adicionada.");
  };


  // Sincroniza o pagamento principal automaticamente ao mudar método/parcelas/vencimento.
  // O valor é sempre o restante a parcelar (total - soma das entradas).
  useEffect(() => {
    if (!novoMetodo || !novoParcelas || novoParcelas < 1) {
      setPagamentos((prev) => prev.filter((p) => !(p as any).is_principal));
      return;
    }
    const valorPrincipal = Number(Math.max(0, totalProposta - somaEntradas).toFixed(2));
    setPagamentos((prev) => {
      const outros = prev.filter((p) => !(p as any).is_principal);
      if (valorPrincipal <= 0) return outros;
      return [
        ...outros,
        {
          metodo: novoMetodo,
          valor: valorPrincipal,
          parcelas: novoParcelas || 1,
          data_vencimento: novoVenc || null,
          parcelas_detalhe: null,
          is_principal: true,
        } as any,
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoMetodo, novoParcelas, novoVenc, totalProposta, somaEntradas]);

  /* ------------------------- save ------------------------- */
  const persist = async (newStatus?: string) => {
    if (!id) return;
    setSaving(true);
    const updates: any = {
      desconto_perc: descPercAplicado,
      desconto_valor: descValorAplicado,
      // total do contrato já com juros repassados (loja absorvendo não acresce).
      total: totalContrato,
    };
    if (newStatus) updates.status = newStatus;

    const { error: e1 } = await supabase.from("orcamentos").update(updates).eq("id", id);
    if (e1) { setSaving(false); return toast.error(e1.message); }

    await supabase.from("pagamentos_orcamento").delete().eq("orcamento_id", id);
    if (pagamentos.length > 0) {
      const { error: e2 } = await supabase.from("pagamentos_orcamento").insert(
        pagamentos.map((p) => {
          // Garante que parcelas_detalhe/vencimentos/formas sejam sempre persistidos,
          // mesmo quando o usuário não abrir o editor de parcelas.
          const { det, vencs, formas } = ensureArrays(p);
          // Se método repassa juros ao cliente, acresce o percentual no valor final
          // do pagamento e escala parcelas_detalhe proporcionalmente. Se absorve,
          // mantém o valor base (o juros entra como juros_previsto no financeiro).
          const j = calcJurosDoPagamento(p);
          const fator = j.repassar && Number(p.valor) > 0
            ? (Number(p.valor) + j.valor) / Number(p.valor)
            : 1;
          const valorFinal = Number((Number(p.valor) * fator).toFixed(2));
          const detFinal = det.map((v) => Number((Number(v) * fator).toFixed(2)));
          // Ajuste de arredondamento na última parcela
          if (detFinal.length > 0) {
            const soma = detFinal.reduce((s, v) => s + v, 0);
            const diff = Number((valorFinal - soma).toFixed(2));
            if (Math.abs(diff) >= 0.01) detFinal[detFinal.length - 1] = Number((detFinal[detFinal.length - 1] + diff).toFixed(2));
          }
          return {
            orcamento_id: id,
            metodo: p.metodo,
            valor: valorFinal,
            parcelas: p.parcelas,
            data_vencimento: p.data_vencimento || vencs[0] || null,
            parcelas_detalhe: detFinal,
            parcelas_vencimentos: vencs,
            parcelas_formas: formas,
          };
        }) as any,
      );
      if (e2) { setSaving(false); return toast.error(e2.message); }
    }

    // ----- Histórico/versão de negociação -----
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: ultima } = await supabase
        .from("orcamento_negociacoes" as any)
        .select("versao,status,valor_final_negociado,saldo_a_parcelar")
        .eq("orcamento_id", id)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ultimaAtiva = (ultima as any) && (ultima as any).status === "ativa" ? (ultima as any) : null;
      const proximaVersao = ((ultima as any)?.versao || 0) + (ultimaAtiva ? 1 : 1);

      // marca anterior como substituida (se existir uma ativa)
      if (ultimaAtiva) {
        await supabase
          .from("orcamento_negociacoes" as any)
          .update({ status: "substituida" })
          .eq("orcamento_id", id)
          .eq("status", "ativa");
      }

      const principal = pagamentos.find((p: any) => p?.is_principal) || pagamentos[0];
      const qtdParc = Number((principal as any)?.parcelas) || 1;
      const valorParcela = qtdParc > 0 ? Number((saldoAParcelar / qtdParc).toFixed(2)) : 0;

      await supabase.from("orcamento_negociacoes" as any).insert({
        orcamento_id: id,
        versao: proximaVersao,
        status: "ativa",
        valor_bruto: Number(valorInicial.toFixed(2)),
        percentual_desconto_manual: Number(descPercAplicado || 0),
        valor_desconto_manual: Number(descValorAplicado || 0),
        forma_pagamento_id: (principal as any)?.metodo_id || null,
        percentual_desconto_forma_pagamento: Number(descontoMetodoPerc || 0),
        valor_desconto_forma_pagamento: Number(descontoMetodoValor || 0),
        valor_apos_desconto_forma_pagamento: Number(subtotalAposFormaPag.toFixed(2)),
        valor_entrada: Number(totalEntrada || 0),
        forma_pagamento_entrada_id: (entradaCfgSelecionada as any)?.id || null,
        percentual_desconto_entrada: Number(descontoEntradaPerc || 0),
        valor_desconto_entrada: Number(descontoEntradaValor || 0),
        valor_final_negociado: Number(totalProposta.toFixed(2)),
        saldo_a_parcelar: Number(saldoAParcelar.toFixed(2)),
        quantidade_parcelas: qtdParc,
        valor_parcela: valorParcela,
        criado_por: u.user?.id || null,
      });
    } catch (e) {
      console.error("Erro ao gravar histórico de negociação", e);
    }

    setSaving(false);
    return true;
  };


  /* ----------- valida cliente antes de imprimir ou salvar ----------- */
  const camposFaltando = useMemo(() => {
    if (!cliente) return [];
    return camposObrigatorios
      .filter(({ key }) => !cliente[key] || String(cliente[key]).trim() === "")
      .map((c) => c.label);
  }, [cliente]);

  const trySalvar = async () => {
    if (camposFaltando.length > 0) {
      setActionAfterValidate("save");
      setOpenValidar(true);
      return;
    }
    const ok = await persist();
    if (ok) toast.success("Orçamento atualizado");
  };

  /**
   * Verifica se todas as parcelas/entradas tiveram a data de vencimento
   * conferida pelo usuário (clique/edit do input ou botão de confirmação).
   * Se houver pendência: expande o card, mostra toast e devolve false.
   */
  const validarVencimentosConfirmados = (): boolean => {
    // Configuração por loja: quando inativa, não bloqueia nenhuma ação.
    if (!config?.obrigar_informar_vencimento) return true;

    const pendentes: { idxPag: number; total: number }[] = [];
    pagamentos.forEach((p, idxPag) => {
      const { confirmadas } = ensureArrays(p);
      const naoConf = confirmadas.filter((c) => !c).length;
      if (naoConf > 0) pendentes.push({ idxPag, total: naoConf });
    });
    if (pendentes.length === 0) return true;

    // expande o primeiro card pendente para o usuário ver
    const primeiro = pendentes[0].idxPag;
    setExpandedPagIdx(primeiro);

    const totalParc = pendentes.reduce((s, x) => s + x.total, 0);
    if (totalParc > 1) {
      toast.error("Existem parcelas com vencimento não confirmado. Selecione as datas de vencimento e tente novamente.");
    } else {
      toast.error("Selecione a data de vencimento da parcela e tente novamente.");
    }
    return false;
  };


  const tryImprimir = () => {
    if (pagamentos.length === 0) {
      return toast.error("Configure pelo menos um método de pagamento antes de imprimir o orçamento.");
    }
    if (!validarVencimentosConfirmados()) return;
    if (camposFaltando.length > 0) {
      setActionAfterValidate("print");
      setOpenValidar(true);
      return;
    }
    gerarProposta();
  };

  const confirmar = async () => {
    if (Math.abs(restante) > 0.01)
      return toast.error("Total dos pagamentos não bate com o valor da proposta");
    if (!validarVencimentosConfirmados()) return;
    if (camposFaltando.length > 0) {
      setActionAfterValidate("confirmar");
      setOpenValidar(true);
      return;
    }
    setOpenConfirmar(true);
  };


  const gerarContrato = async (observacoes: string, previsaoMedicao: string | null) => {
    if (!orc || !id) return;
    setConfirmando(true);
    // garante que orçamento está atualizado e marcado como aprovado
    const ok = await persist("aprovado");
    if (!ok) { setConfirmando(false); return; }

    // Buscar dados da loja para empresa
    let empresa = { nome: "Alavanch", cnpj: "", endereco: "", telefone: "" };
    if (orc.loja_id) {
      const { data: loja } = await supabase.from("lojas").select("nome, cnpj, endereco, telefone").eq("id", orc.loja_id).maybeSingle();
      if (loja) empresa = { nome: loja.nome, cnpj: loja.cnpj || "", endereco: loja.endereco || "", telefone: loja.telefone || "" };
    }

    // Gera número de contrato no formato 133/2026
    const ano = new Date().getFullYear();
    const { count } = await supabase.from("contratos").select("id", { count: "exact", head: true });
    const numero = `${String((count ?? 0) + 1).padStart(3, "0")}/${ano}`;

    // Se este orçamento é um Complemento, busca o pedido de origem para referenciar no contrato
    let pedidoOrigemComp: { codigo: string } | null = null;
    if ((orc as any).is_complemento && (orc as any).pedido_origem_complemento_id) {
      const { data: po } = await supabase.from("pedidos").select("codigo").eq("id", (orc as any).pedido_origem_complemento_id).maybeSingle();
      pedidoOrigemComp = po as any;
    }
    const obsFinal = pedidoOrigemComp
      ? `Complemento ao pedido ${pedidoOrigemComp.codigo} — refere-se ao mesmo ambiente.\n\n${observacoes || ""}`.trim()
      : observacoes;

    // Snapshot dos ambientes com preços com desconto (proporcional ao total do contrato)
    const ambientesSnap = ambientes.map((a) => {
      const precoBase = Number(a.preco_sugerido) || 0;
      const fator = subtotalAmbientes > 0 ? precoBase / subtotalAmbientes : 0;
      return {
        nome: a.nome,
        descricao: a.descricao,
        preco_base: precoBase,
        preco_final: totalContrato * fator,
      };
    });

    // Pagamentos do snapshot já com juros repassado embutido no valor
    const pagamentosSnap = pagamentos.map((p) => {
      const j = calcJurosDoPagamento(p);
      const fator = j.repassar && Number(p.valor) > 0
        ? (Number(p.valor) + j.valor) / Number(p.valor)
        : 1;
      return {
        ...p,
        valor: Number((Number(p.valor) * fator).toFixed(2)),
        acrescimo_repassado: j.repassar ? Number(j.valor.toFixed(2)) : 0,
        juros_perc_aplicado: j.repassar ? j.jurosPerc : 0,
      };
    });

    // Cria contrato
    const { data: created, error: e1 } = await supabase
      .from("contratos")
      .insert({
        numero,
        orcamento_id: id,
        cliente_id: orc.cliente_id,
        loja_id: orc.loja_id,
        template_id: tplContrato?.id,
        observacoes_adicionais: obsFinal,
        valor_total: totalContrato,
        conteudo_snapshot: {
          numero,
          emitido_em: new Date().toISOString(),
          empresa,
          cliente,
          ambientes: ambientesSnap,
          subtotal: subtotalAmbientes,
          desconto_perc: descPercAplicado,
          desconto_valor: descValorAplicado,
          total: totalContrato,
          total_sem_juros: totalProposta,
          juros_repassado: Number(jurosRepassado.toFixed(2)),
          juros_absorvido: Number(jurosAbsorvido.toFixed(2)),
          pagamentos: pagamentosSnap,
          observacoes_adicionais: obsFinal,
          pedido_origem_codigo: pedidoOrigemComp?.codigo || null,
        } as any,
      })
      .select("id, signing_token, numero")
      .single();

    setConfirmando(false);
    if (e1 || !created) { toast.error(e1?.message || "Erro ao criar contrato"); return; }

    // Atualiza signing_url no snapshot
    const signing_url = getLegacyPublicContractUrl(created.signing_token);
    await supabase.from("contratos").update({
      conteudo_snapshot: {
        ...(((await supabase.from("contratos").select("conteudo_snapshot").eq("id", created.id).single()).data?.conteudo_snapshot) as any),
        signing_url,
      } as any,
    }).eq("id", created.id);

    // Marca orçamento como confirmado e converte
    await supabase.from("orcamentos").update({
      status: "convertido",
      confirmado_em: new Date().toISOString(),
    }).eq("id", id);

    setOpenConfirmar(false);
    // Atualiza o pedido (criado pelo trigger, ou já existente se foi cancelado antes)
    const { data: { user } } = await supabase.auth.getUser();
    setTimeout(async () => {
      const { data: ped } = await supabase.from("pedidos").select("id,status,codigo").eq("orcamento_id", id).maybeSingle();
      if (ped?.id) {
        // Alinha o número do contrato ao código do pedido
        if (ped.codigo && ped.codigo !== created.numero) {
          // Renomeia contratos antigos (cancelados) que já carregam esse código
          const { data: antigos } = await supabase
            .from("contratos")
            .select("id,numero")
            .eq("numero", ped.codigo)
            .neq("id", created.id);
          for (const a of antigos || []) {
            await supabase.from("contratos").update({
              numero: `${a.numero}-CANC-${a.id.slice(0, 6)}`,
            }).eq("id", a.id);
          }
          const { data: snapAtual } = await supabase.from("contratos").select("conteudo_snapshot").eq("id", created.id).single();
          const snap = (snapAtual?.conteudo_snapshot as any) || {};
          await supabase.from("contratos").update({
            numero: ped.codigo,
            conteudo_snapshot: { ...snap, numero: ped.codigo } as any,
          }).eq("id", created.id);
          created.numero = ped.codigo;
        }
        toast.success(`Contrato ${created.numero} gerado! Venda criada automaticamente.`);
      } else {
        toast.success(`Contrato ${created.numero} gerado! Venda criada automaticamente.`);
      }
      if (ped?.id) {


        const patch: any = {
          observacoes_venda: observacoes || null,
          estagio_responsavel_id: user?.id || null,
        };
        // Se o pedido estava cancelado (re-negociação), reativa
        if (ped.status === "cancelado") patch.status = "em_producao";
        if (previsaoMedicao) {
          patch.previsao_medicao = previsaoMedicao;
          patch.observacoes_venda = `${observacoes ? observacoes + "\n\n" : ""}Previsão de medição informada na venda: ${new Date(previsaoMedicao).toLocaleDateString("pt-BR")}`;
        }
        await supabase.from("pedidos").update(patch).eq("id", ped.id);
        // Dispara gatilhos de criação automática de cards nos kanbans operacionais
        await dispatchKanbanTrigger("contrato_criado", { pedidoId: ped.id, orcamentoId: id, responsavelId: user?.id ?? null });

        // === Gera nova solicitação de assinatura para o contrato recém-criado ===
        try {
          // Cancela solicitações antigas vinculadas a contratos cancelados/anteriores
          await supabase
            .from("solicitacoes_assinatura")
            .update({ status: "cancelado" })
            .eq("pedido_id", ped.id)
            .neq("contrato_id", created.id)
            .in("status", ["aguardando_cliente", "aguardando_loja", "rascunho"]);

          const { data: tipoContrato } = await supabase
            .from("tipos_documento").select("id").eq("slug", "contrato").maybeSingle();
          if (tipoContrato?.id) {
            const expira = new Date();
            expira.setDate(expira.getDate() + 30);
            const { data: novaSolic } = await supabase
              .from("solicitacoes_assinatura")
              .insert({
                pedido_id: ped.id,
                tipo_documento_id: tipoContrato.id,
                cliente_id: orc.cliente_id,
                loja_id: orc.loja_id,
                contrato_id: created.id,
                observacao: `Contrato ${created.numero} gerado automaticamente`,
                expira_em: expira.toISOString(),
                status: "aguardando_loja",
              } as any)
              .select("id")
              .single();
            if (novaSolic?.id) {
              await supabase.from("assinatura_participantes").insert({
                solicitacao_id: novaSolic.id,
                tipo: "cliente",
                nome: cliente?.nome || null,
                email: cliente?.email || null,
                telefone: cliente?.telefone || null,
                status: "pendente",
              } as any);
              await supabase.from("assinatura_eventos").insert({
                solicitacao_id: novaSolic.id,
                tipo_evento: "solicitacao_criada",
                status_novo: "aguardando_loja",
                descricao: `Solicitação criada automaticamente para o contrato ${created.numero}`,
              } as any);
              // Gera o documento HTML sem marcar a loja como assinada automaticamente.
              await prepararContratoParaAssinatura(novaSolic.id).catch(() => null);
            }
          }
        } catch (sErr) {
          console.warn("Falha ao criar solicitação de assinatura automática:", sErr);
        }

        navigate(`/pedidos/${ped.id}`);
      } else {
        navigate(`/contratos/${created.id}`);
      }
    }, 600);
  };

  /* ------------------------- gerar proposta (HTML print) ------------------------- */
  const gerarProposta = async () => {
    if (!orc) return;

    // Carrega template ativo da loja
    let tplOrc: any = null;
    if (orc.loja_id) {
      const { data } = await (supabase as any)
        .from("orcamento_templates")
        .select("*")
        .eq("loja_id", orc.loja_id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tplOrc = data || null;
    }
    const cfg = {
      titulo: tplOrc?.titulo || "PROPOSTA COMERCIAL",
      subtitulo: tplOrc?.subtitulo || "",
      mostrar_logo: tplOrc?.mostrar_logo ?? true,
      mostrar_dados_empresa: tplOrc?.mostrar_dados_empresa ?? true,
      mostrar_dados_cliente: tplOrc?.mostrar_dados_cliente ?? true,
      mostrar_descricao_ambientes: tplOrc?.mostrar_descricao_ambientes ?? false,
      mostrar_itens_tecnicos: tplOrc?.mostrar_itens_tecnicos ?? false,
      mostrar_resumo_descontos: tplOrc?.mostrar_resumo_descontos ?? true,
      mostrar_forma_pagamento: tplOrc?.mostrar_forma_pagamento ?? true,
      mostrar_condicoes_gerais: tplOrc?.mostrar_condicoes_gerais ?? true,
      condicoes_gerais_html: tplOrc?.condicoes_gerais_html || "",
      rodape_html: tplOrc?.rodape_html || "",
      // Gatilhos
      mostrar_gatilhos_venda: !!tplOrc?.mostrar_gatilhos_venda,
      mostrar_gatilhos_na_impressao: !!tplOrc?.mostrar_gatilhos_na_impressao,
      gatilhos_tpl: tplOrc as GatilhosTemplate | null,
    };

    const exibirGatilhos = !!cfg.mostrar_gatilhos_venda && !!cfg.mostrar_gatilhos_na_impressao && !!cfg.gatilhos_tpl;
    const gValidade = exibirGatilhos ? calcularValidade(cfg.gatilhos_tpl!) : null;
    const gCtx = {
      cliente_nome: (orc.cliente as any)?.nome,
      numero_orcamento: (orc as any)?.codigo,
      nome_projeto: (orc as any)?.nome_projeto,
      valor_total: totalProposta,
      desconto_total: Math.max(0, valorInicial - totalProposta),
    };
    const gSugestao = exibirGatilhos ? resolverTexto(cfg.gatilhos_tpl!.sugestao_texto_fechamento || "", cfg.gatilhos_tpl!, gCtx, gValidade) : "";

    // Dados de empresa (loja + branding)
    let empresa: any = { nome: "Alavanch", cnpj: "", endereco: "", telefone: "", email: "", logo_url: "" };
    if (orc.loja_id) {
      const { data: loja } = await supabase
        .from("lojas")
        .select("nome, cnpj, endereco, telefone, email")
        .eq("id", orc.loja_id)
        .maybeSingle();
      if (loja) empresa = { ...empresa, ...loja };
      const { data: brand } = await (supabase as any)
        .from("configuracoes_empresa")
        .select("nome_empresa, nome_fantasia, logo_url")
        .eq("loja_id", orc.loja_id)
        .maybeSingle();
      if (brand) {
        empresa.nome = brand.nome_fantasia || brand.nome_empresa || empresa.nome;
        empresa.logo_url = brand.logo_url || "";
      }
    }

    // Limpa o nome do método de pagamento removendo faixas de parcelamento
    const formatarModalidadePagamento = (nome: string) => {
      if (!nome) return "—";
      return String(nome)
        .replace(/\s*\d+\s*x\s*a\s*\d+\s*x\s*/gi, " ")
        .replace(/\s*\(\s*\d+x\s*a\s*\d+x\s*\)\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    };

    const itensPorAmb = ambientes.map((a) => ({
      amb: a, items: itens.filter((it) => it.ambiente_id === a.id),
    }));

    const descTotal = (descValorAplicado || 0) + (descontoMetodoValor || 0) + (descontoEntradaValor || 0);
    const descTotalPerc = valorInicial > 0 ? (descTotal / valorInicial) * 100 : 0;

    const escapeHtml = (s: string) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Proposta ${orc.codigo}</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color:#1a1a1a; font-size:13px; line-height:1.4; }
      h1 { font-size:22px; margin:0 0 4px; }
      h2 { font-size:14px; margin:18px 0 6px; padding-bottom:4px; border-bottom:1px solid #ddd; color:#1F5235; text-transform:uppercase; letter-spacing:.5px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #1F5235; margin-bottom:18px; gap:16px; }
      .header .logo img { max-height:64px; max-width:200px; object-fit:contain; }
      .muted { color:#6B6760; font-size:11px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th, td { padding:6px 8px; text-align:left; font-size:12px; border-bottom:1px solid #eee; }
      th { background:#F4F6FA; text-transform:uppercase; font-size:10px; letter-spacing:.5px; }
      .right { text-align:right; }
      .totais { margin-top:18px; padding:14px; background:#F4F6FA; border-radius:8px; }
      .totais .row { display:flex; justify-content:space-between; padding:4px 0; }
      .totais .total { font-size:18px; font-weight:600; border-top:1px solid #ccc; padding-top:8px; margin-top:8px; color:#1F5235; }
      .box { border:1px solid #e5e5e5; border-radius:8px; padding:10px; }
      .box .label { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#6B6760; margin-bottom:2px; }
      .pag { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #eee; font-size:12px; }
      .footer { margin-top:32px; font-size:11px; color:#6B6760; border-top:1px solid #eee; padding-top:10px; }
      .sig { margin-top:48px; display:flex; justify-content:space-between; gap:40px; }
      .sig div { flex:1; border-top:1px solid #333; padding-top:6px; text-align:center; font-size:11px; }
      .cond { font-size:12px; color:#333; }
      .cond p { margin: 4px 0; }
    </style></head><body>
    <div class="header">
      <div style="flex:1; display:flex; align-items:center; gap:14px;">
        ${cfg.mostrar_logo && empresa.logo_url ? `<div class="logo"><img src="${escapeHtml(empresa.logo_url)}" alt="logo"/></div>` : ""}
        <div>
          <h1>${escapeHtml(cfg.titulo)}</h1>
          ${cfg.subtitulo ? `<div class="muted">${escapeHtml(cfg.subtitulo)}</div>` : ""}
          <div class="muted">Nº ${orc.codigo} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
          <div class="muted">Projeto: <b>${escapeHtml(orc.nome_projeto || "—")}</b></div>
        </div>
      </div>
      ${cfg.mostrar_dados_empresa ? `<div style="text-align:right; min-width:220px;">
        <div style="font-weight:600">${escapeHtml(empresa.nome)}</div>
        ${empresa.cnpj ? `<div class="muted">CNPJ: ${escapeHtml(empresa.cnpj)}</div>` : ""}
        ${empresa.endereco ? `<div class="muted">${escapeHtml(empresa.endereco)}</div>` : ""}
        ${empresa.telefone ? `<div class="muted">Tel: ${escapeHtml(empresa.telefone)}</div>` : ""}
        ${empresa.email ? `<div class="muted">${escapeHtml(empresa.email)}</div>` : ""}
      </div>` : ""}
    </div>

    ${cfg.mostrar_dados_cliente ? `<div class="box">
      <div class="label">Cliente</div>
      <div><b>${escapeHtml(cliente?.nome || "—")}</b></div>
      <div class="muted">${escapeHtml(cliente?.cpf_cnpj || "")}</div>
      <div class="muted">${escapeHtml(cliente?.email || "")} ${cliente?.telefone ? "· " + escapeHtml(cliente.telefone) : ""}</div>
      <div class="muted">${escapeHtml(cliente?.endereco_cobranca || "")}</div>
    </div>` : ""}

    <h2>Ambientes</h2>
    ${itensPorAmb.map(({ amb, items }) => `
      <div style="margin-bottom:14px">
        <div style="font-weight:600; font-size:13px;">${escapeHtml(amb.nome.toUpperCase())} — <span style="color:#1F5235">${fmtBrl(Number(amb.preco_sugerido) || 0)}</span></div>
        ${cfg.mostrar_descricao_ambientes && amb.descricao ? `<div class="muted" style="margin-bottom:4px">${escapeHtml(amb.descricao)}</div>` : ""}
        ${cfg.mostrar_itens_tecnicos && items.length ? `<table>
          <thead><tr><th>Descrição</th><th class="right">Qtd</th><th class="right">Unit.</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${items.map((it) => `<tr>
              <td>${escapeHtml(it.descricao || "—")}</td>
              <td class="right">${it.quantidade}</td>
              <td class="right">${fmtBrl(Number(it.custo_cliente) || 0)}</td>
              <td class="right">${fmtBrl((Number(it.custo_cliente) || 0) * (it.quantidade || 0))}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : ""}
      </div>
    `).join("")}

    ${cfg.mostrar_resumo_descontos ? `<div class="totais">
      <div class="row"><span>Subtotal</span><b>${fmtBrl(valorInicial)}</b></div>
      ${descValorAplicado > 0.01 ? `<div class="row" style="color:#7A2222"><span>Desconto aplicado</span><b>-${fmtBrl(descValorAplicado)}</b></div>` : ""}
      ${descontoMetodoValor > 0.01 ? `<div class="row" style="color:#7A2222"><span>Desconto forma de pagamento</span><b>-${fmtBrl(descontoMetodoValor)}</b></div>` : ""}
      ${descontoEntradaValor > 0.01 ? `<div class="row" style="color:#7A2222"><span>Desconto da entrada</span><b>-${fmtBrl(descontoEntradaValor)}</b></div>` : ""}
      ${descTotal > 0.01 ? `<div class="row" style="color:#1F5235; font-weight:600; border-top:1px dashed #ccc; padding-top:6px; margin-top:4px;"><span>Desconto Total (${descTotalPerc.toFixed(2)}%)</span><b>-${fmtBrl(descTotal)}</b></div>` : ""}
      ${jurosRepassado > 0.01 ? `<div class="row"><span>Juros repassado ao cliente</span><b>+${fmtBrl(jurosRepassado)}</b></div>` : ""}
      <div class="row total"><span>Total da Proposta</span><span>${fmtBrl(totalContrato)}</span></div>
    </div>` : ""}

    ${cfg.mostrar_forma_pagamento ? `<h2>Forma de Pagamento</h2>
    ${pagamentos.length ? (() => {
      const entradasPg = pagamentos.filter((p: any) => p.is_entrada);
      const parceladosPg = pagamentos.filter((p: any) => !p.is_entrada);
      const renderEntrada = (p: any) => {
        const nome = formatarModalidadePagamento(p.metodo);
        const venc = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString("pt-BR") : "";
        return `<div class="pag">
          <span><b>${escapeHtml(nome)}</b> · entrada${venc ? " · venc. " + venc : ""}</span>
          <b>${fmtBrl(Number(p.valor) || 0)}</b>
        </div>`;
      };
      const renderParc = (p: any) => {
        const j = calcJurosDoPagamento(p);
        const valorTotal = j.repassar && Number(p.valor) > 0 ? Number(p.valor) + j.valor : Number(p.valor);
        const nome = formatarModalidadePagamento(p.metodo);
        const n = Math.max(1, Number(p.parcelas) || 1);
        const det: number[] = Array.isArray(p.parcelas_detalhe) ? p.parcelas_detalhe : [];
        const vencs: (string | null)[] = Array.isArray(p.parcelas_vencimentos) ? p.parcelas_vencimentos : [];
        const valorParcela = det[0] && det[0] > 0 ? det[0] : valorTotal / n;
        const primVenc = vencs[0] || p.data_vencimento;
        const primVencStr = primVenc ? new Date(primVenc).toLocaleDateString("pt-BR") : "";
        const detalhesLinhas = (det.length === n && vencs.length === n) ? `
          <div class="muted" style="margin-top:4px; font-size:11px; padding-left:6px;">
            ${det.map((v, i) => {
              const vs = vencs[i] ? new Date(vencs[i] as string).toLocaleDateString("pt-BR") : "—";
              return `${i + 1}/${n} — venc. ${vs} — ${fmtBrl(Number(v) || 0)}`;
            }).join("<br/>")}
          </div>` : "";
        return `<div class="pag" style="flex-direction:column; align-items:stretch; gap:2px;">
          <div style="display:flex; justify-content:space-between;">
            <span><b>${escapeHtml(nome)}</b> · ${n}x · ${fmtBrl(valorParcela)}${primVencStr ? " · 1º venc. " + primVencStr : ""}</span>
            <b>Total ${fmtBrl(valorTotal)}</b>
          </div>
          ${n > 1 ? detalhesLinhas : ""}
        </div>`;
      };
      return entradasPg.map(renderEntrada).join("") + parceladosPg.map(renderParc).join("");
    })() : `<div class="muted">A definir</div>`}` : ""}

    ${exibirGatilhos ? (() => {
      const tplG = cfg.gatilhos_tpl!;
      const tituloPainel = (tplG.titulo_painel_fechamento && String(tplG.titulo_painel_fechamento).trim()) || "Painel de Fechamento";
      const contratosRest = Number(tplG.quantidade_contratos_restantes) || 0;
      const usarEscPrint = !!tplG.usar_gatilho_escassez && contratosRest > 0;
      const usarUrgPrint = !!tplG.usar_gatilho_urgencia && !!gValidade;
      if (!usarEscPrint && !usarUrgPrint) return "";
      const cardEsc = usarEscPrint ? `
        <div style="background:#FFF4D8;border:1px solid #D7B66B;border-radius:8px;padding:10px 12px;margin-top:8px">
          
          <div style="margin-top:2px"><span style="font-size:26px;font-weight:700;color:#B9872D;line-height:1">${contratosRest}</span>
            <span style="font-size:12px;color:#2A2A2A;margin-left:6px">contratos restantes</span></div>
          ${tplG.quantidade_contratos_total != null && Number(tplG.quantidade_contratos_total) > 0 ? `<div style="font-size:10.5px;color:#2A2A2A;opacity:0.7;margin-top:2px">de ${tplG.quantidade_contratos_total} disponíveis</div>` : ""}
        </div>` : "";
      const cardUrg = usarUrgPrint && gValidade ? `
        <div style="background:#F8E8EA;border:1px solid #D8A5AB;border-radius:8px;padding:10px 12px;margin-top:8px">
          
          <div style="margin-top:2px;font-size:20px;font-weight:700;color:#7A2833;line-height:1">${escapeHtml(tempoRestante(gValidade))}</div>
          <div style="font-size:10.5px;color:#2A2A2A;opacity:0.85;margin-top:3px">Proposta válida até ${escapeHtml(formatarValidade(gValidade))}${isVencida(gValidade) ? " (vencida)" : ""}</div>
        </div>` : "";
      const cardSug = gSugestao ? `
        <div style="background:#fff;border:1px solid #e4d9bf;border-radius:8px;padding:10px 12px;margin-top:8px;font-style:italic;font-size:12px;color:#2A2A2A">
          “${escapeHtml(gSugestao)}”
        </div>` : "";
      return `<h2>Condição Especial</h2>
      <div style="background:#faf6ec;border:1px solid #e4d9bf;border-radius:10px;padding:12px 14px">
        <div style="font-size:11px;letter-spacing:0.14em;color:#7c5a1e;font-weight:600;text-transform:uppercase">${escapeHtml(tituloPainel)}</div>
        ${cardEsc}${cardUrg}${cardSug}
      </div>`;
    })() : ""}

    ${cfg.mostrar_condicoes_gerais && cfg.condicoes_gerais_html ? `<h2>Condições Gerais</h2>
    <div class="cond">${cfg.condicoes_gerais_html}</div>` : ""}

    <div class="sig">
      <div>Cliente<br/><span class="muted">${escapeHtml(cliente?.nome || "")}</span></div>
      <div>Empresa<br/><span class="muted">${escapeHtml(empresa.nome)}</span></div>
    </div>

    <div class="footer">${cfg.rodape_html ? cfg.rodape_html + "<br/>" : ""}Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")}.</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return toast.error("Bloqueador de pop-up impediu a impressão");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 450);
  };

  /* ------------------------- cliente saved ------------------------- */
  const reloadCliente = async () => {
    if (!cliente?.id) return;
    const { data } = await supabase.from("clientes").select("*").eq("id", cliente.id).single();
    if (data) setCliente(data as ClienteRow);
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground text-[13px] animate-pulse">
        Carregando…
      </div>
    );
  }

  return (
    <div
      ref={negociacaoRef}
      className={
        "negociacao-fullscreen-container " +
        (isFullscreen
          ? "fixed inset-0 z-[60] w-screen h-screen overflow-auto bg-background p-4 sm:p-6 md:p-8"
          : "")
      }
    >
    <div className="grid grid-cols-12 gap-6">
      {/* ---------- LEFT ---------- */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              await sairTelaCheia();
              navigate(`/comercial/${id}`);
            }}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Orçamento
          </button>
          <button
            type="button"
            onClick={() => (isFullscreen ? sairTelaCheia() : entrarTelaCheia())}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#D0CCC8] bg-white text-[#1A1A1A] hover:bg-[#F7F6F4] transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>


        <div className="surface-card p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#EAF2FB", border: "1px solid #D6E4F5" }}>
              <Calculator className="w-6 h-6" style={{ color: "#3B6FB0" }} />
            </div>
            <div>
              <h1 className="text-[26px] font-semibold leading-none tracking-wide">AMBIENTES</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                {pedidoRef ? (
                  <>
                    Referente ao <b>{pedidoRef.tipo}</b> do pedido{" "}
                    <Link to={`/pedidos/${pedidoRef.id}`} className="font-semibold text-foreground underline hover:no-underline">
                      {pedidoRef.codigo}
                    </Link>
                  </>
                ) : (
                  <>Selecione os ambientes e defina a condição comercial</>
                )}
              </p>
            </div>
          </div>

          {pedidoRef && (
            <div className={`rounded-lg border-2 px-4 py-3 text-[13px] ${pedidoRef.tipo === "complemento" ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : "border-purple-200 bg-purple-50/60 text-purple-900"}`}>
              <div className="font-semibold uppercase tracking-wider text-[11px] mb-0.5">
                {pedidoRef.tipo === "complemento" ? "Complemento" : "Adendo"} do pedido{" "}
                <Link to={`/pedidos/${pedidoRef.id}`} className="underline hover:no-underline">{pedidoRef.codigo}</Link>
              </div>
              <div className="text-[12px] opacity-90">
                {pedidoRef.tipo === "complemento"
                  ? "Esta negociação refere-se ao complemento do pedido original. Complementos não geram agenda de medição — apenas notas e cronograma do pedido base."
                  : "Esta negociação refere-se a um adendo do pedido original — mesmo contrato, ajuste de valor."}
              </div>
            </div>
          )}

          {isAdendo ? (
            <div className={`border-2 rounded-lg px-4 py-4 ${adendoTipo === "pagar" ? "border-rose-200 bg-rose-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${adendoTipo === "pagar" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      Adendo {adendoTipo === "pagar" ? "a pagar (loja → cliente)" : "a receber (cliente → loja)"}
                    </span>
                  </div>
                  <div className="text-[15px] font-semibold uppercase tracking-tight mt-2">Descrição do adendo</div>
                  <div className="text-[13px] text-foreground whitespace-pre-wrap mt-1">
                    {(orc as any)?.adendo_descricao || "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor do adendo</div>
                  <div className={`text-[18px] font-semibold text-mono ${adendoTipo === "pagar" ? "text-rose-700" : "text-emerald-700"}`}>
                    {adendoTipo === "pagar" ? "-" : ""}{fmtBrl(adendoValor)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="space-y-2">
            {ambientes.map((a) => {
              const incluido = a.negociavel !== false;
              const recebeDesconto = a.aplicar_desconto !== false;
              const fatorIndicador = 1 + (parceiroPerc / 100);
              const precoBase = (Number(a.preco_sugerido) || 0) * fatorIndicador;
              const baseRateioDesc = subtotalComDesconto * fatorIndicador;
              const fator = recebeDesconto && baseRateioDesc > 0 ? precoBase / baseRateioDesc : 0;
              const descontoAplicadoNoAmb = recebeDesconto ? descValorEfetivo * fator : 0;
              const precoFinal = incluido ? Math.max(0, precoBase - descontoAplicadoNoAmb) : 0;
              const desconto = precoBase - precoFinal;
              return (
                <div
                  key={a.id}
                  className={`border rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap ${incluido ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-50/60 opacity-70"}`}
                  style={{ minHeight: 56 }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Incluir este ambiente no orçamento">
                      <input
                        type="checkbox"
                        checked={incluido}
                        onChange={async (e) => {
                          const v = e.target.checked;
                          setAmbientes((prev) => prev.map((x) => x.id === a.id ? { ...x, negociavel: v } : x));
                          await supabase.from("ambientes").update({ negociavel: v } as any).eq("id", a.id);
                        }}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      
                    </label>
                    <div className="text-[14px] font-semibold uppercase tracking-tight truncate">{a.nome}</div>
                    {a.aplicar_desconto === false && (
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium shrink-0" title="Definido na tela de Orçamento">sem desconto</span>
                    )}
                    {!incluido && (
                      <span className="text-[10px] text-slate-500 italic shrink-0">Não incluído</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0 whitespace-nowrap text-right">
                    {!incluido ? (
                      <span className="text-[13px] text-muted-foreground line-through text-mono">{fmtBrl(precoBase)}</span>
                    ) : desconto > 0.01 ? (
                      <>
                        <span className="text-[12px] text-muted-foreground line-through text-mono">de {fmtBrl(precoBase)}</span>
                        <span className="text-[15px] font-semibold text-mono text-[#1F5235]">por {fmtBrl(precoFinal)}</span>
                      </>
                    ) : (
                      <span className="text-[15px] font-semibold text-mono">{fmtBrl(precoFinal)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}


          <div className="border-t border-border pt-4 space-y-3">
            {(() => {
              const vManual = descValorAplicado || 0;
              const vForma = descontoMetodoValor || 0;
              const vEntrada = descontoEntradaValor || 0;
              const descTotal = vManual + vForma + vEntrada;
              const temDesconto = descTotal > 0.01;
              const base = valorInicial > 0 ? valorInicial : 0;
              const pct = (v: number) => (base > 0 ? (v / base) * 100 : 0);
              const hasSecondary = vManual > 0.01 || vForma > 0.01 || vEntrada > 0.01;
              return (
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  {/* Coluna esquerda: valor total + cards secundários */}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Total da Proposta</div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {temDesconto && (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[12px] text-muted-foreground">de</span>
                            <span className="text-[18px] font-medium text-mono text-muted-foreground line-through">
                              {fmtBrl(valorInicial)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          {temDesconto && <span className="text-[12px] text-emerald-800">por</span>}
                          <div className="text-[34px] font-semibold text-mono leading-tight text-[#1F5235]">
                            {fmtBrl(totalContrato)}
                          </div>
                        </div>
                        <button onClick={() => setOpenResumo(true)} className="text-muted-foreground hover:text-foreground" title="Ver resumo">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      {jurosRepassado > 0.01 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Inclui <b>{fmtBrl(jurosRepassado)}</b> de juros repassado ao cliente.
                        </div>
                      )}
                    </div>

                    {hasSecondary && (
                      <div className="flex flex-wrap gap-1.5">
                        {vManual > 0.01 && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-right min-w-[110px]">
                            <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-medium">Desc. Aplicado</div>
                            <div className="text-[9px] text-emerald-600">{pct(vManual).toFixed(2)}%</div>
                            <div className="text-[12px] font-semibold text-mono text-emerald-700">-{fmtBrl(vManual)}</div>
                          </div>
                        )}
                        {vForma > 0.01 && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-right min-w-[110px]">
                            <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-medium">Desc. Forma Pag.</div>
                            <div className="text-[9px] text-emerald-600">{pct(vForma).toFixed(2)}%</div>
                            <div className="text-[12px] font-semibold text-mono text-emerald-700">-{fmtBrl(vForma)}</div>
                          </div>
                        )}
                        {vEntrada > 0.01 && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-right min-w-[110px]">
                            <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-medium">Desc. Entrada</div>
                            <div className="text-[9px] text-emerald-600">{pct(vEntrada).toFixed(2)}%</div>
                            <div className="text-[12px] font-semibold text-mono text-emerald-700">-{fmtBrl(vEntrada)}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Coluna direita: DESCONTO TOTAL grande em destaque */}
                  {temDesconto && (
                    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-6 py-4 text-right min-w-[260px] flex-shrink-0 shadow-sm">
                      <div className="text-[13px] uppercase tracking-[0.14em] text-emerald-800 font-semibold">Desconto Total</div>
                      <div className="text-[14px] text-emerald-700 mt-0.5">{pct(descTotal).toFixed(2)}%</div>
                      <div className="text-[32px] font-bold text-mono text-emerald-900 leading-tight mt-1">-{fmtBrl(descTotal)}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>


          {/* Descrição de pagamento */}
          <div className="border-t border-border pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" /> DESCRIÇÃO DE PAGAMENTO
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground hidden sm:block">Entrada</Label>
                <div className="relative w-[150px]">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">R$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={entrada || ""}
                    onChange={(e) => setEntrada(Number(e.target.value) || 0)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarEntradaCard(); } }}
                    placeholder="0,00"
                    disabled={entradasCfg.length === 0}
                    className="h-8 pl-8 pr-2 text-right text-[12px]"
                  />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={adicionarEntradaCard}
                          disabled={entradasCfg.length === 0}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar entrada
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {entradasCfg.length === 0 && (
                      <TooltipContent>Nenhuma forma de entrada ativa cadastrada.</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>



          {/* lista de pagamentos */}
          {pagamentos.length > 0 ? (
            <div className="space-y-2">
              {pagamentos.map((p, idx) => {
                const { det, vencs, formas, locked, confirmadas } = ensureArrays(p);
                const totalParc = confirmadas.length;
                const confCount = confirmadas.filter(Boolean).length;
                const todasConf = totalParc > 0 && confCount === totalParc;
                const minimizado = expandedPagIdx !== idx;
                return (
                  <div
                    key={idx}
                    ref={!minimizado ? expandedCardRef : undefined}
                    className={`border-2 rounded-lg p-3 ${todasConf ? "border-emerald-100" : "border-amber-200 bg-amber-50/30"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-border flex items-center justify-center shrink-0">
                        {p.metodo.toLowerCase().includes("pix") || p.metodo.toLowerCase().includes("dinheiro") ? (
                          <Banknote className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <DollarSign className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold uppercase">
                          {p.metodo} <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{p.parcelas === 1 ? "À vista" : `${p.parcelas}x`}</span>
                        </div>
                        {config?.obrigar_informar_vencimento && (
                          <div className="mt-1">
                            {todasConf ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Datas confirmadas
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-300">
                                <AlertTriangle className="w-3 h-3" /> Datas pendentes ({totalParc - confCount}/{totalParc})
                              </span>
                            )}
                          </div>
                        )}

                      </div>
                      <div className="text-mono font-semibold text-[14px]">{fmtBrl(p.valor)}</div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleMinimizar(idx)}
                            >
                              {minimizado ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{minimizado ? "Expandir pagamento" : "Recolher pagamento"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePagamento(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                    {!minimizado && p.parcelas >= 1 && (
                      <div className="mt-3 pt-3 border-t border-emerald-100">
                        <div className="text-[11px] text-muted-foreground mb-2">
                          Parcelas — clique no campo de vencimento para confirmar a data. Travar uma parcela impede que ela seja recalculada.
                        </div>
                        <div className="rounded-md border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12 px-2">Nº</TableHead>
                                <TableHead className="w-[160px] px-2">Vencimento</TableHead>
                                <TableHead className="w-[110px] px-2 text-right">Valor</TableHead>
                                <TableHead className="px-2">Forma prevista</TableHead>
                                <TableHead className="w-10 px-2 text-center">🔒</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {det.map((v, i) => (
                                <TableRow key={i}>
                                  <TableCell className="px-2 text-[12px] text-muted-foreground">{i + 1}/{p.parcelas}</TableCell>
                                  <TableCell className="px-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="relative">
                                            <Input
                                              type="date"
                                              value={vencs[i] || ""}
                                              disabled={!!locked[i]}
                                              onFocus={() => confirmarParcelaVenc(idx, i)}
                                              onClick={() => confirmarParcelaVenc(idx, i)}
                                              onChange={(e) => editarParcelaVenc(idx, i, e.target.value)}
                                              className={`h-8 text-[12px] px-2 pr-6 ${!confirmadas[i] ? "border-amber-400 ring-1 ring-amber-200" : ""}`}
                                            />
                                            {!confirmadas[i] && (
                                              <AlertTriangle className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500 pointer-events-none" />
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {confirmadas[i] ? "Data confirmada" : "Confirme a data de vencimento desta parcela."}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>

                                  <TableCell className="px-2">
                                    <Input
                                      type="number" step="0.01" inputMode="decimal"
                                      value={Number.isFinite(v) ? Number(v).toFixed(2) : ""}
                                      disabled={!!locked[i]}
                                      onChange={(e) => editarParcelaValor(idx, i, Number(e.target.value) || 0)}
                                      className="text-right text-[12px] h-8 px-2"
                                    />
                                  </TableCell>
                                  <TableCell className="px-2">
                                    {(() => {
                                      const isPagamentoEntrada = !!(p as any).is_entrada;
                                      const met = metodos.find((m) => m.nome === p.metodo);
                                      const cfg = met?.parcelas_config?.find((c) => Number(c.numero) === Number(i + 1))?.forma_pagamento;
                                      const permitidas = Array.isArray(cfg)
                                        ? cfg.filter(Boolean)
                                        : (cfg ? [cfg] : []);
                                      // Entrada: a forma é escolhida na própria parcela, dentre as formas cadastradas
                                      // em Formas de Pagamento > ENTRADA. Não usar formas gerais como fallback.
                                      const opcoesEntrada = Array.from(
                                        new Set(entradasCfg.map((c) => c.forma_pagamento).filter(Boolean) as string[]),
                                      );
                                      const opcoes = isPagamentoEntrada
                                        ? (opcoesEntrada.length ? opcoesEntrada : [p.metodo])
                                        : (permitidas.length ? permitidas : FORMAS_PAGAMENTO);
                                      const atualBase = isPagamentoEntrada ? p.metodo : formas[i];
                                      const atual = atualBase && opcoes.includes(atualBase) ? atualBase : (opcoes[0] || p.metodo || "Boleto");
                                      const travado = !!locked[i];
                                      return (
                                        <Select
                                          value={atual}
                                          disabled={travado}
                                          onValueChange={(val) => editarParcelaForma(idx, i, val)}
                                        >
                                          <SelectTrigger className="h-8 text-[12px] px-2">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {opcoes.map((f) => (
                                              <SelectItem key={f} value={f}>{f}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="px-1 text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => toggleLockParcela(idx, i)}
                                      title={locked[i] ? "Destravar parcela" : "Travar parcela"}
                                    >
                                      {locked[i] ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <div className="text-[13px] font-medium">Nenhum pagamento adicionado</div>
              <div className="text-[12px] text-muted-foreground">Adicione formas de pagamento ao lado</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- RIGHT ---------- */}
      <div className="col-span-12 lg:col-span-4 space-y-5">
        {/* Painel de Fechamento (gatilhos de venda) */}
        {(() => {
          const tplG = tplOrcamento as GatilhosTemplate | null;
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log("Template gatilhos negociação", {
              templateId: (tplG as any)?.id,
              mostrar_gatilhos_venda: tplG?.mostrar_gatilhos_venda,
              mostrar_gatilhos_na_negociacao: tplG?.mostrar_gatilhos_na_negociacao,
              usar_gatilho_escassez: tplG?.usar_gatilho_escassez,
              quantidade_contratos_restantes: tplG?.quantidade_contratos_restantes,
              usar_gatilho_urgencia: tplG?.usar_gatilho_urgencia,
              tipo_validade: tplG?.tipo_validade,
              validade_horas: tplG?.validade_horas,
              validade_data_hora: tplG?.validade_data_hora,
            });
          }
          if (!tplG?.mostrar_gatilhos_venda) return null;
          if (tplG.mostrar_gatilhos_na_negociacao === false) return null;
          const contratosRest = Number(tplG.quantidade_contratos_restantes) || 0;
          const validade = calcularValidade(tplG);
          const usarEsc = !!tplG.usar_gatilho_escassez && contratosRest > 0;
          const usarUrg = !!tplG.usar_gatilho_urgencia && !!validade;
          const vencida = isVencida(validade);
          const ctx = {
            cliente_nome: (orc?.cliente as any)?.nome,
            numero_orcamento: (orc as any)?.codigo,
            nome_projeto: (orc as any)?.nome_projeto,
            valor_total: totalProposta,
            desconto_total: Math.max(0, valorInicial - totalProposta),
          };
          // Resumo da forma de pagamento principal (mesmo formato da impressão)
          const limparMetodo = (n: string) => String(n || "")
            .replace(/\s*\d+\s*x\s*a\s*\d+\s*x\s*/gi, " ")
            .replace(/\s*\(\s*\d+x\s*a\s*\d+x\s*\)\s*/gi, " ")
            .replace(/\s{2,}/g, " ").trim();
          const pgPrincipal: any = pagamentos.find((p: any) => !p.is_entrada) || pagamentos[0];
          let resumoParcela = "—";
          if (pgPrincipal) {
            const j = calcJurosDoPagamento(pgPrincipal);
            const valorTotalPg = j.repassar && Number(pgPrincipal.valor) > 0 ? Number(pgPrincipal.valor) + j.valor : Number(pgPrincipal.valor);
            const n = Math.max(1, Number(pgPrincipal.parcelas) || 1);
            const det: number[] = Array.isArray(pgPrincipal.parcelas_detalhe) ? pgPrincipal.parcelas_detalhe : [];
            const vp = det[0] && det[0] > 0 ? det[0] : valorTotalPg / n;
            resumoParcela = `${limparMetodo(pgPrincipal.metodo) || "—"} · ${n}x · ${fmtBrl(vp)}`;
          }
          const sugestao = resolverTexto(tplG.sugestao_texto_fechamento || "", tplG, ctx, validade);
          if (!usarEsc && !usarUrg) return null;
          const tituloPainel = (tplG.titulo_painel_fechamento && String(tplG.titulo_painel_fechamento).trim()) || "Painel de Fechamento";
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log("[Painel fechamento título]", {
              templateId: (tplOrcamento as any)?.id,
              lojaId: (tplOrcamento as any)?.loja_id,
              titulo_painel_fechamento: (tplOrcamento as any)?.titulo_painel_fechamento,
              tituloRenderizado: tituloPainel,
            });
          }
          return (
            <div className="rounded-xl border border-[#e4d9bf] bg-[#faf6ec] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[16px] uppercase tracking-[0.16em] text-[#0f3d2e] font-bold mb-1">{tituloPainel}</div>
                {vencida && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#7A2833] text-white px-2 py-0.5 rounded">Proposta vencida</span>
                )}
              </div>

              {usarEsc && (
                <div className="rounded-lg bg-[#FFF4D8] border border-[#D7B66B] px-4 py-3">
                  
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[34px] leading-none font-bold text-[#B9872D]">{contratosRest}</span>
                    <span className="text-[13px] text-[#2A2A2A] font-medium">contratos restantes</span>
                  </div>
                  {tplG.quantidade_contratos_total != null && Number(tplG.quantidade_contratos_total) > 0 && (
                    <div className="text-[11px] text-[#2A2A2A]/70 mt-0.5">de {tplG.quantidade_contratos_total} disponíveis</div>
                  )}
                </div>
              )}

              {usarUrg && validade && (
                <div className="rounded-lg bg-[#F8E8EA] border border-[#D8A5AB] px-4 py-3">
                  
                  <div className="mt-1 text-[26px] leading-none font-bold text-[#7A2833]">{tempoRestante(validade)}</div>
                  <div className="text-[11px] text-[#2A2A2A]/80 mt-1">Proposta válida até {formatarValidade(validade)}</div>
                </div>
              )}

              <div className="rounded-lg bg-[#0f3d2e] text-white px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-100/90 font-semibold">Leitura rápida</div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                  <div>
                    <div className="text-emerald-100/80">Economia</div>
                    <div className="font-semibold text-[14px] text-white">{fmtBrl(ctx.desconto_total)}</div>
                  </div>
                  <div>
                    <div className="text-emerald-100/80">Entrada</div>
                    <div className="font-semibold text-[14px] text-white">{fmtBrl(totalEntrada)}</div>
                  </div>
                  <div>
                    <div className="text-emerald-100/80">Parcela</div>
                    <div className="font-semibold text-[13px] text-white leading-tight">{resumoParcela}</div>
                  </div>
                </div>
              </div>

              {sugestao && (
                <div className="rounded-lg bg-white border border-[#e4d9bf] px-4 py-3 text-[12px] text-[#2A2A2A] italic leading-relaxed">
                  “{sugestao}”
                </div>
              )}
            </div>
          );


        })()}




        <div className="surface-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Aplicar Desconto
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Input
                type="number" min={0} max={100} step={0.01}
                value={descPerc}
                onChange={(e) => onPercChange(Number(e.target.value) || 0)}
                className="pr-8 text-right"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">R$</span>
              <Input
                type="number" min={0} step={0.01}
                value={descValor}
                onChange={(e) => onValorChange(Number(e.target.value) || 0)}
                className="pl-9 text-right"
              />
            </div>
          </div>

          {acimaDoLimite && (
            <div className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Desconto acima do limite de <b>{meuLimite.toFixed(2)}%</b>. Ao aplicar, será necessário informar a senha do gestor.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button onClick={aplicarDesconto} className="bg-[#2D6BE5] hover:bg-[#2459C9] text-white">Aplicar desconto</Button>
            <Button variant="outline" onClick={cancelarDesconto}>Cancelar</Button>
          </div>
        </div>

        {/* Adicionar pagamento */}
        <div className="surface-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Adicionar Pagamento</div>
          <div className="space-y-3">
            <div>
              <Label>Método de Pagamento</Label>
              <Select value={novoMetodo} onValueChange={(v) => trocarMetodo(v, 0)}>
                <SelectTrigger><SelectValue placeholder="Selecione um método..." /></SelectTrigger>
                <SelectContent>
                  {metodos.map((m) => (
                    <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número de Parcelas</Label>
              <Select value={String(novoParcelas)} onValueChange={(v) => trocarParcelas(Number(v))}>
                <SelectTrigger><span className="text-[13px]">{novoParcelas > 0 ? `${novoParcelas}x` : <span className="text-muted-foreground">Selecione...</span>}</span></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const met = metodos.find((m) => m.nome === novoMetodo);
                    const max = Math.max(1, Number(met?.max_parcelas) || 24);
                    return Array.from({ length: max }, (_, i) => i + 1).map((n) => {
                      const cfg = met?.parcelas_config?.find((p) => Number(p.numero) === n);
                      const desc = Number(cfg?.desconto_perc) || 0;
                      return (
                        <SelectItem key={n} value={String(n)}>
                          {n}x{desc > 0 ? ` · -${desc.toFixed(2)}% desc.` : ""}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>





        {/* Resumo / Ações */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setOpenResumo(true)}>
            <FileText className="w-4 h-4 mr-1.5" /> Resumo da Negociação
          </Button>
          <Button variant="outline" className="w-full" onClick={tryImprimir}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir Orçamento
          </Button>
          <Button onClick={trySalvar} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Salvando…" : "Salvar Orçamento"}
          </Button>
          <Button onClick={confirmar} disabled={saving || Math.abs(restante) > 0.01}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Pedido
          </Button>
        </div>
      </div>

      {/* dialogs */}
      {/* Solicitação de aprovação de desconto via Central de Autorizações */}
      <Dialog open={openSolicitarDesc} onOpenChange={setOpenSolicitarDesc}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar aprovação de desconto</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Desconto de <b>{descPerc.toFixed(2)}%</b> ultrapassa seu limite de <b>{meuLimite.toFixed(2)}%</b>.
            A solicitação ficará pendente na <b>Central de Autorizações</b> até que um aprovador decida.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo da solicitação</Label>
            <Textarea
              rows={3}
              placeholder="Justifique o desconto adicional…"
              value={motivoDesc}
              onChange={(e) => setMotivoDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSolicitarDesc(false)}>Cancelar</Button>
            <Button
              disabled={!motivoDesc.trim() || enviandoDesc}
              onClick={async () => {
                if (!id) return;
                setEnviandoDesc(true);
                try {
                  const { solicitarAutorizacao } = await import("@/lib/autorizacoes");
                  await solicitarAutorizacao({
                    categoria: "desconto",
                    tipo: "desconto_acima_limite",
                    titulo: `Desconto ${descPerc.toFixed(2)}% acima do limite (${meuLimite.toFixed(2)}%)`,
                    descricao: `Orçamento ${(orc as any)?.codigo || ""}`.trim(),
                    motivo_solicitacao: motivoDesc,
                    origem_modulo: "negociacao",
                    origem_id: id,
                    loja_id: (orc as any)?.loja_id || null,
                    orcamento_id: id,
                    cliente_id: (orc?.cliente as any)?.id || null,
                    valor_solicitado: descPerc,
                    limite_padrao: meuLimite,
                    dados_contexto: {
                      cliente: (orc?.cliente as any)?.nome || null,
                      valor_original: valorInicial,
                      valor_com_desconto: Math.max(0, valorInicial - descValor),
                      percentual_desconto: descPerc,
                      limite_permitido: meuLimite,
                      diferenca: descValor,
                    },
                  });
                  setAprovacaoDescPendente(true);
                  setOpenSolicitarDesc(false);
                  toast.success("Solicitação enviada para a Central de Autorizações");
                } catch (e: any) {
                  toast.error(e?.message || "Falha ao enviar solicitação");
                } finally {
                  setEnviandoDesc(false);
                }
              }}
            >
              {enviandoDesc ? "Enviando…" : "Enviar para aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Diálogo legado de senha do gestor: mantido oculto para retrocompatibilidade */}
      <SenhaAdminDialog
        open={openSenha} onOpenChange={setOpenSenha}
        percent={descPerc} limite={meuLimite}
        onAuthorized={(adminEmail) => {
          setAutorizadoPorGestor(true);
          setAprovadorEmail(adminEmail);
          setDescPercAplicado(descPerc);
          setDescValorAplicado(descValor);
          registrarAprovacao(adminEmail, descPerc, descValor);
        }}
      />
      {aprovacaoDescPendente && !autorizadoPorGestor && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-md border bg-amber-50 text-amber-900 border-amber-200 px-3 py-2 text-[12px] shadow z-50">
          Aprovação de desconto <b>pendente</b> na Central de Autorizações. O desconto só será aplicado após aprovação.
        </div>
      )}
      <ResumoFinanceiroDialog
        open={openResumo} onOpenChange={setOpenResumo}
        valorInicial={valorInicial} descPerc={descPercAplicado} descValor={descValorAplicado}
        totalProposta={totalProposta}
        totalContrato={totalContrato}
        parceiroNome={parceiro?.nome} parceiroPerc={parceiroPerc} parceiroValor={parceiroValor}
        custoFabrica={custoFabricaTotal}
        custoFabricaReferencia={custoFabricaReferencia}
        jurosAbsorvido={jurosAbsorvido}
        jurosRepassado={jurosRepassado}
        config={config} usarMarkup={usarMarkup}
      />
      <ValidarClienteDialog
        open={openValidar} onOpenChange={setOpenValidar}
        missing={camposFaltando}
        onAtualizar={() => { setOpenValidar(false); setOpenClienteEdit(true); }}
        onContinuar={async () => {
          setOpenValidar(false);
          if (actionAfterValidate === "save") {
            const ok = await persist();
            if (ok) toast.success("Orçamento salvo");
          } else if (actionAfterValidate === "confirmar") {
            setOpenConfirmar(true);
          } else {
            gerarProposta();
          }
        }}
      />
      <ClienteFormDialog
        open={openClienteEdit} onOpenChange={setOpenClienteEdit}
        cliente={cliente}
        onSaved={() => { setOpenClienteEdit(false); reloadCliente(); }}
      />
      <ConfirmarPedidoDialog
        open={openConfirmar} onOpenChange={setOpenConfirmar}
        observacoesPadrao={tplContrato?.observacoes_padrao || ""}
        onConfirm={gerarContrato}
        loading={confirmando}
      />
      <AlertDialog open={!!askCascade} onOpenChange={(o) => { if (!o) setAskCascade(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar intervalo de 30 dias?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja que todas as parcelas abaixo desta sigam a ordem de intervalo de 30 dias sequencialmente?
              Parcelas travadas serão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAskCascade(null)}>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (askCascade) aplicarCascataVenc(askCascade.idxPag, askCascade.idxParc);
                setAskCascade(null);
              }}
            >
              Sim, aplicar +30 dias
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmTrocaMetodo} onOpenChange={(o) => { if (!o) setConfirmTrocaMetodo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar método de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Alterar o método de pagamento irá limpar as parcelas, entrada e descontos calculados anteriormente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmTrocaMetodo(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTrocaMetodo}>Sim, alterar método</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}

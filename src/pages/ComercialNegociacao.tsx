import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClienteFormDialog, ClienteRow } from "@/components/clientes/ClienteFormDialog";
import { renderContratoHtml, type ContratoTemplate, type ContratoCtx } from "@/lib/contratoTemplate";
import { getLegacyPublicContractUrl } from "@/lib/publicLinks";

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const FORMAS_PAGAMENTO_FALLBACK = ["Boleto", "PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência", "Cheque", "Crediário Próprio"];

type Ambiente = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
  custo_aquisicao?: number | null;
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
};
type ParcelaCfg = { numero: number; juros_perc?: number; forma_pagamento?: string; desconto_perc?: number };
type Metodo = { id: string; nome: string; taxa_perc_parcela?: number; max_parcelas?: number; parcelas_config?: ParcelaCfg[] };
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
  parceiroNome, parceiroPerc, parceiroValor, custoFabrica, jurosCliente,
  config, usarMarkup,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  valorInicial: number; descPerc: number; descValor: number; totalProposta: number;
  parceiroNome?: string; parceiroPerc: number; parceiroValor: number; custoFabrica: number;
  jurosCliente: number;
  config: any; usarMarkup: boolean;
}) {
  const { can } = usePermissions();
  const podeVerCusto = can("itens", "view_custo");
  const podeVerMarkup = can("itens", "view_markup") && usarMarkup;
  const podeVerComissao = can("parceiros", "view_comissao");
  const fretePerc = Number(config?.frete_venda_perc) || 0;
  const comissaoLojaPerc = Number(config?.comissao_loja_perc) || 0;
  const montagemPerc = Number(config?.montagem_perc) || 0;
  const impostosPerc = Number(config?.imp_saida_perc) || 0;
  const outrosPerc = Number(config?.outros_perc) || 0;
  const frete = totalProposta * (fretePerc / 100);
  const comissaoLoja = totalProposta * (comissaoLojaPerc / 100);
  const montagem = totalProposta * (montagemPerc / 100);
  const impostos = totalProposta * (impostosPerc / 100);
  const outros = totalProposta * (outrosPerc / 100);
  const totalCustos = custoFabrica + frete + comissaoLoja + montagem + impostos + outros;
  const valorSemJuros = totalProposta - jurosCliente;
  const totalVPL = valorSemJuros - parceiroValor;
  const lucro = totalVPL - totalCustos;
  const margem = totalProposta > 0 ? (lucro / totalProposta) * 100 : 0;
  const markup = custoFabrica > 0 ? totalVPL / custoFabrica : 0;

  const Row = ({ label, valor, perc, color }: { label: string; valor: number; perc: number; color: string }) => (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {label}
        </div>
        <span className="text-mono font-semibold">{fmtBrl(valor)}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, perc)}%`, background: color }} />
      </div>
      <div className="text-right text-[11px] text-muted-foreground mt-0.5">{perc.toFixed(2)}%</div>
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
            <Field label="Valor Inicial" value={fmtBrl(valorInicial)} />
            <Field label="Descontos" color="#B83232"
              value={<>-{fmtBrl(descValor)} <span className="text-[12px] text-muted-foreground">({descPerc.toFixed(2)}%)</span></>}
            />
            <Field label="Valor Total da Proposta" value={fmtBrl(totalProposta)} />
            <Field label="Juros do Cliente" color="#B83232" value={<>-{fmtBrl(jurosCliente)}</>} />
            <Field label="Valor sem Juros do Cliente" value={fmtBrl(valorSemJuros)} />
            {parceiroNome && podeVerComissao && (
              <Field label={`Indicador (${parceiroNome})`} color="#B83232"
                value={<>-{fmtBrl(parceiroValor)} <span className="text-[12px] text-muted-foreground">({parceiroPerc.toFixed(2)}%)</span></>} />
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
            <Row label="Fábrica" valor={custoFabrica} perc={pct(custoFabrica)} color="#3F8B5C" />
            <Row label="Frete" valor={frete} perc={pct(frete)} color="#A855F7" />
            <Row label="Comissão Loja" valor={comissaoLoja} perc={pct(comissaoLoja)} color="#F59E0B" />
            <Row label="Montagem" valor={montagem} perc={pct(montagem)} color="#06B6D4" />
            <Row label="Impostos Saída" valor={impostos} perc={pct(impostos)} color="#F97316" />
            <Row label="Outros" valor={outros} perc={pct(outros)} color="#94A3B8" />
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
                <div className="text-[12px] text-muted-foreground">Lucro Estimado</div>
                <div className="text-[24px] font-semibold text-emerald-600 text-mono">{fmtBrl(lucro)}</div>
              </div>
            </div>
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

  useEffect(() => {
    supabase.from("formas_pagamento").select("nome").eq("ativo", true).order("ordem").then(({ data }) => {
      const list = (data || []).map((r: any) => r.nome).filter(Boolean);
      if (list.length) setFormasPagamento(list);
    });
  }, []);

  // dialogs
  const [openSenha, setOpenSenha] = useState(false);
  const [openResumo, setOpenResumo] = useState(false);
  const [openValidar, setOpenValidar] = useState(false);
  const [openClienteEdit, setOpenClienteEdit] = useState(false);
  const [actionAfterValidate, setActionAfterValidate] = useState<"print" | "save" | "confirmar" | null>(null);
  const [openConfirmar, setOpenConfirmar] = useState(false);
  const [tplContrato, setTplContrato] = useState<ContratoTemplate | null>(null);
  const [confirmando, setConfirmando] = useState(false);

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
          .select("id, nome, descricao, preco_sugerido, custo_aquisicao, negociavel, aplicar_desconto")
          .eq("orcamento_id", id)
          .order("ordem"),
        supabase.from("metodos_pagamento").select("id, nome, taxa_perc_parcela, max_parcelas, parcelas_config").eq("ativo", true).order("nome"),
        supabase.from("pagamentos_orcamento")
          .select("id, metodo, valor, parcelas, data_vencimento, parcelas_detalhe")
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

      // Template de contrato (loja atual ou padrão global)
      const { data: tpls } = await supabase
        .from("contratos_template")
        .select("*")
        .eq("ativo", true)
        .order("loja_id", { nullsFirst: false });
      setTplContrato((tpls?.[0] ?? null) as ContratoTemplate | null);

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
  // incide sobre o saldo a parcelar (após entrada e descontos manuais).
  const metodoSelecionado = metodos.find((m) => m.nome === novoMetodo);
  const cfgParcelaSel = metodoSelecionado?.parcelas_config?.find((p) => Number(p.numero) === Number(novoParcelas));
  const descontoMetodoPerc = Number(cfgParcelaSel?.desconto_perc) || 0;
  const _somaEntradasAdicionadas = pagamentos.reduce((s, p: any) => s + (p.is_entrada ? (p.valor || 0) : 0), 0);
  const baseParaMetodo = Math.max(0, (isAdendo ? adendoValor : Math.max(0, valorInicial - descValorEfetivo)) - (entrada || 0) - _somaEntradasAdicionadas);
  const descontoMetodoValor = baseParaMetodo * (descontoMetodoPerc / 100);
  const totalProposta = isAdendo
    ? Math.max(0, adendoValor - descontoMetodoValor)
    : Math.max(0, valorInicial - descValorEfetivo - descontoMetodoValor);
  const totalAlocado = pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
  const restante = totalProposta - totalAlocado;
  const allocPerc = totalProposta > 0 ? Math.min(100, (totalAlocado / totalProposta) * 100) : 0;
  const custoFabricaTotal = useMemo(
    () => itens.reduce((s, it) => s + (Number(it.custo_fabrica) || 0) * (it.quantidade || 0), 0),
    [itens],
  );
  // Juros do cliente embutidos: usa taxa configurada do método (ao mês), simples por parcela
  const jurosCliente = useMemo(() => {
    return pagamentos.reduce((s, p) => {
      if (!p.parcelas || p.parcelas <= 1) return s;
      const met = metodos.find((m) => m.nome === p.metodo);
      const taxa = (Number(met?.taxa_perc_parcela) || 0) / 100;
      if (!taxa) return s;
      const principal = p.valor / p.parcelas;
      let total = 0;
      for (let i = 1; i < p.parcelas; i++) total += principal * taxa * i;
      return s + total;
    }, 0);
  }, [pagamentos, metodos]);

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
    setOpenSenha(true);
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
    return { det, vencs, formas, locked };
  };

  // Mantido para compat (renderização legada)
  const ensureDetalhe = (p: Pagamento): number[] => ensureArrays(p).det;

  // Confirmação de cascata +30d
  const [askCascade, setAskCascade] = useState<{ idxPag: number; idxParc: number } | null>(null);

  const editarParcelaValor = (idxPag: number, idxParc: number, novoValor: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked } = ensureArrays(p);
      det[idxParc] = Number(novoValor) || 0;
      const recalc = recalcParcelas(det, p.valor, idxParc, locked);
      return { ...p, parcelas_detalhe: recalc, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked };
    }));
  };

  const editarParcelaVenc = (idxPag: number, idxParc: number, novaData: string) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked } = ensureArrays(p);
      vencs[idxParc] = novaData || null;
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked };
    }));
    // pergunta sobre cascata de +30 dias nas próximas
    if (idxParc < (pagamentos[idxPag]?.parcelas ?? 0) - 1) {
      setAskCascade({ idxPag, idxParc });
    }
  };

  const editarParcelaForma = (idxPag: number, idxParc: number, novaForma: string) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked } = ensureArrays(p);
      formas[idxParc] = novaForma;
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked };
    }));
  };

  const toggleLockParcela = (idxPag: number, idxParc: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked } = ensureArrays(p);
      locked[idxParc] = !locked[idxParc];
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked };
    }));
  };

  const aplicarCascataVenc = (idxPag: number, idxParc: number) => {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== idxPag) return p;
      const { det, vencs, formas, locked } = ensureArrays(p);
      const base = vencs[idxParc];
      for (let k = idxParc + 1; k < vencs.length; k++) {
        if (!locked[k]) vencs[k] = addDays(base, (k - idxParc) * 30);
      }
      return { ...p, parcelas_detalhe: det, parcelas_vencimentos: vencs, parcelas_formas: formas, parcelas_locked: locked };
    }));
  };

  const removePagamento = (idx: number) =>
    setPagamentos((p) => p.filter((_, i) => i !== idx));

  const somaEntradas = useMemo(
    () => pagamentos.filter((p: any) => p.is_entrada).reduce((s, p) => s + (p.valor || 0), 0),
    [pagamentos],
  );

  const aplicarEntrada = () => {
    if (!entrada || entrada <= 0) return toast.error("Informe o valor da entrada");
    if (!novoMetodo) return toast.error("Selecione o método de pagamento da entrada");
    setPagamentos((prev) => {
      const hoje = new Date().toISOString().slice(0, 10);
      return [
        ...prev,
        { metodo: novoMetodo, valor: entrada, parcelas: 1, data_vencimento: novoVenc || hoje, parcelas_detalhe: null, is_entrada: true } as any,
      ];
    });
    setEntrada(0);
    toast.success("Entrada adicionada");
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
      total: totalProposta,
    };
    if (newStatus) updates.status = newStatus;

    const { error: e1 } = await supabase.from("orcamentos").update(updates).eq("id", id);
    if (e1) { setSaving(false); return toast.error(e1.message); }

    await supabase.from("pagamentos_orcamento").delete().eq("orcamento_id", id);
    if (pagamentos.length > 0) {
      const { error: e2 } = await supabase.from("pagamentos_orcamento").insert(
        pagamentos.map((p) => ({
          orcamento_id: id,
          metodo: p.metodo,
          valor: p.valor,
          parcelas: p.parcelas,
          data_vencimento: p.data_vencimento,
          parcelas_detalhe: p.parcelas_detalhe && p.parcelas_detalhe.length === p.parcelas ? p.parcelas_detalhe : null,
          parcelas_vencimentos: (p as any).parcelas_vencimentos && (p as any).parcelas_vencimentos.length === p.parcelas ? (p as any).parcelas_vencimentos : null,
          parcelas_formas: (p as any).parcelas_formas && (p as any).parcelas_formas.length === p.parcelas ? (p as any).parcelas_formas : null,
        })) as any,
      );
      if (e2) { setSaving(false); return toast.error(e2.message); }
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

  const tryImprimir = () => {
    if (pagamentos.length === 0) {
      return toast.error("Configure pelo menos um método de pagamento antes de imprimir o orçamento.");
    }
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

    // Snapshot dos ambientes com preços com desconto
    const ambientesSnap = ambientes.map((a) => {
      const precoBase = Number(a.preco_sugerido) || 0;
      const fator = subtotalAmbientes > 0 ? precoBase / subtotalAmbientes : 0;
      return {
        nome: a.nome,
        descricao: a.descricao,
        preco_base: precoBase,
        preco_final: totalProposta * fator,
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
        valor_total: totalProposta,
        conteudo_snapshot: {
          numero,
          emitido_em: new Date().toISOString(),
          empresa,
          cliente,
          ambientes: ambientesSnap,
          subtotal: subtotalAmbientes,
          desconto_perc: descPercAplicado,
          desconto_valor: descValorAplicado,
          total: totalProposta,
          pagamentos,
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
    toast.success(`Contrato ${created.numero} gerado! Venda criada automaticamente.`);
    // Atualiza o pedido (criado pelo trigger) com notas, previsão de medição e responsável
    const { data: { user } } = await supabase.auth.getUser();
    setTimeout(async () => {
      const { data: ped } = await supabase.from("pedidos").select("id").eq("orcamento_id", id).maybeSingle();
      if (ped?.id) {
        const patch: any = {
          observacoes_venda: observacoes || null,
          estagio_responsavel_id: user?.id || null,
        };
        // Previsão informada na venda NÃO preenche data_medicao_tecnica.
        // Esse campo só é preenchido ao agendar a medição (pelo Cronograma ou pela Agenda).
        if (previsaoMedicao) patch.observacoes_venda = `${observacoes ? observacoes + "\n\n" : ""}Previsão de medição informada na venda: ${new Date(previsaoMedicao).toLocaleDateString("pt-BR")}`;
        await supabase.from("pedidos").update(patch).eq("id", ped.id);
        navigate(`/pedidos/${ped.id}`);
      } else {
        navigate(`/contratos/${created.id}`);
      }
    }, 600);
  };

  /* ------------------------- gerar proposta (HTML print) ------------------------- */
  const gerarProposta = () => {
    if (!orc) return;
    const itensPorAmb = ambientes.map((a) => ({
      amb: a, items: itens.filter((it) => it.ambiente_id === a.id),
    }));
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Proposta ${orc.codigo}</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color:#1a1a1a; font-size:13px; line-height:1.4; }
      h1 { font-size:22px; margin:0 0 4px; }
      h2 { font-size:14px; margin:18px 0 6px; padding-bottom:4px; border-bottom:1px solid #ddd; color:#1F5235; text-transform:uppercase; letter-spacing:.5px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #1F5235; margin-bottom:18px; }
      .muted { color:#6B6760; font-size:11px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th, td { padding:6px 8px; text-align:left; font-size:12px; border-bottom:1px solid #eee; }
      th { background:#F4F6FA; text-transform:uppercase; font-size:10px; letter-spacing:.5px; }
      .right { text-align:right; }
      .totais { margin-top:18px; padding:14px; background:#F4F6FA; border-radius:8px; }
      .totais .row { display:flex; justify-content:space-between; padding:4px 0; }
      .totais .total { font-size:18px; font-weight:600; border-top:1px solid #ccc; padding-top:8px; margin-top:8px; color:#1F5235; }
      .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .box { border:1px solid #e5e5e5; border-radius:8px; padding:10px; }
      .box .label { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#6B6760; margin-bottom:2px; }
      .pag { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #eee; font-size:12px; }
      .footer { margin-top:32px; font-size:11px; color:#6B6760; border-top:1px solid #eee; padding-top:10px; }
      .sig { margin-top:48px; display:flex; justify-content:space-between; gap:40px; }
      .sig div { flex:1; border-top:1px solid #333; padding-top:6px; text-align:center; font-size:11px; }
    </style></head><body>
    <div class="header">
      <div>
        <h1>Proposta Comercial</h1>
        <div class="muted">Nº ${orc.codigo} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
        <div class="muted">Projeto: <b>${orc.nome_projeto || "—"}</b></div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:600">Alavanch</div>
        <div class="muted">contato@planejadospro.com.br</div>
      </div>
    </div>

    <div class="box">
      <div class="label">Cliente</div>
      <div><b>${cliente?.nome || "—"}</b></div>
      <div class="muted">${cliente?.cpf_cnpj || ""}</div>
      <div class="muted">${cliente?.email || ""} · ${cliente?.telefone || ""}</div>
      <div class="muted">${cliente?.endereco_cobranca || ""}</div>
    </div>

    <h2>Ambientes</h2>
    ${itensPorAmb.map(({ amb, items }) => `
      <div style="margin-bottom:14px">
        <div style="font-weight:600; font-size:13px;">${amb.nome.toUpperCase()} — <span style="color:#1F5235">${fmtBrl(Number(amb.preco_sugerido) || 0)}</span></div>
        ${amb.descricao ? `<div class="muted" style="margin-bottom:4px">${amb.descricao}</div>` : ""}
        ${items.length ? `<table>
          <thead><tr><th>Descrição</th><th class="right">Qtd</th><th class="right">Unit.</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${items.map((it) => `<tr>
              <td>${it.descricao || "—"}</td>
              <td class="right">${it.quantidade}</td>
              <td class="right">${fmtBrl(Number(it.custo_cliente) || 0)}</td>
              <td class="right">${fmtBrl((Number(it.custo_cliente) || 0) * (it.quantidade || 0))}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : ""}
      </div>
    `).join("")}

    <div class="totais">
      <div class="row"><span>Subtotal</span><b>${fmtBrl(subtotalAmbientes)}</b></div>
      ${descValorAplicado ? `<div class="row" style="color:#7A2222"><span>Desconto (${descPercAplicado.toFixed(2)}%)</span><b>-${fmtBrl(descValorAplicado)}</b></div>` : ""}
      <div class="row total"><span>Total da Proposta</span><span>${fmtBrl(totalProposta)}</span></div>
    </div>

    <h2>Forma de Pagamento</h2>
    ${pagamentos.length ? pagamentos.map((p) => `<div class="pag">
      <span><b>${p.metodo}</b> · ${p.parcelas}x ${p.data_vencimento ? "· venc. " + new Date(p.data_vencimento).toLocaleDateString("pt-BR") : ""}</span>
      <b>${fmtBrl(p.valor)}</b>
    </div>`).join("") : `<div class="muted">A definir</div>`}

    <h2>Condições Gerais</h2>
    <div class="muted">
      1. Esta proposta tem validade de 15 dias a contar da data de emissão.<br/>
      2. Os prazos de produção e entrega serão definidos após a assinatura do caderno técnico.<br/>
      3. Eventuais alterações de projeto após a assinatura podem implicar revisão de valores e prazos.<br/>
      4. O presente documento poderá ser convertido em contrato mediante aceite das partes.
    </div>

    <div class="sig">
      <div>Cliente<br/><span class="muted">${cliente?.nome || ""}</span></div>
      <div>Empresa<br/><span class="muted">Alavanch</span></div>
    </div>

    <div class="footer">Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")}.</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return toast.error("Bloqueador de pop-up impediu a impressão");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 350);
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
    <div className="grid grid-cols-12 gap-6">
      {/* ---------- LEFT ---------- */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Link
          to={`/comercial/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Orçamento
        </Link>

        <div className="surface-card p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#EAF2FB", border: "1px solid #D6E4F5" }}>
              <Calculator className="w-6 h-6" style={{ color: "#3B6FB0" }} />
            </div>
            <div>
              <h1 className="text-[26px] font-semibold leading-none">Negociação Comercial</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                {pedidoRef ? (
                  <>
                    Referente ao <b>{pedidoRef.tipo}</b> do pedido{" "}
                    <Link to={`/pedidos/${pedidoRef.id}`} className="font-semibold text-foreground underline hover:no-underline">
                      {pedidoRef.codigo}
                    </Link>
                  </>
                ) : (
                  <>Ajuste valores e condições</>
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
          <div className="space-y-3">
            {ambientes.map((a) => {
              const incluido = a.negociavel !== false;
              const recebeDesconto = a.aplicar_desconto !== false;
              const fatorIndicador = 1 + (parceiroPerc / 100);
              // Preço exibido já com o percentual do indicador acrescido
              const precoBase = (Number(a.preco_sugerido) || 0) * fatorIndicador;
              // Base descontável também com indicador, mantendo o rateio proporcional
              const baseRateioDesc = subtotalComDesconto * fatorIndicador;
              const fator = recebeDesconto && baseRateioDesc > 0
                ? precoBase / baseRateioDesc
                : 0;
              const descontoAplicadoNoAmb = recebeDesconto ? descValorEfetivo * fator : 0;
              const precoFinal = incluido ? Math.max(0, precoBase - descontoAplicadoNoAmb) : 0;
              const desconto = precoBase - precoFinal;
              return (
                <div key={a.id} className={`border-2 rounded-lg px-4 py-4 ${incluido ? "border-emerald-100" : "border-slate-200 bg-slate-50/60 opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          <label className="flex items-center gap-1.5 cursor-pointer" title="Incluir este ambiente no orçamento">
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
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Incluir</span>
                          </label>
                          {/* Indicador read-only: a elegibilidade a desconto é definida na tela
                              de Ambientes (Orçamento). Aqui apenas mostramos o status. */}
                          {a.aplicar_desconto === false && (
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium" title="Definido na tela de Orçamento">sem desconto</span>
                          )}
                        </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold uppercase tracking-tight">{a.nome}</div>
                        {a.descricao && (
                          <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">- {a.descricao}</div>
                        )}
                        {!incluido && <div className="text-[11px] text-slate-500 mt-1 italic">Não incluído no orçamento</div>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço</div>
                      {!incluido ? (
                        <div className="text-[13px] text-muted-foreground line-through">{fmtBrl(precoBase)}</div>
                      ) : desconto > 0.01 ? (
                        <>
                          <div className="text-[12px] text-muted-foreground line-through">de {fmtBrl(precoBase)}</div>
                          <div className="text-[15px] font-semibold text-mono text-emerald-700">por {fmtBrl(precoFinal)}</div>
                        </>
                      ) : (
                        <div className="text-[15px] font-semibold text-mono">{fmtBrl(precoFinal)}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          <p className="text-[12px] text-muted-foreground">*Após assinatura do caderno técnico</p>

          <div className="border-t border-border pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Total da Proposta</div>
                <div className="flex items-center gap-2">
                  <div className="text-[34px] font-semibold text-mono leading-tight">{fmtBrl(totalProposta)}</div>
                  <button onClick={() => setOpenResumo(true)} className="text-muted-foreground hover:text-foreground" title="Ver resumo">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {descValorAplicado > 0 && (
                <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700">Desconto</div>
                  <div className="text-[18px] font-semibold text-mono text-emerald-700">-{fmtBrl(descValorAplicado)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Fluxo de recebimento */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" /> FLUXO DE RECEBIMENTO
              </div>
              <div className="text-[12px] flex gap-6">
                <div className="text-right">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Total Alocado</div>
                  <div className="font-medium text-mono text-[#2D6BE5]">{fmtBrl(totalAlocado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Restante</div>
                  <div className={`font-medium text-mono ${Math.abs(restante) < 0.01 ? "text-emerald-700" : "text-rose-600"}`}>
                    {fmtBrl(restante)}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${allocPerc}%`, background: allocPerc >= 100 ? "#3F8B5C" : "#2D6BE5" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
              <span>{allocPerc.toFixed(1)}% alocado</span>
              {allocPerc >= 100 && <span className="text-emerald-700 font-medium">✓ Pagamento completo</span>}
            </div>
          </div>

          {/* lista de pagamentos */}
          {pagamentos.length > 0 ? (
            <div className="space-y-2">
              {pagamentos.map((p, idx) => {
                const { det, vencs, formas, locked } = ensureArrays(p);
                return (
                  <div key={idx} className="border-2 border-emerald-100 rounded-lg p-3">
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
                      </div>
                      <div className="text-mono font-semibold text-[14px]">{fmtBrl(p.valor)}</div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePagamento(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                    {p.parcelas >= 1 && (
                      <div className="mt-3 pt-3 border-t border-emerald-100">
                        <div className="text-[11px] text-muted-foreground mb-2">
                          Parcelas — edite valor, vencimento ou forma de pagamento. Travar uma parcela impede que ela seja recalculada.
                        </div>
                        <div className="rounded-md border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12 px-2">Nº</TableHead>
                                <TableHead className="w-[140px] px-2">Vencimento</TableHead>
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
                                    <Input
                                      type="date"
                                      value={vencs[i] || ""}
                                      disabled={!!locked[i]}
                                      onChange={(e) => editarParcelaVenc(idx, i, e.target.value)}
                                      className="h-8 text-[12px] px-2"
                                    />
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
                                      const met = metodos.find((m) => m.nome === p.metodo);
                                      const cfg = met?.parcelas_config?.find((c) => Number(c.numero) === Number(i + 1))?.forma_pagamento;
                                      const permitidas = Array.isArray(cfg)
                                        ? cfg.filter(Boolean)
                                        : (cfg ? [cfg] : []);
                                      const opcoes = permitidas.length ? permitidas : FORMAS_PAGAMENTO;
                                      const atual = formas[i] && opcoes.includes(formas[i]) ? formas[i] : (opcoes[0] || "Boleto");
                                      return (
                                        <Select
                                          value={atual}
                                          disabled={!!locked[i]}
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
        {/* Aplicar desconto */}
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
              <Select value={novoMetodo} onValueChange={(v) => { setNovoMetodo(v); setNovoParcelas(0); }}>
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
              <Select value={String(novoParcelas)} onValueChange={(v) => setNovoParcelas(Number(v))}>
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
              {descontoMetodoPerc > 0 && novoMetodo && (
                <div className="text-[11px] text-emerald-700 mt-1">
                  Desconto da forma de pagamento: -{descontoMetodoPerc.toFixed(2)}% ({fmtBrl(descontoMetodoValor)})
                </div>
              )}
            </div>
            <div>
              <Label>Entrada (à vista, sem juros)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">R$</span>
                <Input
                  type="number" min={0} step="0.01"
                  value={entrada || ""}
                  onChange={(e) => setEntrada(Number(e.target.value) || 0)}
                  placeholder="0,00"
                  className="pl-9 text-right"
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                A entrada é abatida do total a negociar e não entra no cálculo de juros.<br />
                {_somaEntradasAdicionadas > 0 && (
                  <span className="block">Entradas já adicionadas: <b className="text-foreground">{fmtBrl(_somaEntradasAdicionadas)}</b></span>
                )}
                <span className="font-medium text-foreground">Restante a parcelar: {fmtBrl(Math.max(0, totalProposta - _somaEntradasAdicionadas - entrada))}</span>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md hover:shadow-lg transition-all font-semibold"
                onClick={aplicarEntrada}
                disabled={!entrada || entrada <= 0}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Adicionar entrada
              </Button>
              <div className="text-[10px] text-muted-foreground mt-1 text-center">
                Você pode adicionar quantas entradas precisar
              </div>
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
      <SenhaAdminDialog
        open={openSenha} onOpenChange={setOpenSenha}
        percent={descPerc} limite={meuLimite}
        onAuthorized={(adminEmail) => {
          setAutorizadoPorGestor(true);
          setAprovadorEmail(adminEmail);
          setDescPercAplicado(descPerc);
          setDescValorAplicado(descValor);
          // registra na timeline
          registrarAprovacao(adminEmail, descPerc, descValor);
        }}
      />
      <ResumoFinanceiroDialog
        open={openResumo} onOpenChange={setOpenResumo}
        valorInicial={valorInicial} descPerc={descPercAplicado} descValor={descValorAplicado}
        totalProposta={totalProposta}
        parceiroNome={parceiro?.nome} parceiroPerc={parceiroPerc} parceiroValor={parceiroValor}
        custoFabrica={custoFabricaTotal}
        jurosCliente={jurosCliente}
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
    </div>
  );
}

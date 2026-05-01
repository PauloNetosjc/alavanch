import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Calculator, Check, Plus, Printer, Save, CheckCircle2, Trash2, Eye,
  Lock, AlertTriangle, FileText, X as XIcon, Pencil, Banknote, DollarSign, ScrollText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClienteFormDialog, ClienteRow } from "@/components/clientes/ClienteFormDialog";
import { renderContratoHtml, type ContratoTemplate, type ContratoCtx } from "@/lib/contratoTemplate";

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

type Ambiente = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
  custo_aquisicao?: number | null;
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
};
type Metodo = { id: string; nome: string };
type Regra = { role: string; desconto_max_perc: number };

/* ========================== SENHA ADMIN DIALOG ========================== */
function SenhaAdminDialog({
  open, onOpenChange, percent, limite, onAuthorized,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  percent: number;
  limite: number;
  onAuthorized: () => void;
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
    onAuthorized();
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
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  valorInicial: number; descPerc: number; descValor: number; totalProposta: number;
  parceiroNome?: string; parceiroPerc: number; parceiroValor: number; custoFabrica: number;
  jurosCliente: number;
}) {
  const frete = totalProposta * 0.038;
  const comissaoLoja = totalProposta * 0.027;
  const montagem = totalProposta * 0.054;
  const impostos = totalProposta * 0.04;
  const outros = totalProposta * 0.01;
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
            {parceiroNome && (
              <Field label={`Indicador (${parceiroNome})`} color="#B83232"
                value={<>-{fmtBrl(parceiroValor)} <span className="text-[12px] text-muted-foreground">({parceiroPerc.toFixed(2)}%)</span></>} />
            )}
            <Field label="VPL (Valor Presente Líquido)" color="#16A34A" value={fmtBrl(totalVPL)} />
            <div>
              <div className="text-[12px] text-muted-foreground">Markup Médio</div>
              <div className="text-[20px] font-semibold text-emerald-600">{markup.toFixed(2)}x</div>
            </div>
            <div className="border-t border-border pt-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Cálculo:</div>
              <div className="text-[12px] text-muted-foreground">VPL ÷ Custo Base = Markup</div>
              <div className="text-[12px] text-muted-foreground">{fmtBrl(totalVPL)} ÷ {fmtBrl(custoFabrica)} = {markup.toFixed(2)}x</div>
            </div>
          </div>

          {/* COMPOSIÇÃO DE CUSTOS */}
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
  onConfirm: (obs: string) => void;
  loading: boolean;
}) {
  const [obs, setObs] = useState("");
  useEffect(() => { if (open) setObs(observacoesPadrao || ""); }, [open, observacoesPadrao]);
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
              Adicione observações ou cláusulas extras que devem aparecer no final do contrato.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Observações e informações adicionais</Label>
          <Textarea
            rows={8}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: Prazo de entrega de 45 dias úteis após assinatura do caderno técnico…"
          />
          <p className="text-[11px] text-muted-foreground">
            Estas observações aparecerão na seção "Observações e Informações Adicionais" do contrato.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(obs)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [parceiro, setParceiro] = useState<{ nome: string } | null>(null);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  // regras
  const [meuLimite, setMeuLimite] = useState<number>(0);
  const [autorizadoPorGestor, setAutorizadoPorGestor] = useState(false);

  // desconto (campos editados)
  const [descPerc, setDescPerc] = useState<number>(0);
  const [descValor, setDescValor] = useState<number>(0);
  // desconto aplicado (efetivo)
  const [descPercAplicado, setDescPercAplicado] = useState<number>(0);
  const [descValorAplicado, setDescValorAplicado] = useState<number>(0);

  // novo pagamento
  const [novoMetodo, setNovoMetodo] = useState("");
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novoParcelas, setNovoParcelas] = useState<number>(1);
  const [novoVenc, setNovoVenc] = useState<string>("");
  const [percRapido, setPercRapido] = useState<number>(25);

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
          .select("id, codigo, nome_projeto, subtotal, total, desconto_perc, desconto_valor, parceiro_perc, parceiro_id, status, cliente_id, cliente:clientes(*), parceiro:parceiros(nome)")
          .eq("id", id)
          .single(),
        supabase
          .from("ambientes")
          .select("id, nome, descricao, preco_sugerido, custo_aquisicao")
          .eq("orcamento_id", id)
          .order("ordem"),
        supabase.from("metodos_pagamento").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("pagamentos_orcamento")
          .select("id, metodo, valor, parcelas, data_vencimento")
          .eq("orcamento_id", id),
        supabase.auth.getUser(),
      ]);
      setOrc(o);
      setCliente((o?.cliente ?? null) as ClienteRow | null);
      setParceiro((o?.parceiro ?? null) as any);
      setAmbientes((amb ?? []) as Ambiente[]);
      setMetodos((m ?? []) as Metodo[]);
      setPagamentos((pgs ?? []) as Pagamento[]);

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

      // limite do usuário
      const userId = u?.user?.id;
      if (userId) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", userId);
        const { data: regras } = await supabase
          .from("regras_aprovacao").select("role, desconto_max_perc").eq("ativo", true);
        const meusRoles = (roles ?? []).map((r: any) => r.role);
        const max = (regras ?? [])
          .filter((r: Regra) => meusRoles.includes(r.role))
          .reduce((mx, r) => Math.max(mx, Number(r.desconto_max_perc) || 0), 0);
        setMeuLimite(max);
      }

      // Template de contrato (loja atual ou padrão global)
      const { data: tpls } = await supabase
        .from("contratos_template")
        .select("*")
        .eq("ativo", true)
        .order("loja_id", { nullsFirst: false });
      setTplContrato((tpls?.[0] ?? null) as ContratoTemplate | null);

      setLoading(false);
    })();
  }, [id]);

  /* --------------------------- derived --------------------------- */
  const subtotalAmbientes = useMemo(
    () => ambientes.reduce((s, a) => s + (Number(a.preco_sugerido) || 0), 0),
    [ambientes],
  );
  const parceiroPerc = Number(orc?.parceiro_perc) || 0;
  const parceiroValor = subtotalAmbientes * (parceiroPerc / 100);
  const valorInicial = subtotalAmbientes + parceiroValor;
  const totalProposta = Math.max(0, valorInicial - descValorAplicado);
  const totalAlocado = pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
  const restante = totalProposta - totalAlocado;
  const allocPerc = totalProposta > 0 ? Math.min(100, (totalAlocado / totalProposta) * 100) : 0;
  const custoFabricaTotal = useMemo(
    () => itens.reduce((s, it) => s + (Number(it.custo_fabrica) || 0) * (it.quantidade || 0), 0),
    [itens],
  );
  // Estimativa de juros do cliente: ~1.5% ao mês para parcelas > 1
  const jurosCliente = useMemo(() => {
    return pagamentos.reduce((s, p) => {
      if (!p.parcelas || p.parcelas <= 1) return s;
      const taxa = 0.015;
      const principal = p.valor / p.parcelas;
      // soma juros simples por parcela
      let total = 0;
      for (let i = 1; i < p.parcelas; i++) total += principal * taxa * i;
      return s + total;
    }, 0);
  }, [pagamentos]);

  /* ------------------------- handlers ------------------------- */
  const onPercChange = (v: number) => {
    setDescPerc(v);
    setDescValor(Number((valorInicial * (v / 100)).toFixed(2)));
  };
  const onValorChange = (v: number) => {
    setDescValor(v);
    setDescPerc(valorInicial > 0 ? Number(((v / valorInicial) * 100).toFixed(2)) : 0);
  };
  const acimaDoLimite = descPerc > meuLimite + 0.001;

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
  };

  const addPagamento = () => {
    if (!novoMetodo) return toast.error("Selecione o método");
    if (!novoValor || novoValor <= 0) return toast.error("Valor inválido");
    setPagamentos((p) => [
      ...p,
      { metodo: novoMetodo, valor: novoValor, parcelas: novoParcelas || 1, data_vencimento: novoVenc || null },
    ]);
    setNovoMetodo(""); setNovoValor(0); setNovoParcelas(1); setNovoVenc("");
  };
  const removePagamento = (idx: number) =>
    setPagamentos((p) => p.filter((_, i) => i !== idx));

  const aplicarRapido = (perc: number) => {
    setPercRapido(perc);
    setNovoValor(Number((restante * (perc / 100)).toFixed(2)));
  };

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
        })),
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

  const gerarContrato = async (observacoes: string) => {
    if (!orc || !id) return;
    setConfirmando(true);
    // garante que orçamento está atualizado e marcado como aprovado
    const ok = await persist("aprovado");
    if (!ok) { setConfirmando(false); return; }

    // Buscar dados da loja para empresa
    let empresa = { nome: "Planejados Pro", cnpj: "", endereco: "", telefone: "" };
    if (orc.loja_id) {
      const { data: loja } = await supabase.from("lojas").select("nome, cnpj, endereco, telefone").eq("id", orc.loja_id).maybeSingle();
      if (loja) empresa = { nome: loja.nome, cnpj: loja.cnpj || "", endereco: loja.endereco || "", telefone: loja.telefone || "" };
    }

    // Gera número de contrato no formato 133/2026
    const ano = new Date().getFullYear();
    const { count } = await supabase.from("contratos").select("id", { count: "exact", head: true });
    const numero = `${String((count ?? 0) + 1).padStart(3, "0")}/${ano}`;

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
    const origin = window.location.origin;
    const { data: created, error: e1 } = await supabase
      .from("contratos")
      .insert({
        numero,
        orcamento_id: id,
        cliente_id: orc.cliente_id,
        loja_id: orc.loja_id,
        template_id: tplContrato?.id,
        observacoes_adicionais: observacoes,
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
          observacoes_adicionais: observacoes,
        } as any,
      })
      .select("id, signing_token, numero")
      .single();

    setConfirmando(false);
    if (e1 || !created) { toast.error(e1?.message || "Erro ao criar contrato"); return; }

    // Atualiza signing_url no snapshot
    const signing_url = `${origin}/contrato/${created.signing_token}`;
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
    toast.success(`Contrato ${created.numero} gerado!`);
    navigate(`/contratos/${created.id}`);
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
        <div style="font-weight:600">Planejados Pro</div>
        <div class="muted">contato@planejadospro.com.br</div>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <div class="label">Cliente</div>
        <div><b>${cliente?.nome || "—"}</b></div>
        <div class="muted">${cliente?.cpf_cnpj || ""}</div>
        <div class="muted">${cliente?.email || ""} · ${cliente?.telefone || ""}</div>
        <div class="muted">${cliente?.endereco_cobranca || ""}</div>
      </div>
      <div class="box">
        <div class="label">Indicador / Comissão</div>
        <div>${parceiro?.nome || "—"}</div>
        <div class="muted">${parceiroPerc.toFixed(2)}% sobre subtotal · ${fmtBrl(parceiroValor)}</div>
      </div>
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
      ${parceiroPerc ? `<div class="row"><span>Indicador (${parceiroPerc.toFixed(2)}%)</span><b>+${fmtBrl(parceiroValor)}</b></div>` : ""}
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
      <div>Empresa<br/><span class="muted">Planejados Pro</span></div>
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
              <p className="text-[13px] text-muted-foreground mt-1.5">Ajuste valores e condições</p>
            </div>
          </div>

          <div className="space-y-3">
            {ambientes.map((a) => {
              const precoBase = Number(a.preco_sugerido) || 0;
              const fator = subtotalAmbientes > 0 ? precoBase / subtotalAmbientes : 0;
              const precoFinal = totalProposta * fator;
              const desconto = precoBase - precoFinal;
              return (
                <div key={a.id} className="border-2 border-emerald-100 rounded-lg px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold uppercase tracking-tight">{a.nome}</div>
                        {a.descricao && (
                          <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">- {a.descricao}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço</div>
                      {desconto > 0.01 ? (
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
              {pagamentos.map((p, idx) => (
                <div key={idx} className="border-2 border-emerald-100 rounded-lg p-3 flex items-center gap-3">
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
                    {p.data_vencimento && (
                      <div className="text-[12px] text-muted-foreground flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> {new Date(p.data_vencimento).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <div className="text-mono font-semibold text-[14px]">{fmtBrl(p.valor)}</div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePagamento(idx)}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
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
              <Select value={novoMetodo} onValueChange={setNovoMetodo}>
                <SelectTrigger><SelectValue placeholder="Selecione um método..." /></SelectTrigger>
                <SelectContent>
                  {metodos.map((m) => (
                    <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={novoVenc} onChange={(e) => setNovoVenc(e.target.value)} />
            </div>
            <div>
              <Label>Número de Parcelas</Label>
              <Select value={String(novoParcelas)} onValueChange={(v) => setNovoParcelas(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,8,10,12,18,24].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={novoValor || ""}
                onChange={(e) => setNovoValor(Number(e.target.value) || 0)} placeholder="0,00" />
            </div>
            <div>
              <div className="text-[12px] font-medium mb-1.5">Preencher rapidamente:</div>
              <div className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Slider value={[percRapido]} max={100} step={1} onValueChange={(v) => aplicarRapido(v[0])} className="flex-1" />
                  <div className="flex items-center gap-1 text-[12px]">
                    <Input type="number" min={0} max={100} className="h-7 w-14 text-right text-[12px]"
                      value={percRapido} onChange={(e) => aplicarRapido(Number(e.target.value) || 0)} />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {[10,20,30,40,50,100].map((p) => (
                    <button key={p} onClick={() => aplicarRapido(p)}
                      className="flex-1 px-1 py-1 text-[11px] rounded border border-border hover:bg-muted">
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={addPagamento} className="w-full bg-[#2D6BE5] hover:bg-[#2459C9] text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar Pagamento
            </Button>
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
        onAuthorized={() => {
          setAutorizadoPorGestor(true);
          setDescPercAplicado(descPerc);
          setDescValorAplicado(descValor);
        }}
      />
      <ResumoFinanceiroDialog
        open={openResumo} onOpenChange={setOpenResumo}
        valorInicial={valorInicial} descPerc={descPercAplicado} descValor={descValorAplicado}
        totalProposta={totalProposta}
        parceiroNome={parceiro?.nome} parceiroPerc={parceiroPerc} parceiroValor={parceiroValor}
        custoFabrica={custoFabricaTotal}
        jurosCliente={jurosCliente}
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
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Box, FileText, Upload, Plus, X, Eye, Trash2, ArrowRight, ArrowLeft,
  Check, AlertCircle, Loader2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { parsePromobTxt, PromobParseResult } from "@/lib/promobParser";
import { parseProjetoXml, parseProjetoExcel, ParseResult as GenericParseResult } from "@/lib/projetoImporter";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Cliente = { id: string; nome: string };
type Parceiro = { id: string; nome: string; percentual_padrao: number };
type Profile  = { user_id: string; nome_completo: string | null };

type Item = {
  descricao: string;
  quantidade: number;
  largura: number | null;
  altura: number | null;
  profundidade: number | null;
  custo_cliente: number;
  custo_loja: number;
  custo_fabrica: number;
  cor: string | null;
  categoria: string | null;
  codigo: string | null;
};
type Ambiente = {
  id: string;            // local id
  nome: string;
  descricao: string;
  prazo_dias: number | null;
  custo_aquisicao: number;   // custo total do ambiente (fábrica/aquisição)
  preco_sugerido: number;    // valor cliente
  markup: number;            // multiplicador (ex: 2 = 2x o custo)
  itens: Item[];
  manual?: boolean;
  aplicar_desconto?: boolean;  // se false, esse ambiente não recebe desconto na negociação
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const uid = () => Math.random().toString(36).slice(2, 9);

/* ------------------------- Step indicator (sidebar) ------------------------- */

function StepsCard({
  step, setStep, canGoTo, summary, title, adendoMode,
}: {
  step: number;
  setStep: (n: number) => void;
  canGoTo: (n: number) => boolean;
  summary: React.ReactNode;
  title?: string;
  adendoMode?: boolean;
}) {
  const items = [
    { n: 1, label: "Cliente" },
    { n: 2, label: adendoMode ? "Adendo" : "Ambientes" },
    { n: 3, label: "Resumo" },
  ];
  return (
    <div className="surface-card p-5 sticky top-4">
      <div className="text-[18px] font-semibold mb-4">{title || "Novo Orçamento"}</div>

      <div className="space-y-2 mb-5">
        {items.map((it) => {
          const active = step === it.n;
          const done = step > it.n;
          const enabled = canGoTo(it.n);
          return (
            <button
              key={it.n}
              disabled={!enabled}
              onClick={() => enabled && setStep(it.n)}
              className={[
                "w-full text-left px-4 py-3 rounded-lg text-[14px] font-medium transition",
                active
                  ? "bg-[#2D6BE5] text-white shadow-sm"
                  : done
                  ? "bg-[#F4F6FA] text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 disabled:opacity-50",
              ].join(" ")}
            >
              {String(it.n).padStart(2, "0")} {it.label}
              {done && <Check className="inline-block w-3.5 h-3.5 ml-2" />}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
          Resumo atual
        </div>
        {summary}
      </div>
    </div>
  );
}

/* ----------------------------- Parceiro dialog ----------------------------- */

function NovoParceiroDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (p: Parceiro) => void }) {
  const [nome, setNome] = useState("");
  const [perc, setPerc] = useState<number>(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setNome(""); setPerc(10); } }, [open]);

  const submit = async () => {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const { data, error } = await supabase
      .from("parceiros")
      .insert({ nome: nome.trim(), percentual_padrao: perc, ativo: true })
      .select("id, nome, percentual_padrao")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parceiro criado");
    onCreated(data as Parceiro);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Parceiro</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Comissão Padrão (%)</Label>
            <Input
              type="number" min={0} max={100} step={0.01}
              value={perc}
              onChange={(e) => setPerc(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Ambiente edit dialog -------------------------- */

function AmbienteEditDialog({
  open, onOpenChange, ambiente, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ambiente: Ambiente | null;
  onSave: (a: Ambiente) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState<string>("");
  const [semPrazo, setSemPrazo] = useState(false);

  useEffect(() => {
    if (ambiente) {
      setNome(ambiente.nome);
      setDescricao(ambiente.descricao || "");
      setPrazo(ambiente.prazo_dias?.toString() ?? "");
      setSemPrazo(ambiente.prazo_dias == null);
    }
  }, [ambiente, open]);

  if (!ambiente) return null;

  const confirm = () => {
    if (!nome.trim()) return toast.error("Nome do ambiente é obrigatório");
    onSave({
      ...ambiente,
      nome: nome.trim(),
      descricao,
      prazo_dias: semPrazo ? null : Number(prazo) || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Detalhes do Ambiente</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Ambiente *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Descrição do Ambiente</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Prazo de Entrega (dias úteis após assinatura) *</Label>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Checkbox checked={semPrazo} onCheckedChange={(v) => setSemPrazo(!!v)} />
                Sem prazo definido
              </label>
            </div>
            <Input
              type="number" min={0}
              disabled={semPrazo}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Revise os itens e especificações antes de confirmar
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Detalhamento dialog -------------------------- */

function DetalhamentoDialog({
  open, onOpenChange, ambiente, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ambiente: Ambiente | null;
  onSave: (id: string, itens: Item[]) => void;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [novoDesc, setNovoDesc] = useState("");
  const [novoQtd, setNovoQtd] = useState<number>(1);
  const [novoCusto, setNovoCusto] = useState<number>(0);
  const [novoVenda, setNovoVenda] = useState<number>(0);

  useEffect(() => {
    if (ambiente) setItens(ambiente.itens.map((i) => ({ ...i })));
  }, [ambiente?.id, open]);

  if (!ambiente) return null;

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };
  const addItem = () => {
    if (!novoDesc.trim()) return;
    setItens((prev) => [
      ...prev,
      {
        descricao: novoDesc.trim(),
        quantidade: novoQtd || 1,
        largura: null,
        altura: null,
        profundidade: null,
        custo_cliente: novoVenda || 0,
        custo_loja: novoCusto || 0,
        custo_fabrica: novoCusto || 0,
        cor: null,
        categoria: null,
        codigo: null,
      },
    ]);
    setNovoDesc(""); setNovoQtd(1); setNovoCusto(0); setNovoVenda(0);
  };

  const totalCusto = itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
  const totalVenda = itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0);

  const salvar = () => {
    onSave(ambiente.id, itens);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            Detalhamento: {ambiente.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="grid grid-cols-12 text-[11px] uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
            <div className="col-span-6">Descrição</div>
            <div className="col-span-1 text-center">Qtd</div>
            <div className="col-span-2 text-right">Custo</div>
            <div className="col-span-2 text-right">Venda</div>
            <div className="col-span-1"></div>
          </div>

          {itens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-[13px]">
              Nenhum item
            </div>
          ) : (
            <div className="divide-y divide-border">
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 py-2 items-center text-[13px] gap-1">
                  <div className="col-span-6">
                    <Input
                      value={it.descricao}
                      onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number" min={1}
                      value={it.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) || 0 })}
                      className="h-8 text-[13px] text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.01"
                      value={it.custo_loja}
                      onChange={(e) => updateItem(idx, {
                        custo_loja: Number(e.target.value) || 0,
                        custo_fabrica: Number(e.target.value) || 0,
                      })}
                      className="h-8 text-[13px] text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.01"
                      value={it.custo_cliente}
                      onChange={(e) => updateItem(idx, { custo_cliente: Number(e.target.value) || 0 })}
                      className="h-8 text-[13px] text-right"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar novo item */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Adicionar item
            </div>
            <div className="grid grid-cols-12 gap-1 items-center">
              <Input
                placeholder="Descrição"
                value={novoDesc}
                onChange={(e) => setNovoDesc(e.target.value)}
                className="col-span-6 h-9 text-[13px]"
              />
              <Input
                type="number" min={1} placeholder="Qtd"
                value={novoQtd || ""}
                onChange={(e) => setNovoQtd(Number(e.target.value) || 0)}
                className="col-span-1 h-9 text-[13px] text-center"
              />
              <Input
                type="number" step="0.01" placeholder="Custo"
                value={novoCusto || ""}
                onChange={(e) => setNovoCusto(Number(e.target.value) || 0)}
                className="col-span-2 h-9 text-[13px] text-right"
              />
              <Input
                type="number" step="0.01" placeholder="Venda"
                value={novoVenda || ""}
                onChange={(e) => setNovoVenda(Number(e.target.value) || 0)}
                className="col-span-2 h-9 text-[13px] text-right"
              />
              <Button size="icon" className="col-span-1 h-9 w-full" onClick={addItem}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between gap-4">
          <div className="text-[13px] flex items-center gap-6">
            <div>
              <span className="text-muted-foreground">Custo: </span>
              <span className="text-foreground text-mono font-medium">{fmtBrl(totalCusto)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Venda: </span>
              <span className="text-foreground text-mono font-semibold">{fmtBrl(totalVenda)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== MAIN COMPONENT ============================ */

export default function ComercialNovo() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const preselectCliente = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("cliente") : null;
  const { role } = usePermissions();
  const podeVerCusto = role === "admin" || role === "diretor";
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [orcCodigo, setOrcCodigo] = useState<string>("");

  // ---- catálogos ----
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [origens, setOrigens] = useState<{ id: string; nome: string }[]>([]);
  const [pedidosExistentes, setPedidosExistentes] = useState<{ id: string; codigo: string; cliente_id: string | null; nome_projeto: string | null }[]>([]);
  const [usarMarkup, setUsarMarkup] = useState<boolean>(false);

  // ---- step 1 ----
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [clienteId, setClienteId] = useState<string>(preselectCliente || "");
  const [clienteFinal, setClienteFinal] = useState<string>("");
  const [parceiroId, setParceiroId] = useState<string>("");
  const [parceiroPerc, setParceiroPerc] = useState<number>(0);
  const [projetistaId, setProjetistaId] = useState<string>("");
  const [origemId, setOrigemId] = useState<string>("");
  const [consultorId, setConsultorId] = useState<string>("");
  const [tipoOrcamento, setTipoOrcamento] = useState<"pedido" | "adendo" | "complemento">("pedido");
  const [pedidoPaiId, setPedidoPaiId] = useState<string>("");
  const { profile } = useAuth();
  const { lojas, selectedLojaId } = useLoja();
  const isAdmin = role === "admin" || role === "diretor";
  const [lojaId, setLojaId] = useState<string>("");

  // dialog flags
  const [openCliente, setOpenCliente] = useState(false);
  const [openParceiro, setOpenParceiro] = useState(false);

  // ---- step 2 ----
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [importing, setImporting] = useState(false);
  const [ambEdit, setAmbEdit] = useState<Ambiente | null>(null);
  const [ambDetail, setAmbDetail] = useState<Ambiente | null>(null);
  // arquivos importados pendentes de upload (após criação do orçamento)
  const [arquivosImportados, setArquivosImportados] = useState<{ file: File; origem: string }[]>([]);

  // ---- adendo (modo financeiro: sem ambientes, apenas descrição + valor + tipo) ----
  const isAdendo = tipoOrcamento === "adendo";
  const [pedidoOrigemId, setPedidoOrigemId] = useState<string | null>(null);
  const [adendoDescricao, setAdendoDescricao] = useState("");
  const [adendoValor, setAdendoValor] = useState<number>(0);
  const [adendoTipo, setAdendoTipo] = useState<"receber" | "pagar">("receber");


  // ---- manual add form ----
  const [mNome, setMNome] = useState("");
  const [mDescricao, setMDescricao] = useState("");
  const [mVenda, setMVenda] = useState<string>("");


  /* --------------------------------- load --------------------------------- */
  useEffect(() => {
    (async () => {
      const [c, p, pr, og, peds, cfg] = await Promise.all([
        supabase.from("clientes").select("id, nome").order("nome"),
        supabase.from("parceiros").select("id, nome, percentual_padrao").eq("ativo", true).order("nome"),
        supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
        supabase.from("origens_lead").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("pedidos").select("id, codigo, cliente_id, orcamentos:orcamento_id(nome_projeto)").order("created_at", { ascending: false }).limit(500),
        supabase.from("configuracoes_empresa" as any).select("usar_markup").limit(1).maybeSingle(),
      ]);
      setClientes((c.data ?? []) as Cliente[]);
      setParceiros((p.data ?? []) as Parceiro[]);
      setProfiles((pr.data ?? []) as Profile[]);
      setOrigens((og.data ?? []) as any);
      setPedidosExistentes(((peds.data ?? []) as any[]).map((p) => ({ id: p.id, codigo: p.codigo, cliente_id: p.cliente_id, nome_projeto: p.orcamentos?.nome_projeto ?? null })));
      setUsarMarkup(!!(cfg.data as any)?.usar_markup);
      // defaults em criação: consultor=usuário, projetista=usuário, loja=loja selecionada no topo (ou do usuário)
      if (!isEdit) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) { setConsultorId(u.user.id); setProjetistaId(u.user.id); }
        const defaultLoja = selectedLojaId || profile?.loja_id;
        if (defaultLoja) setLojaId(defaultLoja);
      }
    })();
  }, [isEdit, profile?.loja_id, selectedLojaId]);

  // Auto-prefill origem ao escolher cliente (ex: cliente veio de uma apresentação agendada)
  useEffect(() => {
    if (!clienteId || origemId) return;
    (async () => {
      const { data } = await supabase.from("clientes").select("origem_id").eq("id", clienteId).maybeSingle();
      if ((data as any)?.origem_id) setOrigemId((data as any).origem_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  /* ------------------------- load existing orçamento ---------------------- */
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: orc } = await supabase
        .from("orcamentos")
        .select("id, codigo, cliente_id, nome_projeto, parceiro_id, parceiro_perc, consultor_id, is_adendo, loja_id, pedido_origem_id, adendo_descricao, adendo_tipo, total")
        .eq("id", editId)
        .maybeSingle();
      if (!orc) { toast.error("Orçamento não encontrado"); navigate("/comercial"); return; }
      // Bloqueia edição de orçamento que já virou pedido (exceto adendos)
      if (!(orc as any).is_adendo) {
        const { data: pedidoExistente } = await supabase
          .from("pedidos").select("id").eq("orcamento_id", editId).maybeSingle();
        if (pedidoExistente) {
          toast.error("Este orçamento já virou venda. Edições devem ser feitas via Adendo.");
          navigate(`/pedidos/${pedidoExistente.id}`);
          return;
        }
      }
      setOrcCodigo(orc.codigo || "");
      setClienteId(orc.cliente_id || "");
      setNomeProjeto(orc.nome_projeto || "");
      setParceiroId(orc.parceiro_id || "");
      setParceiroPerc(Number(orc.parceiro_perc) || 0);
      setConsultorId(orc.consultor_id || "");
      setLojaId((orc as any).loja_id || profile?.loja_id || "");
      setTipoOrcamento((orc as any).is_adendo ? "adendo" : (orc as any).is_complemento ? "complemento" : "pedido");
      setClienteFinal((orc as any).cliente_final || "");
      setProjetistaId((orc as any).projetista_id || "");
      setOrigemId((orc as any).origem_id || "");
      setPedidoPaiId((orc as any).pedido_origem_id || (orc as any).pedido_origem_complemento_id || "");
      setPedidoOrigemId((orc as any).pedido_origem_id || null);
      setAdendoDescricao((orc as any).adendo_descricao || "");
      setAdendoTipo(((orc as any).adendo_tipo as any) || "receber");
      setAdendoValor(Number((orc as any).total) || 0);

      if ((orc as any).is_adendo) {
        // Adendos não carregam ambientes
        return;
      }


      const { data: ambs } = await supabase
        .from("ambientes")
        .select("id, nome, descricao, prazo_dias, custo_aquisicao, preco_sugerido, markup, ordem, aplicar_desconto")
        .eq("orcamento_id", editId)
        .order("ordem");
      const ambIds = (ambs ?? []).map((a: any) => a.id);
      let itensByAmb: Record<string, Item[]> = {};
      if (ambIds.length) {
        const { data: subs } = await supabase
          .from("sub_itens_ambiente")
          .select("ambiente_id, descricao, quantidade, largura, altura, profundidade, custo_cliente, custo_loja, custo_fabrica, cor, categoria, codigo")
          .in("ambiente_id", ambIds);
        (subs ?? []).forEach((s: any) => {
          (itensByAmb[s.ambiente_id] ||= []).push({
            descricao: s.descricao, quantidade: s.quantidade,
            largura: s.largura, altura: s.altura, profundidade: s.profundidade,
            custo_cliente: Number(s.custo_cliente) || 0,
            custo_loja: Number(s.custo_loja) || 0,
            custo_fabrica: Number(s.custo_fabrica) || 0,
            cor: s.cor, categoria: s.categoria, codigo: s.codigo,
          });
        });
      }
      setAmbientes((ambs ?? []).map((a: any) => ({
        id: a.id, nome: a.nome, descricao: a.descricao || "",
        prazo_dias: a.prazo_dias,
        custo_aquisicao: Number(a.custo_aquisicao) || 0,
        preco_sugerido: Number(a.preco_sugerido) || 0,
        markup: Number(a.markup) || 0,
        itens: itensByAmb[a.id] || [],
        aplicar_desconto: a.aplicar_desconto !== false,
      })));
    })();
  }, [editId, navigate]);

  /* --------------------------- totals (derived) --------------------------- */
  const subtotalAmbientes = useMemo(
    () => isAdendo ? (adendoValor || 0) : ambientes.reduce((s, a) => s + (a.preco_sugerido || 0), 0),
    [ambientes, isAdendo, adendoValor],
  );
  const acrescimoParceiro = useMemo(
    () => subtotalAmbientes * ((parceiroPerc || 0) / 100),
    [subtotalAmbientes, parceiroPerc],
  );
  const total = subtotalAmbientes + acrescimoParceiro;

  /* ----------------------------- step 1 helpers --------------------------- */
  const cliente = clientes.find((c) => c.id === clienteId);
  const parceiro = parceiros.find((p) => p.id === parceiroId);
  const consultor = profiles.find((p) => p.user_id === consultorId);

  const onSelectParceiro = (id: string) => {
    setParceiroId(id);
    const p = parceiros.find((pp) => pp.id === id);
    if (p) setParceiroPerc(Number(p.percentual_padrao) || 0);
  };

  const canNext1 = !!clienteId;
  const canNext2 = isAdendo
    ? (adendoDescricao.trim().length > 0 && (adendoValor || 0) > 0 && !!adendoTipo)
    : ambientes.length > 0;
  const canGoTo = (n: number) => {
    if (n === 1) return true;
    if (n === 2) return canNext1;
    if (n === 3) return canNext1 && canNext2;
    return false;
  };


  /* ----------------------------- step 2: import -------------------------- */
  const aiDescribe = async (nome: string, itens: Item[]): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("describe-ambiente", {
        body: { nome, itens: itens.slice(0, 40) },
      });
      if (error) return "";
      return (data as any)?.description ?? "";
    } catch {
      return "";
    }
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    const ext0 = file.name.toLowerCase().split(".").pop() || "";
    const origem = ext0 === "txt" ? "promob_import" : ext0 === "xml" ? "xml_import" : (ext0 === "xlsx" || ext0 === "xls") ? "excel_import" : "upload";
    setArquivosImportados((prev) => [...prev, { file, origem }]);
    try {
      const ext = file.name.toLowerCase().split(".").pop() || "";
      // Caminho 1: TXT/XML do Promob (parser específico)
      if (ext === "txt") {
        const text = await file.text();
        const parsed: PromobParseResult = parsePromobTxt(text);
        if (parsed.environments.length === 0) {
          toast.error("Nenhum ambiente identificado no arquivo");
          return;
        }
        const novos: Ambiente[] = await Promise.all(
          parsed.environments.map(async (env) => {
            const itens: Item[] = env.items.map((it) => ({
              descricao: it.description,
              quantidade: it.quantity,
              largura: it.width,
              altura: it.height,
              profundidade: it.depth,
              custo_cliente: it.clientPrice,
              custo_loja: it.storePrice,
              custo_fabrica: it.factoryPrice,
              cor: it.finish || null,
              categoria: it.category || null,
              codigo: it.projectRef || null,
            }));
            const custo = itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
            const preco = itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0);
            const markup = custo > 0 ? preco / custo : 0;
            const descricao = await aiDescribe(env.name, itens);
            return { id: uid(), nome: env.name, descricao, prazo_dias: null, custo_aquisicao: custo, preco_sugerido: preco, markup: Number(markup.toFixed(2)), itens };
          }),
        );
        setAmbientes((prev) => [...prev, ...novos]);
        if (!nomeProjeto && parsed.header.clientName) setNomeProjeto(parsed.header.clientName);
        toast.success(`${novos.length} ambientes importados!`);
        parsed.warnings.forEach((w) => toast.warning(w));
        return;
      }

      // Caminho 2: XML ou Excel genérico
      let result: GenericParseResult;
      if (ext === "xml") {
        const text = await file.text();
        result = parseProjetoXml(text);
      } else if (ext === "xlsx" || ext === "xls") {
        result = await parseProjetoExcel(file);
      } else {
        toast.error("Formato não suportado. Use TXT, XML ou XLSX.");
        return;
      }

      const novos: Ambiente[] = result.environments.map((env) => {
        const itens: Item[] = env.items.map((it) => ({
          descricao: it.description,
          quantidade: it.quantity,
          largura: null, altura: null, profundidade: null,
          custo_cliente: it.clientPrice || it.cost,
          custo_loja: it.cost,
          custo_fabrica: it.cost,
          cor: null, categoria: null, codigo: null,
        }));
        const custo = itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
        const preco = itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0);
        const markup = custo > 0 ? preco / custo : 0;
        return { id: uid(), nome: env.name, descricao: "", prazo_dias: null, custo_aquisicao: custo, preco_sugerido: preco, markup: Number(markup.toFixed(2)), itens };
      });
      setAmbientes((prev) => [...prev, ...novos]);
      toast.success(`${novos.length} ambientes importados de ${ext.toUpperCase()}!`);
    } catch (e: any) {
      toast.error("Falha ao ler arquivo: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const addManualAmbiente = () => {
    if (!mNome.trim()) return toast.error("Nome do ambiente é obrigatório");
    const venda = Number(mVenda) || 0;
    const novo: Ambiente = {
      id: uid(),
      nome: mNome.trim(),
      descricao: mDescricao,
      prazo_dias: null,
      custo_aquisicao: 0,
      preco_sugerido: venda,
      markup: 0,
      itens: [],
      manual: true,
    };
    setAmbientes((prev) => [...prev, novo]);
    setMNome(""); setMDescricao(""); setMVenda("");
    toast.success("Ambiente adicionado");
  };

  const updateAmbiente = (id: string, patch: Partial<Ambiente>) => {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  // sync: markup é multiplicador (ex: 2 => preço = 2 * custo)
  const onChangeMarkup = (a: Ambiente, markup: number) => {
    const preco = a.custo_aquisicao * markup;
    updateAmbiente(a.id, { markup, preco_sugerido: Number(preco.toFixed(2)) });
  };
  const onChangePreco = (a: Ambiente, preco: number) => {
    const markup = a.custo_aquisicao > 0 ? preco / a.custo_aquisicao : 0;
    updateAmbiente(a.id, { preco_sugerido: preco, markup: Number(markup.toFixed(2)) });
  };

  const removeAmbiente = (id: string) =>
    setAmbientes((prev) => prev.filter((a) => a.id !== id));

  /* --------------------------------- finish ------------------------------- */
  const finish = async (goToNegociacao = false) => {
    setSaving(true);

    let orcId = editId || "";
    let codigo = orcCodigo;

    const isComplemento = tipoOrcamento === "complemento";

    if (isEdit && editId) {
      const { error: upErr } = await supabase
        .from("orcamentos")
        .update({
          cliente_id: clienteId,
          nome_projeto: nomeProjeto || null,
          parceiro_id: parceiroId || null,
          parceiro_perc: parceiroPerc || 0,
          consultor_id: consultorId || null,
          projetista_id: projetistaId || null,
          origem_id: origemId || null,
          cliente_final: clienteFinal || null,
          loja_id: lojaId || null,
          subtotal: subtotalAmbientes,
          total,
          is_adendo: isAdendo,
          is_complemento: isComplemento,
          pedido_origem_id: isAdendo ? (pedidoPaiId || null) : null,
          pedido_origem_complemento_id: isComplemento ? (pedidoPaiId || null) : null,
          adendo_descricao: isAdendo ? adendoDescricao : null,
          adendo_tipo: isAdendo ? adendoTipo : null,
        } as any)
        .eq("id", editId);
      if (upErr) { setSaving(false); return toast.error(upErr.message); }

      if (!isAdendo) {
        // Reset ambientes (cascade remove sub_itens via FK)
        await supabase.from("ambientes").delete().eq("orcamento_id", editId);
      }
    } else {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("orcamentos")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${year}-01-01`);
      codigo = `ORC-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const { data: orc, error } = await supabase
        .from("orcamentos")
        .insert({
          codigo,
          cliente_id: clienteId,
          nome_projeto: nomeProjeto || null,
          parceiro_id: parceiroId || null,
          parceiro_perc: parceiroPerc || 0,
          consultor_id: consultorId || null,
          projetista_id: projetistaId || null,
          origem_id: origemId || null,
          cliente_final: clienteFinal || null,
          loja_id: lojaId || null,
          subtotal: subtotalAmbientes,
          desconto_perc: 0,
          desconto_valor: 0,
          total,
          status: "negociacao",
          is_adendo: isAdendo,
          is_complemento: isComplemento,
          pedido_origem_id: isAdendo ? (pedidoPaiId || null) : null,
          pedido_origem_complemento_id: isComplemento ? (pedidoPaiId || null) : null,
          adendo_descricao: isAdendo ? adendoDescricao : null,
          adendo_tipo: isAdendo ? adendoTipo : null,
        } as any)
        .select("id")
        .single();

      if (error || !orc) {
        setSaving(false);
        return toast.error(error?.message ?? "Erro ao salvar");
      }
      orcId = orc.id;
      try {
        const { dispatchKanbanTrigger } = await import("@/lib/kanbanTriggers");
        await dispatchKanbanTrigger("orcamento_criado", { orcamentoId: orcId });
      } catch {}
    }

    if (!isAdendo) {
      for (let i = 0; i < ambientes.length; i++) {
        const a = ambientes[i];
        const { data: amb } = await supabase
          .from("ambientes")
          .insert({
            orcamento_id: orcId,
            nome: a.nome,
            descricao: a.descricao || null,
            ordem: i,
            prazo_dias: a.prazo_dias,
            custo_fabrica: a.itens.reduce((s, it) => s + it.custo_fabrica * it.quantidade, 0),
            custo_loja: a.itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0),
            custo_aquisicao: a.custo_aquisicao,
            preco_sugerido: a.preco_sugerido,
            markup: a.markup,
            aplicar_desconto: a.aplicar_desconto !== false,
          } as any)
          .select("id")
          .single();
        if (amb && a.itens.length > 0) {
          await supabase.from("sub_itens_ambiente").insert(
            a.itens.map((it) => ({
              ambiente_id: amb.id,
              descricao: it.descricao,
              quantidade: it.quantidade,
              largura: it.largura,
              altura: it.altura,
              profundidade: it.profundidade,
              custo_cliente: it.custo_cliente,
              custo_loja: it.custo_loja,
              custo_fabrica: it.custo_fabrica,
              cor: it.cor,
              categoria: it.categoria,
              codigo: it.codigo,
            })),
          );
        }
      }
    }


    // Upload de arquivos importados (Promob/XML/Excel) para a Central de Documentos do orçamento
    if (arquivosImportados.length > 0) {
      const { data: u } = await supabase.auth.getUser();
      for (const { file, origem } of arquivosImportados) {
        const path = `${orcId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("orcamento-docs").upload(path, file);
        if (!upErr) {
          await supabase.from("orcamento_documentos" as any).insert({
            orcamento_id: orcId,
            nome: file.name,
            storage_path: path,
            tamanho: file.size,
            mime_type: file.type || null,
            origem,
            created_by: u.user?.id || null,
          });
        }
      }
      setArquivosImportados([]);
    }

    setSaving(false);
    toast.success(isEdit ? `Orçamento ${codigo || ""} atualizado` : `Orçamento ${codigo} criado`);
    if (goToNegociacao) navigate(`/comercial/${orcId}/negociacao`);
    else navigate(`/comercial`);
  };

  /* ------------------------------ summary side ---------------------------- */
  const summary = (
    <div className="space-y-3 text-[13px]">
      {nomeProjeto && (
        <div>
          <div className="text-muted-foreground text-[11px]">Nome do Projeto</div>
          <div className="font-medium">{nomeProjeto}</div>
        </div>
      )}
      {cliente && (
        <div>
          <div className="text-muted-foreground text-[11px]">Cliente</div>
          <div className="font-semibold">{cliente.nome}</div>
        </div>
      )}
      {parceiro && (
        <div>
          <div className="text-muted-foreground text-[11px]">Parceiro</div>
          <div className="font-semibold">{parceiro.nome}</div>
        </div>
      )}
      {projetistaId && (
        <div>
          <div className="text-muted-foreground text-[11px]">Projetista</div>
          <div className="font-semibold">{profiles.find((p) => p.user_id === projetistaId)?.nome_completo ?? "—"}</div>
        </div>
      )}
      {consultor && (
        <div>
          <div className="text-muted-foreground text-[11px]">Consultor</div>
          <div className="font-semibold">{consultor.nome_completo ?? "—"}</div>
        </div>
      )}
      {isAdendo && (
        <>
          <div>
            <div className="text-muted-foreground text-[11px]">Tipo</div>
            <div className="font-semibold">Adendo financeiro ({adendoTipo === "pagar" ? "a pagar" : "a receber"})</div>
          </div>
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between font-semibold text-[15px]">
              <span>Valor</span>
              <span className="text-mono">{fmtBrl(total)}</span>
            </div>
          </div>
        </>
      )}
      {!isAdendo && ambientes.length > 0 && (
        <>
          <div>
            <div className="text-muted-foreground text-[11px]">Ambientes</div>
            <div className="font-semibold">{ambientes.length} importados</div>
          </div>
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-mono text-foreground">{fmtBrl(subtotalAmbientes)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 text-[15px]">
              <span>Total</span>
              <span className="text-mono">{fmtBrl(total)}</span>
            </div>
          </div>
        </>
      )}

    </div>
  );

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-3">
        <StepsCard step={step} setStep={setStep} canGoTo={canGoTo} summary={summary} title={isEdit ? `Editar ${orcCodigo || "Orçamento"}` : "Novo Orçamento"} adendoMode={isAdendo} />
      </div>

      <div className="col-span-12 md:col-span-9 space-y-6">
        {/* ============================ STEP 1 ============================ */}
        {step === 1 && (
          <div className="surface-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#EAF2FB", border: "1px solid #D6E4F5" }}
              >
                <User className="w-6 h-6" style={{ color: "#3B6FB0" }} />
              </div>
              <div>
                <h1 className="text-[26px] font-semibold leading-none">Selecione o Cliente</h1>
                <p className="text-[13px] text-muted-foreground mt-1.5">
                  Informações básicas do orçamento
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label>Nome do Projeto</Label>
                <Input
                  value={nomeProjeto}
                  onChange={(e) => setNomeProjeto(e.target.value)}
                  placeholder="Digite o nome do projeto (opcional)"
                />
              </div>

              {/* Loja */}
              <div>
                <Label>Loja</Label>
                {isAdmin ? (
                  <Select value={lojaId} onValueChange={setLojaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>
                      {lojas.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={lojas.find((l) => l.id === lojaId)?.nome || "—"} disabled />
                )}
                <p className="text-[11px] text-muted-foreground mt-1">Padrão: loja do usuário logado</p>
              </div>

              {/* Cliente */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="!mb-0">Cliente</Label>
                  <button
                    onClick={() => setOpenCliente(true)}
                    className="text-[12px] text-[#2D6BE5] font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Novo Cliente
                  </button>
                </div>
                {clienteId ? (
                  <div className="flex items-center justify-between border border-input rounded-md px-3 py-2.5 text-[14px]">
                    <span>{cliente?.nome}</span>
                    <button onClick={() => setClienteId("")} className="text-rose-500 hover:text-rose-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <ComboInput
                    placeholder="Selecione ou digite o nome do cliente"
                    options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                    onPick={(id) => setClienteId(id)}
                  />
                )}
              </div>

              {/* Indicador / Parceiro */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="!mb-0">Indicador (Opcional)</Label>
                  <button
                    onClick={() => setOpenParceiro(true)}
                    className="text-[12px] text-[#2D6BE5] font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Novo Parceiro
                  </button>
                </div>
                {parceiroId ? (
                  <>
                    <div className="flex items-center justify-between border border-input rounded-md px-3 py-2.5 text-[14px]">
                      <span>{parceiro?.nome}</span>
                      <button onClick={() => { setParceiroId(""); setParceiroPerc(0); }} className="text-rose-500 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <details className="mt-2 group">
                      <summary className="flex items-center justify-between border border-input rounded-md px-3 py-2 text-[13px] cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-muted/40">
                        <span className="text-muted-foreground">Ind do Parceiro</span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 flex items-center gap-2 border border-input rounded-md px-3 py-2.5">
                        <span className="text-[13px] text-muted-foreground">Ind do Parceiro:</span>
                        <Input
                          type="number" min={0} max={100} step={0.01}
                          value={parceiroPerc}
                          onChange={(e) => setParceiroPerc(Number(e.target.value) || 0)}
                          className="w-24 h-8"
                        />
                        <span className="text-[13px] text-muted-foreground">%</span>
                      </div>
                    </details>
                  </>
                ) : (
                  <ComboInput
                    placeholder="Selecione ou digite o nome do parceiro"
                    options={parceiros.map((p) => ({ value: p.id, label: p.nome }))}
                    onPick={onSelectParceiro}
                  />
                )}
              </div>

              {/* Cliente Final (apelido / quem usará) */}
              <div>
                <Label>Cliente Final (Opcional)</Label>
                <Input
                  value={clienteFinal}
                  onChange={(e) => setClienteFinal(e.target.value)}
                  placeholder="Quem efetivamente utilizará — aparece no resumo do pedido"
                />
              </div>

              {/* Origem do Cliente */}
              <div>
                <Label>Origem do Cliente</Label>
                <Select value={origemId || "none"} onValueChange={(v) => setOrigemId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Como o cliente chegou até nós?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem origem —</SelectItem>
                    {origens.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Orçamento */}
              <div>
                <Label>Tipo de Orçamento</Label>
                <Select value={tipoOrcamento} onValueChange={(v) => { setTipoOrcamento(v as any); if (v === "pedido") setPedidoPaiId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pedido">Pedido (PV)</SelectItem>
                    <SelectItem value="adendo">Adendo (AD) — formalização financeira</SelectItem>
                    <SelectItem value="complemento">Complemento (CP) — novo pedido</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {tipoOrcamento === "adendo" && "Adendo gera apenas lançamento financeiro vinculado ao pedido pai."}
                  {tipoOrcamento === "complemento" && "Complemento gera um novo pedido referenciando o original."}
                  {tipoOrcamento === "pedido" && "Pedido normal com ambientes."}
                </p>
              </div>

              {/* Pedido pai (somente para adendo / complemento) */}
              {tipoOrcamento !== "pedido" && (
                <div>
                  <Label>Pedido de Origem</Label>
                  {pedidoPaiId ? (
                    (() => {
                      const ped = pedidosExistentes.find((p) => p.id === pedidoPaiId);
                      return (
                        <div className="flex items-center justify-between border border-input rounded-md px-3 py-2.5 text-[14px]">
                          <span className="truncate">
                            <span className="font-medium">{ped?.codigo ?? "—"}</span>
                            {ped?.nome_projeto && <span className="text-muted-foreground"> · {ped.nome_projeto}</span>}
                          </span>
                          <button onClick={() => setPedidoPaiId("")} className="text-rose-500 hover:text-rose-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <ComboInput
                      placeholder="Buscar por nº de contrato ou nome do projeto"
                      options={pedidosExistentes
                        .map((p) => ({ value: p.id, label: p.nome_projeto ? `${p.codigo} · ${p.nome_projeto}` : p.codigo }))}
                      onPick={setPedidoPaiId}
                    />
                  )}
                </div>
              )}

              {/* Projetista */}
              <div>
                <Label>Projetista (Opcional)</Label>
                <Select value={projetistaId || "none"} onValueChange={(v) => setProjetistaId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o projetista" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem projetista —</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo ?? "—"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Padrão: usuário logado</p>
              </div>

              {/* Consultor */}
              <div>
                <Label>Consultor (Opcional)</Label>
                {consultorId ? (
                  <div className="flex items-center justify-between border border-input rounded-md px-3 py-2.5 text-[14px]">
                    <span>{consultor?.nome_completo ?? "Eu"}</span>
                    <button onClick={() => setConsultorId("")} className="text-rose-500 hover:text-rose-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <ComboInput
                    placeholder="Selecione um consultor"
                    options={profiles.map((p) => ({ value: p.user_id, label: p.nome_completo ?? "—" }))}
                    onPick={(id) => setConsultorId(id)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================ STEP 2 ============================ */}
        {step === 2 && isAdendo && (
          <div className="surface-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#FDF4E2", border: "1px solid #F3E5BF" }}
              >
                <FileText className="w-6 h-6" style={{ color: "#B8893B" }} />
              </div>
              <div>
                <h1 className="text-[26px] font-semibold leading-none">Adendo Financeiro</h1>
                <p className="text-[13px] text-muted-foreground mt-1.5">
                  Adendos não geram pedido de peças — apenas formalizam diferenças financeiras vinculadas ao pedido original.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label>Descrição do Adendo</Label>
                <Textarea
                  value={adendoDescricao}
                  onChange={(e) => setAdendoDescricao(e.target.value)}
                  placeholder="Ex.: Este adendo é referente ao pedido PV-LOJ-0003 por diferença de acabamento no ambiente Cozinha…"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={adendoTipo} onValueChange={(v) => setAdendoTipo(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receber">A receber do cliente</SelectItem>
                      <SelectItem value="pagar">A pagar ao cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={adendoValor || ""}
                    onChange={(e) => setAdendoValor(Number(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
                Este adendo seguirá direto para o <b>painel financeiro</b>. Não passa pelos pipelines de fábrica/montagem/pós-venda.
              </div>
            </div>
          </div>
        )}

        {step === 2 && !isAdendo && (
          <>

            <div className="surface-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#F4ECF7", border: "1px solid #E5D6EE" }}
                >
                  <Box className="w-6 h-6" style={{ color: "#7E4FA0" }} />
                </div>
                <div>
                  <h1 className="text-[26px] font-semibold leading-none">Adicione Ambientes</h1>
                  <p className="text-[13px] text-muted-foreground mt-1.5">
                    Importe XML do Promob ou adicione manualmente
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Importar */}
                <div className="rounded-lg border border-border p-5">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-4">
                    <Upload className="w-4 h-4 text-[#2D6BE5]" />
                    Importar projeto (TXT, XML ou Excel)
                  </div>
                  <label className="block border-2 border-dashed border-[#D6E4F5] rounded-lg py-10 px-4 cursor-pointer hover:bg-[#F8FAFD] transition text-center">
                    <input
                      type="file" accept=".txt,.xml,.xlsx,.xls" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    <div className="w-12 h-12 rounded-full bg-[#EAF2FB] flex items-center justify-center mx-auto mb-3">
                      {importing ? (
                        <Loader2 className="w-5 h-5 text-[#2D6BE5] animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-[#2D6BE5]" />
                      )}
                    </div>
                    <div className="text-[14px] font-medium text-[#2D6BE5]">
                      {importing ? "Processando…" : "Arraste ou clique para importar TXT, XML ou Excel"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      .txt (Promob), .xml ou .xlsx
                    </div>
                  </label>
                </div>

                {/* Manual */}
                <div className="rounded-lg border border-border p-5">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-4">
                    <Plus className="w-4 h-4 text-[#2D6BE5]" />
                    Adicionar Ambiente Manual
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome do Ambiente</Label>
                      <Input value={mNome} onChange={(e) => setMNome(e.target.value)} placeholder="Digite o nome" />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Input value={mDescricao} onChange={(e) => setMDescricao(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div>
                      <Label>Valor de Venda</Label>
                      <Input
                        type="number" step="0.01"
                        value={mVenda}
                        onChange={(e) => setMVenda(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <Button onClick={addManualAmbiente} className="w-full">
                      <Plus className="w-4 h-4 mr-1.5" /> Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela ambientes */}
            <div className="surface-card p-0 overflow-hidden">
              {ambientes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-[13px]">
                  Nenhum ambiente adicionado ainda.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-3">Projeto / Ambiente</th>
                      {podeVerCusto && <th className="text-center px-2 py-3 w-[110px]">Markup (x)</th>}
                      <th className="text-right px-2 py-3 w-[170px]">Preço Sugerido</th>
                      <th className="text-center px-2 py-3 w-[90px]" title="Recebe desconto na negociação">Desconto</th>
                      <th className="text-right px-4 py-3 w-[110px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientes.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-700">{a.nome}</div>
                          {a.descricao && (
                            <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                              - {a.descricao}
                            </div>
                          )}
                        </td>
                        {podeVerCusto && (
                          <td className="px-2 py-3 text-center">
                            <Input
                              type="number" step="0.01"
                              value={a.markup}
                              onChange={(e) => onChangeMarkup(a, Number(e.target.value) || 0)}
                              className="h-9 text-center text-[#2D6BE5] border-[#D6E4F5]"
                            />
                          </td>
                        )}
                        <td className="px-2 py-3 text-right">
                          <Input
                            type="number" step="0.01"
                            value={a.preco_sugerido}
                            onChange={(e) => onChangePreco(a, Number(e.target.value) || 0)}
                            className="h-9 text-right text-mono border-emerald-200 focus-visible:ring-emerald-300"
                          />
                          {podeVerCusto && (
                            <div className="text-[10px] text-muted-foreground mt-1 text-right">
                              Custo: {fmtBrl(a.custo_aquisicao)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={a.aplicar_desconto !== false}
                              onCheckedChange={(v) => updateAmbiente(a.id, { aplicar_desconto: !!v })}
                              title="Permitir desconto sobre este ambiente na negociação"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setAmbDetail(a)}
                              title="Detalhamento"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setAmbEdit(a)}
                              title="Editar nome / descrição"
                            >
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => removeAmbiente(a.id)}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td className="px-4 py-3 text-right text-muted-foreground" colSpan={podeVerCusto ? 2 : 1}>Total</td>
                      <td className="px-2 py-3 text-right text-mono font-semibold">{fmtBrl(subtotalAmbientes)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}

        {/* ============================ STEP 3 ============================ */}
        {step === 3 && (
          <>
            <div className="surface-card p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#E8F4ED", border: "1px solid #D2E8DB" }}
                >
                  <FileText className="w-6 h-6" style={{ color: "#3F8B5C" }} />
                </div>
                <div>
                  <h1 className="text-[26px] font-semibold leading-none">Resumo do Orçamento</h1>
                  <p className="text-[13px] text-muted-foreground mt-1.5">
                    Confirme os dados antes de salvar ou definir o pagamento
                  </p>
                </div>
              </div>

              {/* Nome do projeto */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Nome do Projeto</div>
                <div className="bg-[#EAF2FB] border border-[#D6E4F5] rounded-md px-4 py-3 text-[15px] font-semibold uppercase">
                  {nomeProjeto || "—"}
                </div>
              </div>

              {/* Cliente */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Cliente</div>
                <div className="bg-[#EAF2FB] border border-[#D6E4F5] rounded-md px-4 py-3 text-[15px] font-semibold uppercase">
                  {cliente?.nome || "—"}
                </div>
              </div>

              {/* Indicador */}
              {parceiro && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Indicador</div>
                  <div className="bg-[#FDECEC] border border-[#F5D6D6] rounded-md px-4 py-3">
                    <div className="text-[15px] font-semibold">{parceiro.nome}</div>
                  </div>
                </div>
              )}

              {/* Projetista */}
              {projetistaId && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Projetista</div>
                  <div className="bg-[#E8F4ED] border border-[#D2E8DB] rounded-md px-4 py-3 text-[15px] font-medium">
                    {profiles.find((p) => p.user_id === projetistaId)?.nome_completo ?? "—"}
                  </div>
                </div>
              )}

              {/* Consultor */}
              {consultor && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Consultor</div>
                  <div className="bg-[#FBF3DF] border border-[#F3E5BF] rounded-md px-4 py-3 text-[15px] font-medium">
                    {consultor.nome_completo ?? "—"}
                  </div>
                </div>
              )}

              {/* Ambientes ou Adendo */}
              {isAdendo ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Adendo Financeiro ({adendoTipo === "pagar" ? "a pagar" : "a receber"})
                  </div>
                  <div className="border border-border rounded-md px-4 py-3 bg-[#FDF4E2]/40">
                    <div className="text-[13px] whitespace-pre-wrap">{adendoDescricao || "—"}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Ambientes ({ambientes.length})
                  </div>
                  <div className="space-y-2">
                    {ambientes.map((a) => (
                      <div
                        key={a.id}
                        className="border border-border rounded-md px-4 py-3 hover:bg-muted/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[15px] font-semibold">{a.nome}</div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[13px] font-semibold text-[#2D6BE5]">
                              {a.markup.toFixed(2)}x
                            </span>
                            <span className="text-[15px] font-semibold text-mono">
                              {fmtBrl(a.preco_sugerido)}
                            </span>
                          </div>
                        </div>
                        {a.descricao && (
                          <div className="text-[12px] text-muted-foreground mt-1.5">
                            <span className="font-medium text-foreground/70">Descrição:</span> {a.descricao}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totais */}
              <div className="border-t border-border pt-4 space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isAdendo ? "Valor" : "Subtotal"}</span>
                  <span className="text-mono font-medium">{fmtBrl(subtotalAmbientes)}</span>
                </div>
                {acrescimoParceiro > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ind</span>
                    <span className="text-mono font-medium text-[#2D6BE5]">+ {fmtBrl(acrescimoParceiro)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[18px] font-semibold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-mono">{fmtBrl(total)}</span>
                </div>
              </div>

            </div>
          </>
        )}

        {/* ============================ Footer nav ============================ */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => step === 1 ? navigate("/comercial") : setStep(step - 1)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
              className="bg-[#2D6BE5] hover:bg-[#2459C9]"
            >
              Avançar <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={() => finish(false)}
                disabled={saving}
                className="bg-[#2D6BE5] hover:bg-[#2459C9]"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                {saving ? "Salvando…" : (isEdit ? "Salvar Alterações" : "Salvar Orçamento")}
              </Button>
              <Button
                onClick={() => finish(true)}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Definir Pagamento
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ============================ Dialogs ============================ */}
      <ClienteFormDialog
        open={openCliente}
        onOpenChange={setOpenCliente}
        onSaved={async (created) => {
          const all = await supabase.from("clientes").select("id, nome").order("nome");
          setClientes((all.data ?? []) as Cliente[]);
          if (created) setClienteId(created.id);
        }}
      />

      <NovoParceiroDialog
        open={openParceiro}
        onOpenChange={setOpenParceiro}
        onCreated={(p) => {
          setParceiros((prev) => [...prev, p].sort((a, b) => a.nome.localeCompare(b.nome)));
          setParceiroId(p.id);
          setParceiroPerc(Number(p.percentual_padrao) || 0);
        }}
      />
      <AmbienteEditDialog
        open={!!ambEdit}
        onOpenChange={(v) => !v && setAmbEdit(null)}
        ambiente={ambEdit}
        onSave={(a) => updateAmbiente(a.id, a)}
      />
      <DetalhamentoDialog
        open={!!ambDetail}
        onOpenChange={(v) => !v && setAmbDetail(null)}
        ambiente={ambDetail}
        onSave={(id, itens) => {
          const custo = itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
          const preco = itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0);
          const markup = custo > 0 ? preco / custo : 0;
          updateAmbiente(id, {
            itens,
            custo_aquisicao: Number(custo.toFixed(2)),
            preco_sugerido: Number(preco.toFixed(2)),
            markup: Number(markup.toFixed(2)),
          });
        }}
      />
    </div>
  );
}

/* ----------------------------- Combo input ----------------------------- */
function ComboInput({
  placeholder, options, onPick,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <div className="relative" ref={ref}>
      <Input
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 max-h-60 overflow-auto bg-popover border border-border rounded-md shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.value}
              onClick={() => { onPick(o.value); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

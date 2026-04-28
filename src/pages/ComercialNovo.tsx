import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Check, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { parsePromobTxt, PromobParseResult } from "@/lib/promobParser";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";

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
  markup: number;            // %
  itens: Item[];
  manual?: boolean;
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const uid = () => Math.random().toString(36).slice(2, 9);

/* ------------------------- Step indicator (sidebar) ------------------------- */

function StepsCard({
  step, setStep, canGoTo, summary,
}: {
  step: number;
  setStep: (n: number) => void;
  canGoTo: (n: number) => boolean;
  summary: React.ReactNode;
}) {
  const items = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Ambientes" },
    { n: 3, label: "Resumo" },
  ];
  return (
    <div className="surface-card p-5 sticky top-4">
      <div className="text-[18px] font-semibold mb-4">Novo Orçamento</div>
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
  open, onOpenChange, ambiente,
}: { open: boolean; onOpenChange: (v: boolean) => void; ambiente: Ambiente | null }) {
  if (!ambiente) return null;
  const subtotal = ambiente.itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
  const frete = Math.max(0, ambiente.custo_aquisicao - subtotal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            Detalhamento: {ambiente.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {ambiente.itens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-[13px]">
              Nenhum item importado
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ambiente.itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 py-2.5 items-center text-[13px]">
                  <div className="col-span-7 truncate">{it.descricao}</div>
                  <div className="col-span-3 text-center text-mono text-muted-foreground">
                    {it.quantidade}
                  </div>
                  <div className="col-span-2 text-right text-mono">{fmtBrl(it.custo_loja)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between">
          <div className="text-[13px] text-muted-foreground">
            <span className="text-foreground text-mono">{fmtBrl(subtotal)}</span>
            {frete > 0 && (
              <> + <span className="text-mono">{fmtBrl(frete)}</span> frete = <span className="text-foreground text-mono font-medium">{fmtBrl(ambiente.custo_aquisicao)}</span></>
            )}
          </div>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== MAIN COMPONENT ============================ */

export default function ComercialNovo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ---- catálogos ----
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // ---- step 1 ----
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [parceiroId, setParceiroId] = useState<string>("");
  const [parceiroPerc, setParceiroPerc] = useState<number>(0);
  const [projetistaNome, setProjetistaNome] = useState<string>("");
  const [consultorId, setConsultorId] = useState<string>("");

  // dialog flags
  const [openCliente, setOpenCliente] = useState(false);
  const [openParceiro, setOpenParceiro] = useState(false);

  // ---- step 2 ----
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [importing, setImporting] = useState(false);
  const [ambEdit, setAmbEdit] = useState<Ambiente | null>(null);
  const [ambDetail, setAmbDetail] = useState<Ambiente | null>(null);

  // ---- manual add form ----
  const [mNome, setMNome] = useState("");
  const [mDescricao, setMDescricao] = useState("");
  const [mPrazo, setMPrazo] = useState<string>("");
  const [mCusto, setMCusto] = useState<string>("");

  /* --------------------------------- load --------------------------------- */
  useEffect(() => {
    (async () => {
      const [c, p, pr] = await Promise.all([
        supabase.from("clientes").select("id, nome").order("nome"),
        supabase.from("parceiros").select("id, nome, percentual_padrao").eq("ativo", true).order("nome"),
        supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
      ]);
      setClientes((c.data ?? []) as Cliente[]);
      setParceiros((p.data ?? []) as Parceiro[]);
      setProfiles((pr.data ?? []) as Profile[]);
      // default consultor = current user
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setConsultorId(u.user.id);
    })();
  }, []);

  /* --------------------------- totals (derived) --------------------------- */
  const subtotalAmbientes = useMemo(
    () => ambientes.reduce((s, a) => s + (a.preco_sugerido || 0), 0),
    [ambientes],
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
  const canNext2 = ambientes.length > 0;
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
    try {
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
          // custo_aquisicao = custo loja (preço Promob)
          const custo = itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0);
          // preço cliente sugerido (markup do sistema = soma dos custo_cliente)
          const preco = itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0);
          const markup = custo > 0 ? ((preco - custo) / custo) * 100 : 0;
          const descricao = await aiDescribe(env.name, itens);
          return {
            id: uid(),
            nome: env.name,
            descricao,
            prazo_dias: null,
            custo_aquisicao: custo,
            preco_sugerido: preco,
            markup: Number(markup.toFixed(2)),
            itens,
          };
        }),
      );

      setAmbientes((prev) => [...prev, ...novos]);
      if (!nomeProjeto && parsed.header.clientName) setNomeProjeto(parsed.header.clientName);
      toast.success(`${novos.length} ambientes importados com markup do sistema!`);
      parsed.warnings.forEach((w) => toast.warning(w));
    } catch (e: any) {
      toast.error("Falha ao ler arquivo: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const addManualAmbiente = () => {
    if (!mNome.trim()) return toast.error("Nome do ambiente é obrigatório");
    const custo = Number(mCusto) || 0;
    const novo: Ambiente = {
      id: uid(),
      nome: mNome.trim(),
      descricao: mDescricao,
      prazo_dias: mPrazo ? Number(mPrazo) : null,
      custo_aquisicao: custo,
      preco_sugerido: custo, // cliente pode editar abaixo
      markup: 0,
      itens: [],
      manual: true,
    };
    setAmbientes((prev) => [...prev, novo]);
    setMNome(""); setMDescricao(""); setMPrazo(""); setMCusto("");
    toast.success("Ambiente adicionado");
  };

  const updateAmbiente = (id: string, patch: Partial<Ambiente>) => {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  // sync: change markup -> recompute preço; change preço -> recompute markup
  const onChangeMarkup = (a: Ambiente, markup: number) => {
    const preco = a.custo_aquisicao * (1 + markup / 100);
    updateAmbiente(a.id, { markup, preco_sugerido: Number(preco.toFixed(2)) });
  };
  const onChangePreco = (a: Ambiente, preco: number) => {
    const markup = a.custo_aquisicao > 0 ? ((preco - a.custo_aquisicao) / a.custo_aquisicao) * 100 : 0;
    updateAmbiente(a.id, { preco_sugerido: preco, markup: Number(markup.toFixed(2)) });
  };

  const removeAmbiente = (id: string) =>
    setAmbientes((prev) => prev.filter((a) => a.id !== id));

  /* --------------------------------- finish ------------------------------- */
  const finish = async () => {
    setSaving(true);
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("orcamentos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${year}-01-01`);
    const codigo = `ORC-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: orc, error } = await supabase
      .from("orcamentos")
      .insert({
        codigo,
        cliente_id: clienteId,
        nome_projeto: nomeProjeto || null,
        parceiro_id: parceiroId || null,
        parceiro_perc: parceiroPerc || 0,
        consultor_id: consultorId || null,
        subtotal: subtotalAmbientes,
        desconto_perc: 0,
        desconto_valor: 0,
        total,
        status: "negociacao",
      })
      .select("id")
      .single();

    if (error || !orc) {
      setSaving(false);
      return toast.error(error?.message ?? "Erro ao salvar");
    }

    for (let i = 0; i < ambientes.length; i++) {
      const a = ambientes[i];
      const { data: amb } = await supabase
        .from("ambientes")
        .insert({
          orcamento_id: orc.id,
          nome: a.nome,
          descricao: a.descricao || null,
          ordem: i,
          prazo_dias: a.prazo_dias,
          custo_fabrica: a.itens.reduce((s, it) => s + it.custo_fabrica * it.quantidade, 0),
          custo_loja: a.itens.reduce((s, it) => s + it.custo_loja * it.quantidade, 0),
          custo_aquisicao: a.custo_aquisicao,
          preco_sugerido: a.preco_sugerido,
          markup: a.markup,
        })
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

    setSaving(false);
    toast.success(`Orçamento ${codigo} criado`);
    navigate(`/comercial/${orc.id}`);
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
        <div className="flex items-end justify-between">
          <div>
            <div className="text-muted-foreground text-[11px]">Parceiro</div>
            <div className="font-semibold">{parceiro.nome}</div>
          </div>
          <div className="text-[12px] text-muted-foreground">
            Ind: <span className="font-semibold text-foreground">{parceiroPerc.toFixed(2)}%</span>
          </div>
        </div>
      )}
      {projetistaNome && (
        <div>
          <div className="text-muted-foreground text-[11px]">Projetista</div>
          <div className="font-semibold">{projetistaNome}</div>
        </div>
      )}
      {consultor && (
        <div>
          <div className="text-muted-foreground text-[11px]">Consultor</div>
          <div className="font-semibold">{consultor.nome_completo ?? "—"}</div>
        </div>
      )}
      {ambientes.length > 0 && (
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
            {acrescimoParceiro > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Acréscimo ({parceiroPerc.toFixed(2)}%)</span>
                <span className="text-mono text-foreground">{fmtBrl(acrescimoParceiro)}</span>
              </div>
            )}
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
        <StepsCard step={step} setStep={setStep} canGoTo={canGoTo} summary={summary} />
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
                  </>
                ) : (
                  <ComboInput
                    placeholder="Selecione ou digite o nome do parceiro"
                    options={parceiros.map((p) => ({ value: p.id, label: p.nome }))}
                    onPick={onSelectParceiro}
                  />
                )}
              </div>

              {/* Projetista (texto livre) */}
              <div>
                <Label>Projetista (Opcional)</Label>
                <Input
                  value={projetistaNome}
                  onChange={(e) => setProjetistaNome(e.target.value)}
                  placeholder="Selecione ou digite o nome do projetista"
                />
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
        {step === 2 && (
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
                    Importar Promob (XML ou TXT)
                  </div>
                  <label className="block border-2 border-dashed border-[#D6E4F5] rounded-lg py-10 px-4 cursor-pointer hover:bg-[#F8FAFD] transition text-center">
                    <input
                      type="file" accept=".txt,.xml" className="hidden"
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
                      {importing ? "Processando…" : "Arraste ou clique para importar XML ou TXT do Promob"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Arquivos .xml ou .txt são aceitos
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Prazo (dias úteis)</Label>
                        <Input type="number" value={mPrazo} onChange={(e) => setMPrazo(e.target.value)} placeholder="Ex: 20 (0 ou vazio)" />
                      </div>
                      <div>
                        <Label>Custo de Aquisição</Label>
                        <Input
                          type="number" step="0.01"
                          value={mCusto}
                          onChange={(e) => setMCusto(e.target.value)}
                          placeholder="R$ 0,00"
                        />
                      </div>
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
                      <th className="text-center px-2 py-3 w-[110px]">Markup %</th>
                      <th className="text-right px-2 py-3 w-[170px]">Preço Sugerido</th>
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
                        <td className="px-2 py-3 text-center">
                          <Input
                            type="number" step="0.01"
                            value={a.markup}
                            onChange={(e) => onChangeMarkup(a, Number(e.target.value) || 0)}
                            className="h-9 text-center text-[#2D6BE5] border-[#D6E4F5]"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Input
                            type="number" step="0.01"
                            value={a.preco_sugerido}
                            onChange={(e) => onChangePreco(a, Number(e.target.value) || 0)}
                            className="h-9 text-right text-mono border-emerald-200 focus-visible:ring-emerald-300"
                          />
                          <div className="text-[10px] text-muted-foreground mt-1 text-right">
                            Custo: {fmtBrl(a.custo_aquisicao)}
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
                      <td className="px-4 py-3 text-right text-muted-foreground" colSpan={2}>Total</td>
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
          <div className="surface-card p-6 space-y-6">
            <div>
              <h1 className="text-[22px] font-semibold">Resumo do Orçamento</h1>
              <p className="text-[13px] text-muted-foreground mt-1">Revise e crie o orçamento</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="text-muted-foreground">Cliente</div>
              <div className="text-right font-medium">{cliente?.nome ?? "—"}</div>

              <div className="text-muted-foreground">Projeto</div>
              <div className="text-right">{nomeProjeto || "—"}</div>

              <div className="text-muted-foreground">Parceiro</div>
              <div className="text-right">
                {parceiro ? `${parceiro.nome} (${parceiroPerc}%)` : "—"}
              </div>

              <div className="text-muted-foreground">Projetista</div>
              <div className="text-right">{projetistaNome || "—"}</div>

              <div className="text-muted-foreground">Consultor</div>
              <div className="text-right">{consultor?.nome_completo ?? "—"}</div>

              <div className="text-muted-foreground">Ambientes / Itens</div>
              <div className="text-right">
                {ambientes.length} / {ambientes.reduce((s, a) => s + a.itens.length, 0)}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-[14px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ambientes</span>
                <span className="text-mono text-foreground">{fmtBrl(subtotalAmbientes)}</span>
              </div>
              {acrescimoParceiro > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Acréscimo parceiro ({parceiroPerc}%)</span>
                  <span className="text-mono text-foreground">{fmtBrl(acrescimoParceiro)}</span>
                </div>
              )}
              <div className="flex justify-between text-[16px] font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-mono">{fmtBrl(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================ Footer nav ============================ */}
        <div className="flex items-center justify-between">
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
            <Button onClick={finish} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? "Criando…" : "Criar Orçamento"}
            </Button>
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

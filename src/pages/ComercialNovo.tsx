import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Check, AlertCircle, Loader2, ChevronDown, Lock, Handshake,
} from "lucide-react";
import OrcamentoNegociacaoTab from "@/components/OrcamentoNegociacaoTab";

import { toast } from "sonner";
import { parsePromobTxt, PromobParseResult } from "@/lib/promobParser";
import { parseProjetoXml, parseProjetoExcel, ParseResult as GenericParseResult } from "@/lib/projetoImporter";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

type ProdutoEstoque = {
  id: string;
  descricao: string;
  codigo_barra: string | null;
  codigo_interno: string | null;
  unidade_medida: string;
  quantidade: number;
  preco_custo: number;
  preco_venda: number;
};

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
  origem_ambiente?: "manual" | "xml" | "importado" | "estoque" | "tabela";
};


const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const uid = () => Math.random().toString(36).slice(2, 9);
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/* ------------------------- Step indicator (sidebar) ------------------------- */

function StepsCard({
  step, setStep, canGoTo, summary, title, adendoMode, hasNegociacao,
}: {
  step: number;
  setStep: (n: number) => void;
  canGoTo: (n: number) => boolean;
  summary: React.ReactNode;
  title?: string;
  adendoMode?: boolean;
  hasNegociacao?: boolean;
}) {
  const items = [
    { n: 1, label: "Cliente" },
    { n: 2, label: adendoMode ? "Adendo" : "Ambientes" },
    { n: 3, label: "Resumo" },
    ...(hasNegociacao ? [{ n: 4, label: "Negociação" }] : []),
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
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id,descricao,codigo_barra,codigo_interno,unidade_medida,quantidade,preco_custo,preco_venda")
        .eq("ativo", true)
        .order("descricao");
      setProdutos((data as ProdutoEstoque[]) || []);
    })();
  }, [open]);

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
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Adicionar item
              </div>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Selecionar do estoque
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar produto, código de barras ou interno..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtos.map((p) => {
                          const semEstoque = Number(p.quantidade) <= 0;
                          return (
                            <CommandItem
                              key={p.id}
                              value={`${p.descricao} ${p.codigo_barra ?? ""} ${p.codigo_interno ?? ""}`}
                              onSelect={() => {
                                setItens((prev) => [
                                  ...prev,
                                  {
                                    descricao: p.descricao,
                                    quantidade: 1,
                                    largura: null,
                                    altura: null,
                                    profundidade: null,
                                    custo_cliente: Number(p.preco_venda) || 0,
                                    custo_loja: Number(p.preco_custo) || 0,
                                    custo_fabrica: Number(p.preco_custo) || 0,
                                    cor: null,
                                    categoria: null,
                                    codigo: p.codigo_interno || p.codigo_barra || null,
                                  },
                                ]);
                                setPickerOpen(false);
                              }}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium">{p.descricao}</div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {p.codigo_barra || p.codigo_interno || "—"} · {fmtBrl(Number(p.preco_venda))}
                                </div>
                              </div>
                              <Badge
                                variant={semEstoque ? "destructive" : "secondary"}
                                className="shrink-0 text-[10px]"
                              >
                                Estoque: {Number(p.quantidade)}
                              </Badge>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
  const _params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const preselectCliente = _params?.get("cliente") || null;
  const abaParam = (_params?.get("aba") || _params?.get("step") || "").toLowerCase();
  const { role } = usePermissions();
  const podeVerCusto = role === "admin" || role === "diretor";
  const [step, setStep] = useState(1);
  const [temNegociacao, setTemNegociacao] = useState<boolean>(false);
  const [ultimaNegociacao, setUltimaNegociacao] = useState<{
    versao: number;
    status: string;
    valor_final_negociado: number;
  } | null>(null);
  const [ajustandoNovaVersao, setAjustandoNovaVersao] = useState(false);

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

  // ---- estoque (terceira forma de adicionar ambiente) ----
  const [estoqueProdutos, setEstoqueProdutos] = useState<ProdutoEstoque[]>([]);
  const [estoquePickerOpen, setEstoquePickerOpen] = useState(false);
  const [estoqueNome, setEstoqueNome] = useState("");
  const [estoqueSelecionados, setEstoqueSelecionados] = useState<Array<{ produto: ProdutoEstoque; qtd: number }>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id,descricao,codigo_barra,codigo_interno,unidade_medida,quantidade,preco_custo,preco_venda")
        .eq("ativo", true)
        .order("descricao");
      setEstoqueProdutos((data as ProdutoEstoque[]) || []);
    })();
  }, []);

  const addEstoqueAmbiente = () => {
    if (!estoqueNome.trim()) return toast.error("Nome do ambiente é obrigatório");
    if (estoqueSelecionados.length === 0) return toast.error("Selecione ao menos um produto");
    const itens: Item[] = estoqueSelecionados.map((s) => ({
      descricao: s.produto.descricao,
      quantidade: s.qtd,
      largura: null, altura: null, profundidade: null,
      custo_cliente: Number(s.produto.preco_venda || 0),
      custo_loja: Number(s.produto.preco_custo || 0),
      custo_fabrica: Number(s.produto.preco_custo || 0),
      cor: null, categoria: null,
      codigo: s.produto.codigo_interno || s.produto.codigo_barra || null,
    }));
    const custo = itens.reduce((a, i) => a + i.custo_fabrica * i.quantidade, 0);
    const venda = itens.reduce((a, i) => a + i.custo_cliente * i.quantidade, 0);
    const novo: Ambiente = {
      id: uid(),
      nome: estoqueNome.trim(),
      descricao: "Ambiente montado a partir do estoque",
      prazo_dias: null,
      custo_aquisicao: Number(custo.toFixed(2)),
      preco_sugerido: Number(venda.toFixed(2)),
      markup: custo > 0 ? Number((venda / custo).toFixed(2)) : 0,
      itens,
      manual: false,
      origem_ambiente: "estoque",
    };
    setAmbientes((prev) => [...prev, novo]);
    setEstoqueNome("");
    setEstoqueSelecionados([]);
    toast.success("Ambiente criado a partir do estoque");
  };




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

  const carregarAmbientes = useCallback(async (orcamentoId: string) => {
    const { data: ambs, error } = await supabase
      .from("ambientes")
      .select("id, nome, descricao, prazo_dias, custo_aquisicao, preco_sugerido, markup, ordem, aplicar_desconto, origem_ambiente")
      .eq("orcamento_id", orcamentoId)
      .order("ordem");
    if (error) {
      toast.error(error.message);
      return;
    }

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
      origem_ambiente: (a.origem_ambiente as any) || "manual",
    })));
  }, []);

  const handleNovaVersaoNegociacao = useCallback(() => {
    if (!editId) return;
    setAjustandoNovaVersao(true);
    setStep(2);
    navigate(`/comercial/${editId}?aba=ambientes`, { replace: true });
    void carregarAmbientes(editId);
  }, [carregarAmbientes, editId, navigate]);

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


      await carregarAmbientes(editId);

      // Detecta negociação existente para liberar aba 04 + carrega resumo
      const { data: negs } = await supabase
        .from("orcamento_negociacoes" as any)
        .select("versao,status,valor_final_negociado")
        .eq("orcamento_id", editId)
        .order("versao", { ascending: false });
      const lista = (negs || []) as any[];
      const tem = lista.length > 0;
      setTemNegociacao(tem);
      const ativa = lista.find((n) => n.status === "ativa") || lista[0] || null;
      setUltimaNegociacao(ativa ? {
        versao: Number(ativa.versao || 0),
        status: String(ativa.status || ""),
        valor_final_negociado: Number(ativa.valor_final_negociado || 0),
      } : null);
      if (abaParam === "ambientes" || abaParam === "2") {
        setStep(2);
      } else if (tem && (abaParam === "negociacao" || abaParam === "4")) {
        setStep(4);
      }
    })();
  }, [abaParam, carregarAmbientes, editId, navigate, profile?.loja_id]);


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
  const custoAmbientes = useMemo(
    () => isAdendo ? 0 : ambientes.reduce((s, a) => s + (a.custo_aquisicao || 0), 0),
    [ambientes, isAdendo],
  );

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
    if (n === 4) return temNegociacao;
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

  const processSingleFile = async (file: File): Promise<{ novos: Ambiente[]; nomeProjetoSugerido?: string; warnings: string[] }> => {
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (ext === "txt") {
      const text = await file.text();
      const parsed: PromobParseResult = parsePromobTxt(text);
      if (parsed.environments.length === 0) throw new Error("Nenhum ambiente identificado");
      const novos: Ambiente[] = await Promise.all(
        parsed.environments.map(async (env) => {
          const itens: Item[] = env.items.map((it) => ({
            descricao: it.description, quantidade: it.quantity,
            largura: it.width, altura: it.height, profundidade: it.depth,
            custo_cliente: it.clientPrice, custo_loja: it.storePrice, custo_fabrica: it.factoryPrice,
            cor: it.finish || null, categoria: it.category || null, codigo: it.projectRef || null,
          }));
          // Promob TXT: colunas de valor (custo cliente/loja/fábrica) já são totais da linha.
          // NÃO multiplicar pela quantidade.
          const custo = itens.reduce((s, it) => s + (Number(it.custo_loja) || 0), 0);
          const preco = itens.reduce((s, it) => s + (Number(it.custo_cliente) || 0), 0);
          const markup = custo > 0 ? preco / custo : 0;
          const descricao = await aiDescribe(env.name, itens);
          return { id: uid(), nome: env.name, descricao, prazo_dias: null, custo_aquisicao: custo, preco_sugerido: preco, markup: Number(markup.toFixed(2)), itens, origem_ambiente: "importado" as const };
        }),
      );
      return { novos, nomeProjetoSugerido: parsed.header.clientName, warnings: parsed.warnings };
    }
    let result: GenericParseResult;
    if (ext === "xml") {
      const text = await file.text();
      result = parseProjetoXml(text);
    } else if (ext === "xlsx" || ext === "xls") {
      result = await parseProjetoExcel(file);
    } else {
      throw new Error("Formato não suportado (use TXT, XML ou XLSX)");
    }
    if (!result.environments.length) throw new Error("Nenhum ambiente identificado");
    const novos: Ambiente[] = result.environments.map((env) => {
      const itens: Item[] = env.items.map((it) => ({
        descricao: it.description, quantidade: it.quantity,
        largura: null, altura: null, profundidade: null,
        custo_cliente: it.clientPrice || it.cost, custo_loja: it.cost, custo_fabrica: it.cost,
        cor: null, categoria: null, codigo: null,
      }));
      // XML Promob: valores já são totais da linha — não multiplicar pela quantidade.
      // Excel/genérico: mantém preço unitário × quantidade.
      const isXmlPromob = ext === "xml";
      const custo = itens.reduce((s, it) => s + (isXmlPromob ? (Number(it.custo_loja) || 0) : it.custo_loja * it.quantidade), 0);
      const preco = itens.reduce((s, it) => s + (isXmlPromob ? (Number(it.custo_cliente) || 0) : it.custo_cliente * it.quantidade), 0);
      const markup = custo > 0 ? preco / custo : 0;
      return { id: uid(), nome: env.name, descricao: "", prazo_dias: null, custo_aquisicao: custo, preco_sugerido: preco, markup: Number(markup.toFixed(2)), itens, origem_ambiente: (ext === "xml" ? "xml" : "importado") as any };
    });
    return { novos, warnings: [] };
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setImporting(true);
    let okCount = 0;
    const erros: { name: string; msg: string }[] = [];
    let sugeridoNomeProjeto: string | undefined;
    try {
      for (const file of files) {
        const ext0 = file.name.toLowerCase().split(".").pop() || "";
        const origem = ext0 === "txt" ? "promob_import" : ext0 === "xml" ? "xml_import" : (ext0 === "xlsx" || ext0 === "xls") ? "excel_import" : "upload";
        try {
          toast.info(`Processando ${file.name}…`);
          const { novos, nomeProjetoSugerido, warnings } = await processSingleFile(file);
          setAmbientes((prev) => [...prev, ...novos]);
          setArquivosImportados((prev) => [...prev, { file, origem }]);
          okCount += novos.length;
          if (!sugeridoNomeProjeto && nomeProjetoSugerido) sugeridoNomeProjeto = nomeProjetoSugerido;
          warnings.forEach((w) => toast.warning(w));
          toast.success(`✓ ${novos.length} ambiente(s) de ${file.name}`);
        } catch (e: any) {
          erros.push({ name: file.name, msg: e?.message || "erro" });
          toast.error(`Erro em ${file.name}: ${e?.message || "falha ao ler"}`);
        }
      }
      if (sugeridoNomeProjeto && !nomeProjeto) setNomeProjeto(sugeridoNomeProjeto);
      if (files.length > 1 || erros.length) {
        toast.success(`${okCount} ambiente(s) importado(s). ${erros.length ? `${erros.length} arquivo(s) com erro.` : ""}`);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (file: File) => handleFiles([file]);

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
      origem_ambiente: "manual",
    };
    setAmbientes((prev) => [...prev, novo]);
    setMNome(""); setMDescricao(""); setMVenda("");
    toast.success("Ambiente adicionado");
  };

  const isAmbienteImportado = (a: Partial<Ambiente> & Record<string, any>) => {
    const origem = (a?.origem_ambiente || (a as any)?.ambiente_infantil || (a as any)?.origem || (a as any)?.tipo_origem || (a as any)?.fonte || "").toString().toLowerCase();
    if (origem && origem !== "manual") return true;
    if ((a as any)?.importado_xml === true || (a as any)?.importado === true) return true;
    if ((a as any)?.arquivo_xml_id || (a as any)?.arquivo_importacao_id) return true;
    if ((a as any)?.produto_id || (a as any)?.estoque_id) return true;
    if (Array.isArray((a as any)?.produtos_estoque) && (a as any).produtos_estoque.length > 0) return true;
    return false;
  };

  const origemAmbienteLabel = (a: Partial<Ambiente> & Record<string, any>): string | null => {
    const origem = (a?.origem_ambiente || (a as any)?.ambiente_infantil || (a as any)?.origem || (a as any)?.fonte || "").toString().toLowerCase();
    if (origem === "xml") return "XML";
    if (origem === "estoque") return "Estoque";
    if (origem === "tabela") return "Tabela";
    if (origem === "importado") return "Importado";
    if (isAmbienteImportado(a)) return "Importado";
    return null;
  };

  const updateAmbiente = (id: string, patch: Partial<Ambiente>) => {
    setAmbientes((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const next: Partial<Ambiente> = { ...patch };
      if (isAmbienteImportado(a)) {
        delete (next as any).preco_sugerido;
        delete (next as any).markup;
      }
      return { ...a, ...next };
    }));
  };

  // sync: markup é multiplicador (ex: 2 => preço = 2 * custo)
  const onChangeMarkup = (a: Ambiente, markup: number) => {
    if (isAmbienteImportado(a)) return;
    const preco = a.custo_aquisicao * markup;
    updateAmbiente(a.id, { markup, preco_sugerido: Number(preco.toFixed(2)) });
  };
  const onChangePreco = (a: Ambiente, preco: number) => {
    if (isAmbienteImportado(a)) return;
    const markup = a.custo_aquisicao > 0 ? preco / a.custo_aquisicao : 0;
    updateAmbiente(a.id, { preco_sugerido: preco, markup: Number(markup.toFixed(2)) });
  };

  const removeAmbiente = async (id: string) => {
    if (!window.confirm("Remover este ambiente da nova versão do orçamento?")) return;
    const anterior = ambientes;
    setAmbientes((prev) => prev.filter((a) => a.id !== id));
    if (editId) {
      const { error } = await supabase.from("ambientes").delete().eq("id", id).eq("orcamento_id", editId);
      if (error) {
        setAmbientes(anterior);
        toast.error(error.message);
        return;
      }
    }
    toast.success("Ambiente removido");
  };

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

      // Em edição/nova versão, não limpamos os ambientes do orçamento.
      // Remoções são persistidas pela própria ação de remover; aqui apenas atualizamos/adicionamos.
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
        const payload = {
          orcamento_id: orcId,
          nome: a.nome,
          descricao: a.descricao || null,
          ordem: i,
          prazo_dias: a.prazo_dias,
          custo_fabrica: (a.origem_ambiente === "importado" || a.origem_ambiente === "xml")
            ? a.itens.reduce((s, it) => s + (Number(it.custo_fabrica) || 0), 0)
            : a.itens.reduce((s, it) => s + (Number(it.custo_fabrica) || 0) * (it.quantidade || 0), 0),
          custo_loja: (a.origem_ambiente === "importado" || a.origem_ambiente === "xml")
            ? a.itens.reduce((s, it) => s + (Number(it.custo_loja) || 0), 0)
            : a.itens.reduce((s, it) => s + (Number(it.custo_loja) || 0) * (it.quantidade || 0), 0),
          custo_aquisicao: a.custo_aquisicao,
          preco_sugerido: a.preco_sugerido,
          markup: a.markup,
          aplicar_desconto: a.aplicar_desconto !== false,
          origem_ambiente: a.origem_ambiente || "manual",
        } as any;
        const query = isEdit && isUuid(a.id)
          ? supabase.from("ambientes").update(payload).eq("id", a.id).eq("orcamento_id", orcId).select("id").single()
          : supabase.from("ambientes").insert(payload).select("id").single();
        const { data: amb, error: ambErr } = await query;
        if (ambErr) { setSaving(false); return toast.error(ambErr.message); }
        if (amb) {
          await supabase.from("sub_itens_ambiente").delete().eq("ambiente_id", amb.id);
        }
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

      {ultimaNegociacao && (
        <div className="border-t border-border pt-3">
          <div className="text-muted-foreground text-[11px] mb-1">Última negociação</div>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="font-semibold">v{ultimaNegociacao.versao}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              ultimaNegociacao.status === "ativa" ? "bg-emerald-100 text-emerald-700"
              : ultimaNegociacao.status === "aprovada" ? "bg-blue-100 text-blue-700"
              : "bg-muted text-muted-foreground"
            }`}>{ultimaNegociacao.status}</span>
          </div>
          <div className="flex justify-between text-[13px] mt-1">
            <span className="text-muted-foreground">Valor final</span>
            <span className="text-mono font-semibold">{fmtBrl(ultimaNegociacao.valor_final_negociado)}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-8 text-[12px]"
            onClick={() => setStep(4)}
          >
            Ir para negociação
          </Button>
        </div>
      )}

    </div>
  );

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-3">
        <StepsCard step={step} setStep={setStep} canGoTo={canGoTo} summary={summary} title={isEdit ? `Editar ${orcCodigo || "Orçamento"}` : "Novo Orçamento"} adendoMode={isAdendo} hasNegociacao={temNegociacao} />
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
                    Importe um projeto, monte a partir do estoque ou adicione manualmente
                  </p>

                </div>
              </div>

              {ajustandoNovaVersao && (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground mb-5">
                  Você está ajustando os ambientes da nova versão. Após concluir, avance para o resumo e gere/atualize a negociação.
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {/* Importar */}
                <div className="rounded-lg border border-border p-5">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-4">
                    <Upload className="w-4 h-4 text-[#2D6BE5]" />
                    Importar projeto (TXT, XML ou Excel)
                  </div>
                  <label className="block border-2 border-dashed border-[#D6E4F5] rounded-lg py-10 px-4 cursor-pointer hover:bg-[#F8FAFD] transition text-center">
                    <input
                      type="file" accept=".txt,.xml,.xlsx,.xls" multiple className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        if (files.length) handleFiles(files);
                      }}
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

                {/* Estoque */}
                <div className="rounded-lg border border-border p-5">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-4">
                    <Package className="w-4 h-4 text-[#2D6BE5]" />
                    Montar do Estoque
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome do Ambiente</Label>
                      <Input
                        value={estoqueNome}
                        onChange={(e) => setEstoqueNome(e.target.value)}
                        placeholder="Ex: Cozinha modulada"
                      />
                    </div>
                    <div>
                      <Label>Produtos</Label>
                      <Popover open={estoquePickerOpen} onOpenChange={setEstoquePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="truncate">
                              {estoqueSelecionados.length === 0
                                ? "Selecionar produtos…"
                                : `${estoqueSelecionados.length} produto(s) selecionado(s)`}
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-60" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar produto..." />
                            <CommandList>
                              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                              <CommandGroup>
                                {estoqueProdutos.map((p) => {
                                  const sel = estoqueSelecionados.some((s) => s.produto.id === p.id);
                                  return (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.descricao} ${p.codigo_interno ?? ""} ${p.codigo_barra ?? ""}`}
                                      onSelect={() => {
                                        setEstoqueSelecionados((prev) =>
                                          sel
                                            ? prev.filter((s) => s.produto.id !== p.id)
                                            : [...prev, { produto: p, qtd: 1 }],
                                        );
                                      }}
                                      className="flex items-start gap-2"
                                    >
                                      <Checkbox checked={sel} className="mt-1" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium truncate">{p.descricao}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                          {(p.codigo_interno || p.codigo_barra || "—")} · {fmtBrl(p.preco_venda)}
                                        </div>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={Number(p.quantidade) <= 0 ? "text-rose-600 border-rose-300" : ""}
                                      >
                                        {Number(p.quantidade)} {p.unidade_medida}
                                      </Badge>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {estoqueSelecionados.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                        {estoqueSelecionados.map((s) => (
                          <div key={s.produto.id} className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1 truncate">{s.produto.descricao}</span>
                            <Input
                              type="number" min={1} step="1"
                              value={s.qtd}
                              onChange={(e) =>
                                setEstoqueSelecionados((prev) =>
                                  prev.map((x) =>
                                    x.produto.id === s.produto.id
                                      ? { ...x, qtd: Math.max(1, Number(e.target.value) || 1) }
                                      : x,
                                  ),
                                )
                              }
                              className="h-7 w-16 text-center"
                            />
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() =>
                                setEstoqueSelecionados((prev) => prev.filter((x) => x.produto.id !== s.produto.id))
                              }
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button onClick={addEstoqueAmbiente} className="w-full">
                      <Plus className="w-4 h-4 mr-1.5" /> Criar Ambiente
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
                      {podeVerCusto && usarMarkup && <th className="text-center px-2 py-3 w-[110px]">Markup (x)</th>}
                      <th className="text-right px-2 py-3 w-[170px]">Preço Sugerido</th>
                      <th className="text-center px-2 py-3 w-[90px]" title="Recebe desconto na negociação">Desconto</th>
                      <th className="text-right px-4 py-3 w-[110px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientes.map((a) => {
                      const importado = isAmbienteImportado(a);
                      const origemLabel = origemAmbienteLabel(a);
                      return (
                      <tr key={a.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
                            {a.nome}
                            {origemLabel && (
                              <span title={`Preço definido pela origem do ambiente (${origemLabel}). Não pode ser editado manualmente.`} className="inline-flex items-center text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 uppercase tracking-wider">
                                <Lock className="w-3 h-3 mr-1" /> {origemLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        {podeVerCusto && usarMarkup && (
                          <td className="px-2 py-3 text-center">
                            {importado ? (
                              <div className="h-9 flex items-center justify-center text-[13px] text-muted-foreground bg-muted/40 rounded-md border border-border">
                                {Number(a.markup || 0).toFixed(2)}x
                              </div>
                            ) : (
                              <Input
                                type="number" step="0.01"
                                value={a.markup}
                                onChange={(e) => onChangeMarkup(a, Number(e.target.value) || 0)}
                                className="h-9 text-center text-[#2D6BE5] border-[#D6E4F5]"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-2 py-3 text-right">
                          {importado ? (
                            <div
                              className="h-9 flex items-center justify-end gap-1.5 px-3 rounded-md bg-muted/40 border border-border text-[13px] text-mono"
                              title="Preço definido pela origem do ambiente. Não pode ser editado manualmente."
                              aria-disabled="true"
                            >
                              <span>{a.preco_sugerido ? fmtBrl(a.preco_sugerido) : "Sem preço sugerido"}</span>
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          ) : (
                            <Input
                              type="number" step="0.01"
                              value={a.preco_sugerido}
                              onChange={(e) => onChangePreco(a, Number(e.target.value) || 0)}
                              className="h-9 text-right text-mono border-emerald-200 focus-visible:ring-emerald-300"
                            />
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
                              title="Detalhamento (custo e itens)"
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
                              variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => removeAmbiente(a.id)}
                              title="Remover ambiente"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remover
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td className="px-4 py-3 text-right text-muted-foreground" colSpan={podeVerCusto && usarMarkup ? 2 : 1}>Total</td>
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
                {acrescimoParceiro > 0 && podeVerCusto && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ind</span>
                    <span className="text-mono font-medium text-[#2D6BE5]">+ {fmtBrl(acrescimoParceiro)}</span>
                  </div>
                )}

                {/* Composição de despesas (custo dos ambientes) — ocultada do Resumo comercial. */}
                <div className="flex justify-between text-[18px] font-semibold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-mono">{fmtBrl(total)}</span>
                </div>
              </div>

            </div>
          </>
        )}

        {/* ============================ STEP 4 — Negociação ============================ */}
        {step === 4 && temNegociacao && editId && (
          <OrcamentoNegociacaoTab orcamentoId={editId} onNovaVersao={handleNovaVersaoNegociacao} />
        )}

        {/* ============================ Footer nav ============================ */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => step === 1 ? navigate("/comercial") : setStep(step - 1)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          {step === 3 && temNegociacao ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[12px] text-[#6B6760]">
                Revise os ambientes e valores desta versão. Para definir condições comerciais, avance para a negociação.
              </span>
              <Button
                onClick={() => finish(true)}
                disabled={saving}
                className="bg-[#2D6BE5] hover:bg-[#2459C9]"
              >
                <Handshake className="w-4 h-4 mr-1.5" />
                {saving ? "Salvando…" : "Negociar"}
              </Button>
            </div>
          ) : step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
              className="bg-[#2D6BE5] hover:bg-[#2459C9]"
            >
              Avançar <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : step === 4 ? (
            <Button variant="outline" onClick={() => navigate("/comercial")}>Fechar</Button>
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Calculator, Check, Plus, Printer, Save, CheckCircle2, Trash2, Eye,
} from "lucide-react";
import { toast } from "sonner";

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

type Ambiente = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
};

type Pagamento = {
  id?: string;
  metodo: string;
  valor: number;
  parcelas: number;
  data_vencimento: string | null;
};

type Metodo = { id: string; nome: string };

export default function ComercialNegociacao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orc, setOrc] = useState<any>(null);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  // desconto
  const [descPerc, setDescPerc] = useState<number>(0);
  const [descValor, setDescValor] = useState<number>(0);

  // novo pagamento
  const [novoMetodo, setNovoMetodo] = useState("");
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novoParcelas, setNovoParcelas] = useState<number>(1);
  const [novoVenc, setNovoVenc] = useState<string>("");

  /* ----------------------------- load ----------------------------- */
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: amb }, { data: m }, { data: pgs }] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("id, codigo, nome_projeto, subtotal, total, desconto_perc, desconto_valor, parceiro_perc, status, cliente:clientes(nome)")
          .eq("id", id)
          .single(),
        supabase
          .from("ambientes")
          .select("id, nome, descricao, preco_sugerido")
          .eq("orcamento_id", id)
          .order("ordem"),
        supabase.from("metodos_pagamento").select("id, nome").eq("ativo", true).order("nome"),
        supabase
          .from("pagamentos_orcamento")
          .select("id, metodo, valor, parcelas, data_vencimento")
          .eq("orcamento_id", id),
      ]);
      setOrc(o);
      setAmbientes((amb ?? []) as Ambiente[]);
      setMetodos((m ?? []) as Metodo[]);
      setPagamentos((pgs ?? []) as Pagamento[]);
      setDescPerc(Number(o?.desconto_perc) || 0);
      setDescValor(Number(o?.desconto_valor) || 0);
      setLoading(false);
    })();
  }, [id]);

  /* --------------------------- derived --------------------------- */
  const subtotal = useMemo(
    () => ambientes.reduce((s, a) => s + (Number(a.preco_sugerido) || 0), 0),
    [ambientes],
  );
  const subtotalComInd = Number(orc?.total) || subtotal;
  const totalProposta = Math.max(0, subtotalComInd - descValor);
  const totalAlocado = pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
  const restante = totalProposta - totalAlocado;

  /* ------------------------- handlers ------------------------- */
  const onPercChange = (v: number) => {
    setDescPerc(v);
    setDescValor(Number((subtotalComInd * (v / 100)).toFixed(2)));
  };
  const onValorChange = (v: number) => {
    setDescValor(v);
    setDescPerc(subtotalComInd > 0 ? Number(((v / subtotalComInd) * 100).toFixed(2)) : 0);
  };
  const aplicarDesconto = () => toast.success("Desconto aplicado");
  const cancelarDesconto = () => { setDescPerc(0); setDescValor(0); };

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

  /* ------------------------- save ------------------------- */
  const persist = async (newStatus?: string) => {
    if (!id) return;
    setSaving(true);
    const updates: any = {
      desconto_perc: descPerc,
      desconto_valor: descValor,
      total: totalProposta,
    };
    if (newStatus) updates.status = newStatus;

    const { error: e1 } = await supabase.from("orcamentos").update(updates).eq("id", id);
    if (e1) { setSaving(false); return toast.error(e1.message); }

    // replace pagamentos
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

  const salvar = async () => {
    const ok = await persist();
    if (ok) toast.success("Orçamento atualizado");
  };

  const confirmar = async () => {
    if (Math.abs(restante) > 0.01)
      return toast.error("Total dos pagamentos não bate com o valor da proposta");
    const ok = await persist("aprovado");
    if (ok) {
      toast.success("Pedido confirmado!");
      navigate(`/comercial/${id}`);
    }
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
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#EAF2FB", border: "1px solid #D6E4F5" }}
            >
              <Calculator className="w-6 h-6" style={{ color: "#3B6FB0" }} />
            </div>
            <div>
              <h1 className="text-[26px] font-semibold leading-none">Negociação Comercial</h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                Ajuste valores e condições
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {ambientes.map((a) => {
              const precoBase = Number(a.preco_sugerido) || 0;
              const fator = subtotal > 0 ? precoBase / subtotal : 0;
              const precoFinal = totalProposta * fator;
              return (
                <div
                  key={a.id}
                  className="border-2 border-emerald-100 rounded-lg px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold uppercase tracking-tight">{a.nome}</div>
                        {a.descricao && (
                          <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
                            - {a.descricao}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço</div>
                      <div className="text-[15px] font-semibold text-mono">{fmtBrl(precoFinal)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[12px] text-muted-foreground">*Após assinatura do caderno técnico</p>

          <div className="border-t border-border pt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Valor Total da Proposta
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[34px] font-semibold text-mono leading-tight">{fmtBrl(totalProposta)}</div>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between mt-3 text-[12px] text-muted-foreground">
              <div>Total Alocado: <span className="text-foreground font-medium text-mono">{fmtBrl(totalAlocado)}</span></div>
              <div>Restante: <span className={`font-medium text-mono ${Math.abs(restante) < 0.01 ? "text-emerald-700" : "text-rose-600"}`}>{fmtBrl(restante)}</span></div>
            </div>
          </div>

          {/* lista de pagamentos */}
          {pagamentos.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Pagamentos
              </div>
              <div className="space-y-2">
                {pagamentos.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-[13px]">
                    <div>
                      <span className="font-medium">{p.metodo}</span>
                      <span className="text-muted-foreground"> · {p.parcelas}x</span>
                      {p.data_vencimento && (
                        <span className="text-muted-foreground"> · venc. {new Date(p.data_vencimento).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-mono font-semibold">{fmtBrl(p.valor)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePagamento(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button onClick={aplicarDesconto} className="bg-[#2D6BE5] hover:bg-[#2459C9]">Aplicar desconto</Button>
            <Button variant="outline" onClick={cancelarDesconto}>Cancelar</Button>
          </div>
        </div>

        {/* Adicionar pagamento */}
        <div className="surface-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Adicionar Pagamento
          </div>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor</Label>
                <Input
                  type="number" step="0.01"
                  value={novoValor || ""}
                  onChange={(e) => setNovoValor(Number(e.target.value) || 0)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input
                  type="number" min={1}
                  value={novoParcelas}
                  onChange={(e) => setNovoParcelas(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div>
              <Label>Vencimento (1ª parcela)</Label>
              <Input type="date" value={novoVenc} onChange={(e) => setNovoVenc(e.target.value)} />
            </div>
            <Button onClick={addPagamento} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar Pagamento
            </Button>
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir Orçamento
          </Button>
          <Button onClick={salvar} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Salvando…" : "Salvar Orçamento"}
          </Button>
          <Button
            onClick={confirmar}
            disabled={saving || Math.abs(restante) > 0.01}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Pedido
          </Button>
        </div>
      </div>
    </div>
  );
}

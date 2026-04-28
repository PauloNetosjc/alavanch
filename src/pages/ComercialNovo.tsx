import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, Upload, Trash2, Plus, ArrowLeft, ArrowRight, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { parsePromobTxt, PromobParseResult } from "@/lib/promobParser";

type Cliente = { id: string; nome: string };
type Ambiente = {
  nome: string;
  custo_fabrica: number;
  custo_loja: number;
  custo_aquisicao: number; // custo cliente subtotal
  itens: Array<{
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
  }>;
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function StepIndicator({ step }: { step: number }) {
  const labels = ["Cliente & Projeto", "Ambientes", "Revisão"];
  return (
    <div className="flex items-center gap-3 mb-8">
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={l} className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
              style={{
                background: done ? "#3F8B5C" : active ? "#1A1A1A" : "hsl(var(--muted))",
                color: done || active ? "#fff" : "hsl(var(--muted-foreground))",
              }}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : idx}
            </div>
            <span className={`text-[12px] ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{l}</span>
            {idx < labels.length && <div className="w-12 h-px bg-border ml-1" />}
          </div>
        );
      })}
    </div>
  );
}

export default function ComercialNovo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [descontoPerc, setDescontoPerc] = useState(0);

  // Step 2
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);

  useEffect(() => {
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => {
      setClientes((data ?? []) as Cliente[]);
    });
  }, []);

  const subtotal = ambientes.reduce(
    (s, a) => s + a.itens.reduce((ss, it) => ss + it.custo_cliente * it.quantidade, 0),
    0,
  );
  const desconto = subtotal * (descontoPerc / 100);
  const total = subtotal - desconto;

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: PromobParseResult = parsePromobTxt(text);
      if (parsed.environments.length === 0) {
        toast.error("Nenhum ambiente identificado no arquivo");
        return;
      }
      const novos: Ambiente[] = parsed.environments.map((env) => ({
        nome: env.name,
        custo_fabrica: env.items.reduce((s, it) => s + it.factoryPrice * it.quantity, 0),
        custo_loja: env.items.reduce((s, it) => s + it.storePrice * it.quantity, 0),
        custo_aquisicao: env.items.reduce((s, it) => s + it.clientPrice * it.quantity, 0),
        itens: env.items.map((it) => ({
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
        })),
      }));
      setAmbientes((prev) => [...prev, ...novos]);
      if (!nomeProjeto && parsed.header.clientName) setNomeProjeto(parsed.header.clientName);
      toast.success(`${novos.length} ambiente(s) importado(s)`);
      parsed.warnings.forEach((w) => toast.warning(w));
    } catch (e: any) {
      toast.error("Falha ao ler arquivo: " + e.message);
    }
  };

  const addEmptyAmbiente = () => {
    setAmbientes((prev) => [...prev, {
      nome: `Ambiente ${prev.length + 1}`,
      custo_fabrica: 0, custo_loja: 0, custo_aquisicao: 0, itens: [],
    }]);
  };
  const removeAmbiente = (i: number) => setAmbientes((prev) => prev.filter((_, idx) => idx !== i));

  const canNext1 = clienteId && nomeProjeto.trim().length > 0;
  const canNext2 = ambientes.length > 0;

  const finish = async () => {
    setSaving(true);
    // generate codigo ORC-YYYY-XXXX
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
        nome_projeto: nomeProjeto,
        desconto_perc: descontoPerc,
        desconto_valor: desconto,
        subtotal,
        total,
        status: "negociacao",
      })
      .select("id")
      .single();

    if (error || !orc) {
      setSaving(false);
      toast.error(error?.message ?? "Erro ao salvar");
      return;
    }

    for (let i = 0; i < ambientes.length; i++) {
      const a = ambientes[i];
      const { data: amb } = await supabase
        .from("ambientes")
        .insert({
          orcamento_id: orc.id,
          nome: a.nome,
          ordem: i,
          custo_fabrica: a.custo_fabrica,
          custo_loja: a.custo_loja,
          custo_aquisicao: a.custo_aquisicao,
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

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        iconVariant="purple"
        title="Novo Orçamento"
        subtitle="Crie um orçamento em 3 etapas simples"
        actions={
          <Button variant="outline" onClick={() => navigate("/comercial")}>
            Cancelar
          </Button>
        }
      />

      <StepIndicator step={step} />

      {/* STEP 1 */}
      {step === 1 && (
        <div className="surface-card max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente…" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientes.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Nenhum cliente cadastrado.{" "}
                  <button className="underline" onClick={() => navigate("/clientes")}>Cadastrar agora</button>.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Nome do projeto *</Label>
              <Input value={nomeProjeto} onChange={(e) => setNomeProjeto(e.target.value)} placeholder="Ex: Apartamento Vila Nova" />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" min={0} max={100} step={0.1} value={descontoPerc}
                onChange={(e) => setDescontoPerc(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="surface-card flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Importar do Promob</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Selecione um arquivo TXT exportado do Promob para importar ambientes e itens automaticamente.
              </div>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                  <Upload className="w-3.5 h-3.5" /> Importar TXT
                </span>
              </label>
              <Button variant="outline" size="sm" onClick={addEmptyAmbiente}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Ambiente vazio
              </Button>
            </div>
          </div>

          {ambientes.length === 0 ? (
            <div className="surface-card text-center py-12">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <div className="text-[13px] font-medium">Nenhum ambiente adicionado</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Importe um TXT do Promob ou crie um ambiente manualmente.
              </div>
            </div>
          ) : (
            ambientes.map((a, i) => (
              <div key={i} className="surface-card">
                <div className="flex items-center justify-between mb-3">
                  <Input
                    value={a.nome}
                    onChange={(e) => {
                      const next = [...ambientes]; next[i] = { ...a, nome: e.target.value }; setAmbientes(next);
                    }}
                    className="max-w-xs font-medium"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">{a.itens.length} itens</span>
                    <span className="text-mono text-foreground">{fmtBrl(a.itens.reduce((s, it) => s + it.custo_cliente * it.quantidade, 0))}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeAmbiente(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {a.itens.length > 0 && (
                  <div className="border-t border-border -mx-4 px-4 pt-3 mt-3">
                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      <div className="col-span-6">Descrição</div>
                      <div className="col-span-1 text-center">Qtd</div>
                      <div className="col-span-2 text-right">L×A×P</div>
                      <div className="col-span-3 text-right">Cliente</div>
                    </div>
                    {a.itens.slice(0, 5).map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 text-[11px] py-1 border-b border-border/40 last:border-0">
                        <div className="col-span-6 truncate">{it.descricao}</div>
                        <div className="col-span-1 text-center text-mono">{it.quantidade}</div>
                        <div className="col-span-2 text-right text-mono">
                          {[it.largura, it.altura, it.profundidade].filter(Boolean).join("×") || "—"}
                        </div>
                        <div className="col-span-3 text-right text-mono text-foreground">{fmtBrl(it.custo_cliente)}</div>
                      </div>
                    ))}
                    {a.itens.length > 5 && (
                      <div className="text-[10px] text-muted-foreground mt-2">+ {a.itens.length - 5} itens…</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="surface-card">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Resumo</div>
            <div className="grid grid-cols-2 gap-y-2 text-[12px]">
              <div className="text-muted-foreground">Cliente</div>
              <div className="text-right">{clientes.find((c) => c.id === clienteId)?.nome ?? "—"}</div>
              <div className="text-muted-foreground">Projeto</div>
              <div className="text-right">{nomeProjeto}</div>
              <div className="text-muted-foreground">Ambientes</div>
              <div className="text-right">{ambientes.length}</div>
              <div className="text-muted-foreground">Itens</div>
              <div className="text-right">{ambientes.reduce((s, a) => s + a.itens.length, 0)}</div>
            </div>
          </div>

          <div className="surface-card">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Totais</div>
            <div className="grid grid-cols-2 gap-y-2 text-[13px]">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-right text-mono">{fmtBrl(subtotal)}</div>
              <div className="text-muted-foreground">Desconto ({descontoPerc}%)</div>
              <div className="text-right text-mono">- {fmtBrl(desconto)}</div>
              <div className="text-foreground font-medium pt-2 border-t border-border">Total</div>
              <div className="text-right text-foreground font-medium pt-2 border-t border-border text-mono">{fmtBrl(total)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
          >
            Próximo <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving}>
            {saving ? "Criando…" : "Criar orçamento"}
          </Button>
        )}
      </div>
    </div>
  );
}

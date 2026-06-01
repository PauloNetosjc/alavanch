import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/financeiro";

type Item = {
  tipo_item: "produto" | "servico";
  produto_fiscal_id?: string | null;
  servico_fiscal_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string;
  valor_unitario: number;
  cfop?: string;
};

export function PreNotaDialog({
  open, onClose, pedidoId, clienteId, valorSugerido, onCreated,
}: {
  open: boolean; onClose: () => void;
  pedidoId?: string | null; clienteId?: string | null; valorSugerido?: number;
  onCreated?: (notaId: string) => void;
}) {
  const { user } = useAuth();
  const { selectedLojaId } = useLoja();
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfe");
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda");
  const [produtos, setProdutos] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [operacaoFiscalId, setOperacaoFiscalId] = useState<string>("");
  const [configsTrib, setConfigsTrib] = useState<any[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !selectedLojaId) return;
    (async () => {
      const [{ data: p }, { data: s }, { data: o }, { data: ct }] = await Promise.all([
        supabase.from("produtos_fiscais" as any).select("id,nome,unidade_comercial,ncm,cfop_padrao,operacao_fiscal_padrao_id,configuracao_tributaria_padrao_id").eq("ativo", true).or(`loja_id.eq.${selectedLojaId},loja_id.is.null`),
        supabase.from("servicos_fiscais" as any).select("id,nome,codigo_lc116,aliquota_iss").eq("ativo", true).or(`loja_id.eq.${selectedLojaId},loja_id.is.null`),
        supabase.from("fiscal_operacoes" as any).select("id,nome,codigo_cfop,tipo_nota,padrao").eq("ativo", true).or(`loja_id.eq.${selectedLojaId},loja_id.is.null`).order("padrao", { ascending: false }).order("nome"),
        supabase.from("fiscal_configuracoes_tributarias" as any).select("id,operacao_fiscal_id,codigo_cfop").eq("loja_id", selectedLojaId).eq("ativo", true),
      ]);
      setProdutos(p || []);
      setServicos(s || []);
      const ops = (o as any[]) || [];
      setOperacoes(ops);
      setConfigsTrib((ct as any) || []);
      const padrao = ops.find((x) => x.padrao && x.tipo_nota === (tipo === "nfe" ? "saida" : "saida"));
      if (padrao && !operacaoFiscalId) {
        setOperacaoFiscalId(padrao.id);
        setNaturezaOperacao(padrao.nome);
      }
    })();
    if (open && itens.length === 0 && valorSugerido) {
      setItens([{
        tipo_item: "produto",
        descricao: pedidoId ? `Itens do pedido ${pedidoId.slice(0, 8)}` : "Item",
        quantidade: 1, unidade: "UN", valor_unitario: valorSugerido,
      }]);
    }
  }, [open, selectedLojaId]);

  // ao escolher operação fiscal, preencher CFOP nos itens
  useEffect(() => {
    if (!operacaoFiscalId) return;
    const op = operacoes.find((o) => o.id === operacaoFiscalId);
    if (!op) return;
    setNaturezaOperacao(op.nome);
    if (op.codigo_cfop) {
      setItens((arr) => arr.map((it) => ({ ...it, cfop: op.codigo_cfop } as any)));
    }
  }, [operacaoFiscalId]);

  const total = itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0);

  const addItem = () => setItens((arr) => [...arr, {
    tipo_item: tipo === "nfse" ? "servico" : "produto",
    descricao: "", quantidade: 1, unidade: "UN", valor_unitario: 0,
  }]);

  const removeItem = (i: number) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const updItem = (i: number, patch: Partial<Item>) => setItens((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const salvar = async () => {
    if (!selectedLojaId) return;
    if (tipo === "nfe" && !operacaoFiscalId) {
      toast.error("Selecione uma operação fiscal para gerar a nota.");
      return;
    }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setSaving(true);
    try {
      const valorProdutos = itens.filter((i) => i.tipo_item === "produto").reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const valorServicos = itens.filter((i) => i.tipo_item === "servico").reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const op = operacoes.find((o) => o.id === operacaoFiscalId);
      const cfgTrib = configsTrib.find((c) => c.operacao_fiscal_id === operacaoFiscalId);

      const { data: nota, error } = await supabase.from("notas_fiscais" as any).insert({
        loja_id: selectedLojaId,
        pedido_id: pedidoId || null,
        cliente_id: clienteId || null,
        tipo,
        modelo: tipo === "nfe" ? "55" : "nfse",
        status: "rascunho",
        ambiente: "homologacao",
        natureza_operacao: naturezaOperacao,
        valor_total: total,
        valor_produtos: valorProdutos,
        valor_servicos: valorServicos,
        operacao_fiscal_id: operacaoFiscalId || null,
        configuracao_tributaria_id: cfgTrib?.id || null,
        created_by: user?.id ?? null,
      } as any).select("id").single();
      if (error) throw error;
      const notaId = (nota as any).id;

      const linhas = itens.map((it) => ({
        nota_fiscal_id: notaId,
        tipo_item: it.tipo_item,
        produto_fiscal_id: it.produto_fiscal_id || null,
        servico_fiscal_id: it.servico_fiscal_id || null,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade || "UN",
        valor_unitario: it.valor_unitario,
        valor_total: it.quantidade * it.valor_unitario,
        cfop: it.cfop || op?.codigo_cfop || null,
      }));
      if (linhas.length) {
        const { error: e2 } = await supabase.from("notas_fiscais_itens" as any).insert(linhas);
        if (e2) throw e2;
      }

      await supabase.from("notas_fiscais_eventos" as any).insert({
        nota_fiscal_id: notaId,
        tipo_evento: "criada",
        status_novo: "rascunho",
        mensagem: "Pré-nota criada manualmente.",
        criado_por: user?.id ?? null,
      } as any);

      toast.success("Pré-nota criada como rascunho.");
      onCreated?.(notaId);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar pré-nota");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5"/> Gerar pré-nota</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e (produto)</SelectItem>
                  <SelectItem value="nfse">NFS-e (serviço)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operação fiscal{tipo === "nfe" && " *"}</Label>
              <Select value={operacaoFiscalId} onValueChange={setOperacaoFiscalId}>
                <SelectTrigger><SelectValue placeholder="Selecione a operação"/></SelectTrigger>
                <SelectContent>
                  {operacoes.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo_cfop ? `${o.codigo_cfop} — ` : ""}{o.nome}{o.padrao ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Natureza da operação</Label><Input value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)}/></div>
          </div>

          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Itens</h4>
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1"><Plus className="w-3.5 h-3.5"/> Adicionar</Button>
            </div>
            {itens.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Nenhum item adicionado.</div>
            ) : itens.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border-t pt-2">
                <div className="col-span-3">
                  <Label className="text-[10px]">Tipo</Label>
                  <Select value={it.tipo_item} onValueChange={(v: any) => updItem(i, { tipo_item: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5">
                  <Label className="text-[10px]">Catálogo (opcional)</Label>
                  <Select
                    value={(it.tipo_item === "produto" ? it.produto_fiscal_id : it.servico_fiscal_id) || ""}
                    onValueChange={(v) => {
                      if (it.tipo_item === "produto") {
                        const p = produtos.find((x) => x.id === v);
                        updItem(i, { produto_fiscal_id: v, descricao: it.descricao || p?.nome || "", unidade: it.unidade || p?.unidade_comercial || "UN" });
                      } else {
                        const s = servicos.find((x) => x.id === v);
                        updItem(i, { servico_fiscal_id: v, descricao: it.descricao || s?.nome || "" });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      {(it.tipo_item === "produto" ? produtos : servicos).map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1"><Label className="text-[10px]">Qtd</Label><Input type="number" step="0.01" value={it.quantidade} onChange={(e) => updItem(i, { quantidade: parseFloat(e.target.value || "0") })}/></div>
                <div className="col-span-2"><Label className="text-[10px]">Vlr unit.</Label><Input type="number" step="0.01" value={it.valor_unitario} onChange={(e) => updItem(i, { valor_unitario: parseFloat(e.target.value || "0") })}/></div>
                <div className="col-span-1 flex justify-end"><Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="w-3.5 h-3.5"/></Button></div>
                <div className="col-span-12"><Label className="text-[10px]">Descrição</Label><Input value={it.descricao} onChange={(e) => updItem(i, { descricao: e.target.value })}/></div>
              </div>
            ))}
            <div className="flex justify-end text-sm pt-2 border-t">Total: <strong className="ml-2">{BRL(total)}</strong></div>
          </Card>

          <div className="text-xs text-muted-foreground">
            A nota será salva com status <strong>rascunho</strong> e não será transmitida. Emissão real será liberada na próxima fase.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/>}Salvar pré-nota</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

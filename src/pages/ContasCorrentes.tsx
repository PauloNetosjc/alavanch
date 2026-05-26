import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, Send, Search, FileText, Pencil, Trash2, CreditCard, Eye, ArrowLeft } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import FluxoCaixaDashboard from "@/components/financeiro/FluxoCaixaDashboard";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { useLoja } from "@/contexts/LojaContext";

type Conta = {
  id: string; nome: string; tipo: string | null; banco: string | null;
  agencia: string | null; conta: string | null; saldo_inicial: number | null;
  ativo: boolean | null; cor: string | null; loja_id: string | null;
};
type Cartao = {
  id: string; nome: string; ultimos_digitos: string | null; bandeira: string | null;
  dia_fechamento: number | null; dia_vencimento: number | null; conta_id: string | null; ativo: boolean | null; loja_id: string | null;
};


export default function ContasCorrentes() {
  const nav = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [busca, setBusca] = useState("");
  const [saldosAtuais, setSaldosAtuais] = useState<Record<string, number>>({});

  const [contaDialog, setContaDialog] = useState(false);
  const [editConta, setEditConta] = useState<Partial<Conta> | null>(null);

  const [cartaoDialog, setCartaoDialog] = useState(false);
  const [editCartao, setEditCartao] = useState<Partial<Cartao> | null>(null);

  const [transferDialog, setTransferDialog] = useState(false);
  const [transfer, setTransfer] = useState({ origem: "", destino: "", valor: "", data: new Date().toISOString().slice(0, 10) });

  const { selectedLojaId } = useLoja();
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  useEffect(() => {
    if (selectedLojaId) setLojasFiltro([selectedLojaId]); else setLojasFiltro([]);
  }, [selectedLojaId]);

  async function load() {
    const [{ data: c }, { data: ct }] = await Promise.all([
      supabase.from("contas_bancarias").select("*").order("created_at"),
      supabase.from("cartoes_credito").select("*").order("created_at"),
    ]);
    setContas((c as Conta[]) || []);
    setCartoes((ct as Cartao[]) || []);


    // Saldos atuais a partir de lancamentos_financeiros (status = pago/conciliado)
    const { data: lf } = await supabase
      .from("lancamentos_financeiros")
      .select("conta_id, tipo, valor, status");
    const map: Record<string, number> = {};
    (lf || []).forEach((l: any) => {
      if (!l.conta_id) return;
      if (!["pago", "conciliado", "recebido"].includes(l.status || "")) return;
      const v = Number(l.valor) || 0;
      map[l.conta_id] = (map[l.conta_id] || 0) + (l.tipo === "entrada" ? v : -v);
    });
    setSaldosAtuais(map);
  }
  useEffect(() => { load(); }, []);

  function saldoAtual(conta: Conta) {
    return Number(conta.saldo_inicial || 0) + (saldosAtuais[conta.id] || 0);
  }

  async function salvarConta() {
    if (!editConta?.nome) return toast.error("Nome obrigatório");
    const payload: any = {
      nome: editConta.nome, tipo: editConta.tipo || "corrente",
      banco: editConta.banco, agencia: editConta.agencia, conta: editConta.conta,
      saldo_inicial: Number(editConta.saldo_inicial) || 0,
      ativo: editConta.ativo ?? true, cor: editConta.cor || "#6366f1",
      loja_id: editConta.loja_id ?? selectedLojaId ?? null,
    };
    const q = editConta.id
      ? supabase.from("contas_bancarias").update(payload).eq("id", editConta.id)
      : supabase.from("contas_bancarias").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setContaDialog(false); setEditConta(null); load();
  }


  async function deletarConta(id: string) {
    if (!confirm("Excluir conta?")) return;
    const { error } = await supabase.from("contas_bancarias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function salvarCartao() {
    if (!editCartao?.nome) return toast.error("Nome obrigatório");
    const payload: any = {
      nome: editCartao.nome, ultimos_digitos: editCartao.ultimos_digitos,
      bandeira: editCartao.bandeira, dia_fechamento: Number(editCartao.dia_fechamento) || null,
      dia_vencimento: Number(editCartao.dia_vencimento) || null,
      conta_id: editCartao.conta_id || null, ativo: editCartao.ativo ?? true,
    };
    const q = editCartao.id
      ? supabase.from("cartoes_credito").update(payload).eq("id", editCartao.id)
      : supabase.from("cartoes_credito").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setCartaoDialog(false); setEditCartao(null); load();
  }

  async function deletarCartao(id: string) {
    if (!confirm("Excluir cartão?")) return;
    await supabase.from("cartoes_credito").delete().eq("id", id);
    load();
  }

  async function executarTransferencia() {
    const v = Number(transfer.valor);
    if (!transfer.origem || !transfer.destino || transfer.origem === transfer.destino || !v)
      return toast.error("Selecione origem, destino e valor");
    const { error } = await supabase.from("lancamentos_financeiros").insert([
      { tipo: "saida", conta_id: transfer.origem, valor: v, data_pagamento: transfer.data, status: "pago", descricao: "Transferência entre contas" },
      { tipo: "entrada", conta_id: transfer.destino, valor: v, data_pagamento: transfer.data, status: "recebido", descricao: "Transferência entre contas" },
    ]);
    if (error) return toast.error(error.message);
    toast.success("Transferência registrada");
    setTransferDialog(false); setTransfer({ origem: "", destino: "", valor: "", data: new Date().toISOString().slice(0, 10) });
    load();
  }

  const filtradas = contas.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="p-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav("/financeiro")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Financeiro
      </Button>

      {/* FLUXO DE CAIXA */}
      <FluxoCaixaDashboard />

      {/* CONTAS CORRENTES */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Contas Correntes</h2>
              <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias e portadores de pagamento</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setEditConta({}); setContaDialog(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Nova Conta
            </Button>
            <Button onClick={() => setTransferDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4 mr-1" /> Transferência entre Contas
            </Button>
          </div>
        </div>

        <div className="mt-6 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar conta..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-3 font-medium">Conta</th>
                <th className="text-left py-3 font-medium">Tipo</th>
                <th className="text-left py-3 font-medium">Banco / Agência</th>
                <th className="text-left py-3 font-medium">Conta</th>
                <th className="text-right py-3 font-medium">Saldo Atual</th>
                <th className="text-center py-3 font-medium">Status</th>
                <th className="text-right py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30">
                  <td className="py-4">
                    <button onClick={() => nav(`/contas/${c.id}/extrato`)} className="flex items-center gap-3 hover:text-primary text-left">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: (c.cor || "#6366f1") + "22" }}>
                        <Wallet className="w-4 h-4" style={{ color: c.cor || "#6366f1" }} />
                      </span>
                      <span className="font-medium">{c.nome}</span>
                    </button>
                  </td>
                  <td><Badge variant="secondary">{c.tipo === "poupanca" ? "Poupança" : "Conta Corrente"}</Badge></td>
                  <td className="text-muted-foreground">{c.banco || "—"}{c.agencia ? ` / ${c.agencia}` : ""}</td>
                  <td className="text-muted-foreground">{c.conta || "—"}</td>
                  <td className="text-right font-semibold">{BRL(saldoAtual(c))}</td>
                  <td className="text-center">
                    <Badge className={c.ativo ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20" : ""}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => nav(`/contas/${c.id}/extrato`)}><FileText className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditConta(c); setContaDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deletarConta(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtradas.length && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma conta cadastrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARTOES DE CREDITO */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Cartões de Crédito</h2>
              <p className="text-sm text-muted-foreground">Gerencie seus cartões de crédito vinculados às contas</p>
            </div>
          </div>
          <Button onClick={() => { setEditCartao({}); setCartaoDialog(true); }} className="bg-purple-600 hover:bg-purple-700">
            <CreditCard className="w-4 h-4 mr-1" /> Novo Cartão
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-3 font-medium">Cartão</th>
                <th className="text-left py-3 font-medium">Conta</th>
                <th className="text-left py-3 font-medium">Bandeira</th>
                <th className="text-left py-3 font-medium">Fechamento / Vencimento</th>
                <th className="text-center py-3 font-medium">Status</th>
                <th className="text-right py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cartoes.map((ct) => {
                const conta = contas.find((c) => c.id === ct.conta_id);
                return (
                  <tr key={ct.id} className="border-b hover:bg-muted/30">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><CreditCard className="w-4 h-4" /></span>
                        <div>
                          <div className="font-medium">{ct.nome}</div>
                          <div className="text-xs text-muted-foreground">**** {ct.ultimos_digitos || "----"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{conta?.nome || "—"}</td>
                    <td className="text-muted-foreground">{ct.bandeira || "—"}</td>
                    <td className="text-muted-foreground">
                      Fecha: dia {ct.dia_fechamento || "—"}<br />
                      Vence: dia {ct.dia_vencimento || "—"}
                    </td>
                    <td className="text-center">
                      <Badge className={ct.ativo ? "bg-emerald-500/15 text-emerald-700" : ""}>{ct.ativo ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditCartao(ct); setCartaoDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deletarCartao(ct.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!cartoes.length && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum cartão cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOG CONTA */}
      <Dialog open={contaDialog} onOpenChange={setContaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editConta?.id ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editConta?.nome || ""} onChange={(e) => setEditConta({ ...editConta, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={editConta?.tipo || "corrente"} onValueChange={(v) => setEditConta({ ...editConta, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cor</Label><Input type="color" value={editConta?.cor || "#6366f1"} onChange={(e) => setEditConta({ ...editConta, cor: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Banco</Label><Input value={editConta?.banco || ""} onChange={(e) => setEditConta({ ...editConta, banco: e.target.value })} /></div>
              <div><Label>Agência</Label><Input value={editConta?.agencia || ""} onChange={(e) => setEditConta({ ...editConta, agencia: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={editConta?.conta || ""} onChange={(e) => setEditConta({ ...editConta, conta: e.target.value })} /></div>
            </div>
            <div><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={editConta?.saldo_inicial ?? 0} onChange={(e) => setEditConta({ ...editConta, saldo_inicial: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setContaDialog(false)}>Cancelar</Button><Button onClick={salvarConta}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CARTAO */}
      <Dialog open={cartaoDialog} onOpenChange={setCartaoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCartao?.id ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editCartao?.nome || ""} onChange={(e) => setEditCartao({ ...editCartao, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Últimos 4 dígitos</Label><Input maxLength={4} value={editCartao?.ultimos_digitos || ""} onChange={(e) => setEditCartao({ ...editCartao, ultimos_digitos: e.target.value })} /></div>
              <div><Label>Bandeira</Label><Input value={editCartao?.bandeira || ""} onChange={(e) => setEditCartao({ ...editCartao, bandeira: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia fechamento</Label><Input type="number" value={editCartao?.dia_fechamento ?? ""} onChange={(e) => setEditCartao({ ...editCartao, dia_fechamento: Number(e.target.value) })} /></div>
              <div><Label>Dia vencimento</Label><Input type="number" value={editCartao?.dia_vencimento ?? ""} onChange={(e) => setEditCartao({ ...editCartao, dia_vencimento: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Conta vinculada</Label>
              <Select value={editCartao?.conta_id || ""} onValueChange={(v) => setEditCartao({ ...editCartao, conta_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setCartaoDialog(false)}>Cancelar</Button><Button onClick={salvarCartao}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG TRANSFERENCIA */}
      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transferência entre contas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Origem</Label>
              <Select value={transfer.origem} onValueChange={(v) => setTransfer({ ...transfer, origem: v })}>
                <SelectTrigger><SelectValue placeholder="Conta de origem" /></SelectTrigger>
                <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Destino</Label>
              <Select value={transfer.destino} onValueChange={(v) => setTransfer({ ...transfer, destino: v })}>
                <SelectTrigger><SelectValue placeholder="Conta de destino" /></SelectTrigger>
                <SelectContent>{contas.filter((c) => c.id !== transfer.origem).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" step="0.01" value={transfer.valor} onChange={(e) => setTransfer({ ...transfer, valor: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={transfer.data} onChange={(e) => setTransfer({ ...transfer, data: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setTransferDialog(false)}>Cancelar</Button><Button onClick={executarTransferencia}>Transferir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, Search, ExternalLink, Check, FileText, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import { useLoja } from "@/contexts/LojaContext";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { usePermissions } from "@/hooks/usePermissions";

type Row = {
  id: string;
  solicitacao_id: string;
  pedido_id: string;
  contrato_id: string | null;
  tipo_documento: "contrato" | "adendo" | "complemento" | string;
  loja_id: string | null;
  cliente_id: string | null;
  valor_total: number;
  data_assinatura: string | null;
  status: "pendente" | "checado" | string;
  checado_por: string | null;
  checado_em: string | null;
  observacao: string | null;
  // joins
  pedido_codigo?: string | null;
  cliente_nome?: string | null;
  loja_nome?: string | null;
  contrato_numero?: string | null;
  responsavel?: string | null;
  checado_por_nome?: string | null;
  observacao_contrato?: string | null;
  // parcelas resumo
  parcelas_qtd?: number;
  parcelas_valor_total?: number;
  parcelas_proximo_venc?: string | null;
  boletos_qtd?: number;
};

const TIPO_LABEL: Record<string, string> = {
  contrato: "Contrato",
  adendo: "Adendo",
  complemento: "Complemento",
};

const TIPO_COLOR: Record<string, string> = {
  contrato: "bg-blue-100 text-blue-700 border-blue-200",
  adendo: "bg-amber-100 text-amber-700 border-amber-200",
  complemento: "bg-purple-100 text-purple-700 border-purple-200",
};

function fmtData(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  return x.toLocaleDateString("pt-BR");
}

function fmtDataHora(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

export default function ChecagemContratos() {
  const { can } = usePermissions();
  const { selectedLojaId } = useLoja();
  const [statusFiltro, setStatusFiltro] = useState<"pendente" | "checado" | "todos">("pendente");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "contrato" | "adendo" | "complemento">("todos");
  const [busca, setBusca] = useState("");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [obs, setObs] = useState("");

  async function carregar() {
    setLoading(true);
    try {
      let q = supabase
        .from("checagem_contratos_financeiro" as any)
        .select(`
          id, solicitacao_id, pedido_id, contrato_id, tipo_documento, loja_id, cliente_id,
          valor_total, data_assinatura, status, checado_por, checado_em, observacao
        `)
        .order("data_assinatura", { ascending: false })
        .limit(500);

      if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);
      if (tipoFiltro !== "todos") q = q.eq("tipo_documento", tipoFiltro);
      if (dataIni) q = q.gte("data_assinatura", dataIni);
      if (dataFim) q = q.lte("data_assinatura", `${dataFim}T23:59:59`);
      if (lojasFiltro.length > 0) q = q.in("loja_id", lojasFiltro);

      const { data, error } = await q;
      if (error) throw error;
      const base = (data || []) as any as Row[];

      // hidratar joins em paralelo
      const pedidoIds = Array.from(new Set(base.map((r) => r.pedido_id).filter(Boolean)));
      const clienteIds = Array.from(new Set(base.map((r) => r.cliente_id).filter(Boolean) as string[]));
      const lojaIds = Array.from(new Set(base.map((r) => r.loja_id).filter(Boolean) as string[]));
      const contratoIds = Array.from(new Set(base.map((r) => r.contrato_id).filter(Boolean) as string[]));
      const solicIds = base.map((r) => r.solicitacao_id);
      const checadorIds = Array.from(new Set(base.map((r) => r.checado_por).filter(Boolean) as string[]));

      const [peds, cls, ljs, ctrs, solics, lancs, profs] = await Promise.all([
        pedidoIds.length ? supabase.from("pedidos").select("id,codigo,observacoes_venda").in("id", pedidoIds) : Promise.resolve({ data: [] as any[] }),
        clienteIds.length ? supabase.from("clientes").select("id,nome").in("id", clienteIds) : Promise.resolve({ data: [] as any[] }),
        lojaIds.length ? supabase.from("lojas").select("id,nome").in("id", lojaIds) : Promise.resolve({ data: [] as any[] }),
        contratoIds.length ? supabase.from("contratos").select("id,numero,observacoes_adicionais").in("id", contratoIds) : Promise.resolve({ data: [] as any[] }),
        solicIds.length ? supabase.from("solicitacoes_assinatura").select("id,responsavel_interno_id,observacao").in("id", solicIds) : Promise.resolve({ data: [] as any[] }),
        pedidoIds.length
          ? supabase.from("lancamentos_financeiros")
              .select("pedido_id,valor,data_vencimento,forma_pagamento_prevista,forma_pagamento,tipo,status")
              .in("pedido_id", pedidoIds)
              .eq("tipo", "entrada")
          : Promise.resolve({ data: [] as any[] }),
        checadorIds.length
          ? supabase.from("profiles").select("user_id,nome_completo").in("user_id", checadorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pedM = new Map((peds.data || []).map((p: any) => [p.id, p]));
      const clM = new Map((cls.data || []).map((c: any) => [c.id, c]));
      const ljM = new Map((ljs.data || []).map((l: any) => [l.id, l]));
      const ctrM = new Map((ctrs.data || []).map((c: any) => [c.id, c]));
      const soM = new Map((solics.data || []).map((s: any) => [s.id, s]));
      const profM = new Map((profs.data || []).map((p: any) => [p.user_id, p]));

      // Responsáveis (interno) -> nome
      const respIds = Array.from(new Set(
        (solics.data || []).map((s: any) => s.responsavel_interno_id).filter(Boolean) as string[]
      ));
      const respM = new Map<string, string>();
      if (respIds.length) {
        const { data: rps } = await supabase.from("profiles").select("user_id,nome_completo").in("user_id", respIds);
        (rps || []).forEach((p: any) => respM.set(p.user_id, p.nome_completo));
      }

      // Agrupar parcelas por pedido_id
      const parcelasByPedido = new Map<string, any[]>();
      (lancs.data || []).forEach((l: any) => {
        const arr = parcelasByPedido.get(l.pedido_id) || [];
        arr.push(l);
        parcelasByPedido.set(l.pedido_id, arr);
      });

      const isBoleto = (forma?: string | null) =>
        !!forma && /boleto/i.test(forma);

      const final = base.map<Row>((r) => {
        const ped = pedM.get(r.pedido_id);
        const so = soM.get(r.solicitacao_id);
        const parcelas = parcelasByPedido.get(r.pedido_id) || [];
        const proximo = parcelas
          .map((p) => p.data_vencimento)
          .filter(Boolean)
          .sort()[0] || null;
        const boletos = parcelas.filter(
          (p) => isBoleto(p.forma_pagamento_prevista) || isBoleto(p.forma_pagamento)
        ).length;
        return {
          ...r,
          pedido_codigo: ped?.codigo || null,
          cliente_nome: r.cliente_id ? clM.get(r.cliente_id)?.nome || null : null,
          loja_nome: r.loja_id ? ljM.get(r.loja_id)?.nome || null : null,
          contrato_numero: r.contrato_id ? ctrM.get(r.contrato_id)?.numero || null : null,
          observacao_contrato: (r.contrato_id ? ctrM.get(r.contrato_id)?.observacoes_adicionais : null) || ped?.observacoes_venda || null,
          responsavel: so?.responsavel_interno_id ? respM.get(so.responsavel_interno_id) || null : null,
          checado_por_nome: r.checado_por ? profM.get(r.checado_por)?.nome_completo || null : null,
          parcelas_qtd: parcelas.length,
          parcelas_valor_total: parcelas.reduce((s, p) => s + Number(p.valor || 0), 0),
          parcelas_proximo_venc: proximo,
          boletos_qtd: boletos,
        };
      });

      setRows(final);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar checagem");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro, tipoFiltro, dataIni, dataFim, JSON.stringify(lojasFiltro)]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.cliente_nome, r.pedido_codigo, r.contrato_numero, r.responsavel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, busca]);

  const totalPendentes = rows.filter((r) => r.status === "pendente").length;
  const totalChecados = rows.filter((r) => r.status === "checado").length;

  async function confirmarChecagem() {
    if (!confirmRow) return;
    if (!can("checagem_contratos", "confirm") && !can("financeiro", "approve")) {
      toast.error("Você não tem permissão para confirmar a checagem.");
      return;
    }
    try {
      const { data: ures } = await supabase.auth.getUser();
      const userId = ures?.user?.id || null;
      const { error } = await supabase
        .from("checagem_contratos_financeiro" as any)
        .update({
          status: "checado",
          checado_em: new Date().toISOString(),
          checado_por: userId,
          observacao: obs.trim() || null,
        })
        .eq("id", confirmRow.id);
      if (error) throw error;

      toast.success("Checagem confirmada");
      setConfirmRow(null);
      setObs("");
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Erro ao confirmar");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Checagem de Contratos</h1>
            <p className="text-sm text-muted-foreground">
              Conferência financeira de contratos, adendos e complementos assinados.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
            {totalPendentes} pendente{totalPendentes === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
            {totalChecados} checado{totalChecados === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-card p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFiltro} onValueChange={(v: any) => setStatusFiltro(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="checado">Checados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipoFiltro} onValueChange={(v: any) => setTipoFiltro(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="contrato">Contratos</SelectItem>
              <SelectItem value="adendo">Adendos</SelectItem>
              <SelectItem value="complemento">Complementos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Assinado de</Label>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Assinado até</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Cliente, PV, contrato ou responsável…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="md:col-span-6">
          <LojasFilter value={lojasFiltro} onChange={setLojasFiltro} />
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assinatura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>PV</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Parcelas</TableHead>
              <TableHead>Próx. venc.</TableHead>
              <TableHead className="text-center">Boletos</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                Nenhum contrato {statusFiltro === "pendente" ? "pendente de checagem" : "encontrado"}.
              </TableCell></TableRow>
            ) : filtradas.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtData(r.data_assinatura)}</TableCell>
                <TableCell className="font-medium">{r.cliente_nome || "—"}</TableCell>
                <TableCell>{r.pedido_codigo || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={TIPO_COLOR[r.tipo_documento] || ""}>
                    {TIPO_LABEL[r.tipo_documento] || r.tipo_documento}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{r.contrato_numero || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL(Number(r.valor_total || 0))}</TableCell>
                <TableCell className="text-center">
                  {r.parcelas_qtd
                    ? <span className="text-xs">{r.parcelas_qtd}× {BRL((r.parcelas_valor_total || 0) / Math.max(r.parcelas_qtd, 1))}</span>
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">{fmtData(r.parcelas_proximo_venc)}</TableCell>
                <TableCell className="text-center">
                  {r.boletos_qtd
                    ? <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-700">{r.boletos_qtd}</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="text-xs">{r.loja_nome || "—"}</TableCell>
                <TableCell className="text-xs">{r.responsavel || "—"}</TableCell>
                <TableCell>
                  {r.status === "checado" ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                      Checado
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                      Pendente
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {r.status === "checado" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="px-2" title="Informações da checagem">
                          <Info className="w-4 h-4 text-emerald-600" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-xs space-y-1.5" align="end">
                        <div className="font-medium text-sm flex items-center gap-1.5 text-emerald-700">
                          <ClipboardCheck className="w-4 h-4" /> Checagem confirmada
                        </div>
                        <div className="border-t pt-1.5 space-y-1">
                          <div><span className="text-muted-foreground">Usuário:</span> <strong>{r.checado_por_nome || "—"}</strong></div>
                          <div><span className="text-muted-foreground">Data/hora:</span> {fmtDataHora(r.checado_em)}</div>
                          {r.observacao && (
                            <div>
                              <div className="text-muted-foreground mt-1">Observação:</div>
                              <div className="whitespace-pre-wrap">{r.observacao}</div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  <Link to={`/pedido/${r.pedido_id}`} target="_blank">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir Pedido
                    </Button>
                  </Link>
                  {r.status === "pendente" && (
                    <Button
                      size="sm"
                      onClick={() => { setConfirmRow(r); setObs(""); }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Confirmar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal confirmar */}
      <Dialog open={!!confirmRow} onOpenChange={(o) => { if (!o) { setConfirmRow(null); setObs(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              Confirmar checagem financeira
            </DialogTitle>
          </DialogHeader>
          {confirmRow && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/30 space-y-1">
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{confirmRow.cliente_nome || "—"}</strong></div>
                <div><span className="text-muted-foreground">PV:</span> {confirmRow.pedido_codigo || "—"}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {TIPO_LABEL[confirmRow.tipo_documento] || confirmRow.tipo_documento}</div>
                <div><span className="text-muted-foreground">Valor:</span> <strong>{BRL(Number(confirmRow.valor_total || 0))}</strong></div>
                <div><span className="text-muted-foreground">Parcelas:</span> {confirmRow.parcelas_qtd || 0} • Boletos: {confirmRow.boletos_qtd || 0}</div>
                {confirmRow.observacao_contrato && (
                  <div className="pt-1 border-t mt-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Observações do contrato
                    </div>
                    <div className="text-xs whitespace-pre-wrap">{confirmRow.observacao_contrato}</div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Antes de confirmar, revise: valores, forma de pagamento, parcelas, vencimentos, juros,
                boletos a emitir e observações do contrato.
              </p>
              <div>
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas da checagem financeira…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmRow(null); setObs(""); }}>Cancelar</Button>
            <Button onClick={confirmarChecagem}>
              <Check className="w-4 h-4 mr-1" /> Confirmar checagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

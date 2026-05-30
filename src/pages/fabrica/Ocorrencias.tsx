import { useEffect, useMemo, useState } from "react";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, AlertTriangle, Search } from "lucide-react";
import {
  listarOcorrencias,
  TIPO_OCORRENCIA_LABEL,
  SETOR_LABEL,
  PRIORIDADE_LABEL,
  STATUS_OCORRENCIA_LABEL,
  STATUS_ABERTOS,
  prioridadeBadge,
  statusOcorrenciaBadge,
} from "@/lib/fabrica/ocorrencias";
import { NovaOcorrenciaDialog } from "@/components/fabrica/NovaOcorrenciaDialog";
import { OcorrenciaDetalheSheet } from "@/components/fabrica/OcorrenciaDetalheSheet";

export default function Ocorrencias() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<any[]>([]);
  const [novaOpen, setNovaOpen] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  // filtros
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("abertas");
  const [fTipo, setFTipo] = useState<string>("");
  const [fSetor, setFSetor] = useState<string>("");
  const [fPrior, setFPrior] = useState<string>("");

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarOcorrencias({ lojaId: selectedLojaId });
      setTodos(lista);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [selectedLojaId]);

  const filtrados = useMemo(() => {
    return todos.filter((o) => {
      if (fStatus === "abertas" && !STATUS_ABERTOS.includes(o.status)) return false;
      if (fStatus === "resolvida" && o.status !== "resolvida") return false;
      if (fStatus === "cancelada" && o.status !== "cancelada") return false;
      if (fStatus && !["abertas","resolvida","cancelada","todos"].includes(fStatus) && o.status !== fStatus) return false;
      if (fTipo && o.tipo_ocorrencia !== fTipo) return false;
      if (fSetor && o.setor_responsavel !== fSetor) return false;
      if (fPrior && o.prioridade !== fPrior) return false;
      if (busca) {
        const t = busca.toLowerCase();
        const hay = `${o.codigo || ""} ${o.titulo || ""} ${o.descricao || ""} ${o.pedido?.codigo || ""} ${o.pedido?.cliente?.nome || ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [todos, busca, fStatus, fTipo, fSetor, fPrior]);

  const kpis = useMemo(() => {
    const abertas = todos.filter((o) => STATUS_ABERTOS.includes(o.status));
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
    return {
      abertas: abertas.length,
      em_analise: todos.filter((o) => o.status === "em_analise").length,
      em_reproducao: todos.filter((o) => o.status === "em_reproducao").length,
      aguardando_compra: todos.filter((o) => o.status === "aguardando_compra").length,
      resolvidas_mes: todos.filter((o) => o.status === "resolvida" && o.data_resolucao && new Date(o.data_resolucao) >= inicioMes).length,
      criticas: abertas.filter((o) => o.prioridade === "critica").length,
      pecas_faltantes: abertas.filter((o) => o.tipo_ocorrencia === "peca_faltante").length,
      almox_faltantes: abertas.filter((o) => o.tipo_ocorrencia === "ferragem_item_faltante").length,
    };
  }, [todos]);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-amber-700" />
        <div className="flex-1">
          <div className="font-semibold">Ocorrências da Fábrica</div>
          <div className="text-xs text-muted-foreground">Falhas de produção, conferência, almoxarifado e expedição em um só lugar.</div>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
        <Button size="sm" onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova ocorrência</Button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { l: "Abertas", v: kpis.abertas, c: "text-red-700" },
          { l: "Em análise", v: kpis.em_analise, c: "text-amber-700" },
          { l: "Em reprodução", v: kpis.em_reproducao, c: "text-amber-700" },
          { l: "Aguard. compra", v: kpis.aguardando_compra, c: "text-violet-700" },
          { l: "Resolv. no mês", v: kpis.resolvidas_mes, c: "text-emerald-700" },
          { l: "Críticas", v: kpis.criticas, c: "text-red-700" },
          { l: "Peças faltantes", v: kpis.pecas_faltantes, c: "text-red-700" },
          { l: "Itens almox.", v: kpis.almox_faltantes, c: "text-red-700" },
        ].map((k) => (
          <Card key={k.l} className="p-3">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <div className="lg:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por código, título, pedido, cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Abertas</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_OCORRENCIA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fTipo || "all"} onValueChange={(v) => setFTipo(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_OCORRENCIA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSetor || "all"} onValueChange={(v) => setFSetor(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {Object.entries(SETOR_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPrior || "all"} onValueChange={(v) => setFPrior(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma ocorrência encontrada.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aberta</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                  <TableCell className="text-xs">{o.pedido?.codigo || o.pedido_id.slice(0, 8)}</TableCell>
                  <TableCell>{o.pedido?.cliente?.nome || "—"}</TableCell>
                  <TableCell className="text-xs">{TIPO_OCORRENCIA_LABEL[o.tipo_ocorrencia] || o.tipo_ocorrencia}</TableCell>
                  <TableCell className="text-xs">{SETOR_LABEL[o.setor_responsavel] || o.setor_responsavel}</TableCell>
                  <TableCell><Badge variant="outline" className={prioridadeBadge(o.prioridade)}>{PRIORIDADE_LABEL[o.prioridade]}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={statusOcorrenciaBadge(o.status)}>{STATUS_OCORRENCIA_LABEL[o.status]}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(o.data_abertura).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setAberta(o.id)}>Ver</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NovaOcorrenciaDialog open={novaOpen} onOpenChange={setNovaOpen} onCreated={() => carregar()} />
      <OcorrenciaDetalheSheet ocorrenciaId={aberta} onOpenChange={(o) => !o && setAberta(null)} onChanged={carregar} />
    </div>
  );
}

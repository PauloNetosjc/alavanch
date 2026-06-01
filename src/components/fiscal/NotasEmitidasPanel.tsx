import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Loader2, Eye, Download, Send, RefreshCw, XCircle } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import { emitirNfeHomologacao } from "@/lib/fiscal/emitirNFe";
import { podeEmitirNfe } from "@/lib/fiscal/statusNFe";

type NF = {
  id: string; tipo: string; modelo: string | null; numero: string | null; serie: string | null;
  chave: string | null; chave_acesso: string | null; status: string; ambiente: string | null;
  valor_total: number; valor_produtos: number | null; valor_servicos: number | null; valor_impostos: number | null;
  data_emissao: string | null; data_autorizacao: string | null; data_cancelamento: string | null;
  motivo_rejeicao: string | null; mensagem_retorno: string | null; codigo_retorno: string | null;
  pedido_id: string | null; cliente_id: string | null; created_at: string;
  xml_storage_path: string | null; pdf_storage_path: string | null; danfe_storage_path: string | null;
  xml_url: string | null; xml_autorizado_url: string | null; danfe_url: string | null; retorno_sefaz_url: string | null;
  protocolo_autorizacao: string | null;
};

const STATUS = ["rascunho","pronta_para_emitir","assinada","enviada","autorizada","rejeitada","denegada","cancelada","inutilizada","erro_transmissao","aguardando_consulta"];

function statusColor(s: string) {
  const m: Record<string,string> = {
    autorizada: "bg-emerald-100 text-emerald-800",
    rejeitada: "bg-red-100 text-red-800",
    denegada: "bg-red-100 text-red-800",
    cancelada: "bg-amber-100 text-amber-800",
    inutilizada: "bg-muted text-foreground",
    rascunho: "bg-muted text-foreground",
    pronta_para_emitir: "bg-blue-100 text-blue-800",
    assinada: "bg-blue-100 text-blue-800",
    enviada: "bg-blue-100 text-blue-800",
    aguardando_consulta: "bg-blue-100 text-blue-800",
    erro_transmissao: "bg-red-100 text-red-800",
  };
  return m[s] || "bg-muted text-foreground";
}

export function NotasEmitidasPanel() {
  const { selectedLojaId } = useLoja();
  const [rows, setRows] = useState<NF[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [periodoIni, setPeriodoIni] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [detalhe, setDetalhe] = useState<NF | null>(null);

  const load = async () => {
    if (!selectedLojaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notas_fiscais" as any)
      .select("*")
      .eq("loja_id", selectedLojaId)
      .order("created_at", { ascending: false });
    setRows((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedLojaId]);

  const lista = useMemo(() => rows.filter((n) => {
    if (tipo !== "todos" && n.tipo !== tipo) return false;
    if (status !== "todos" && n.status !== status) return false;
    if (periodoIni && n.created_at < periodoIni) return false;
    if (periodoFim && n.created_at > periodoFim + "T23:59:59") return false;
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (n.numero || "").toLowerCase().includes(q) || (n.chave || "").toLowerCase().includes(q);
  }), [rows, tipo, status, busca, periodoIni, periodoFim]);

  async function baixarArquivo(bucket: string, path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  }

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display flex items-center gap-2"><FileText className="w-5 h-5"/> Notas Emitidas</h2>

      <Card className="p-3 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div className="col-span-2"><Label className="text-xs">Buscar</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número ou chave"/></div>
        <div><Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="nfse">NFS-e</SelectItem>
              <SelectItem value="nfce">NFC-e</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">De</Label><Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)}/></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)}/></div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
        ) : lista.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma nota encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Número/Série</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Ambiente</th>
                  <th className="text-right p-2">Valor</th>
                  <th className="text-left p-2">Emissão</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((n) => (
                  <tr key={n.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 uppercase text-xs">{n.tipo}</td>
                    <td className="p-2 text-xs">{n.numero || "—"}{n.serie ? `/${n.serie}` : ""}</td>
                    <td className="p-2"><Badge className={`${statusColor(n.status)} border-0`}>{n.status.replace("_"," ")}</Badge></td>
                    <td className="p-2 text-xs">{n.ambiente || "—"}</td>
                    <td className="p-2 text-right">{BRL(n.valor_total)}</td>
                    <td className="p-2 text-xs">{n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : new Date(n.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetalhe(n)}><Eye className="w-3.5 h-3.5"/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detalhe && (
        <Sheet open onOpenChange={(o) => !o && setDetalhe(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5"/> Nota {detalhe.tipo.toUpperCase()} {detalhe.numero || "(sem número)"}
                <Badge className={`${statusColor(detalhe.status)} border-0 ml-2`}>{detalhe.status.replace("_"," ")}</Badge>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3 text-sm">
              <Linha k="Tipo / Modelo" v={`${detalhe.tipo.toUpperCase()} ${detalhe.modelo ? `(${detalhe.modelo})` : ""}`}/>
              <Linha k="Série / Número" v={`${detalhe.serie || "—"} / ${detalhe.numero || "—"}`}/>
              <Linha k="Chave de acesso" v={detalhe.chave}/>
              <Linha k="Ambiente" v={detalhe.ambiente}/>
              <Linha k="Valor total" v={BRL(detalhe.valor_total)}/>
              <Linha k="Valor produtos" v={detalhe.valor_produtos != null ? BRL(detalhe.valor_produtos) : "—"}/>
              <Linha k="Valor serviços" v={detalhe.valor_servicos != null ? BRL(detalhe.valor_servicos) : "—"}/>
              <Linha k="Valor impostos" v={detalhe.valor_impostos != null ? BRL(detalhe.valor_impostos) : "—"}/>
              <Linha k="Emissão" v={detalhe.data_emissao ? new Date(detalhe.data_emissao).toLocaleString("pt-BR") : "—"}/>
              <Linha k="Autorização" v={detalhe.data_autorizacao ? new Date(detalhe.data_autorizacao).toLocaleString("pt-BR") : "—"}/>
              <Linha k="Cancelamento" v={detalhe.data_cancelamento ? new Date(detalhe.data_cancelamento).toLocaleString("pt-BR") : "—"}/>
              <Linha k="Código retorno" v={detalhe.codigo_retorno}/>
              <Linha k="Mensagem" v={detalhe.mensagem_retorno || detalhe.motivo_rejeicao}/>

              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button size="sm" variant="outline" className="gap-1" disabled={!detalhe.xml_storage_path}
                  onClick={() => baixarArquivo("notas-fiscais", detalhe.xml_storage_path)}>
                  <Download className="w-3.5 h-3.5"/> XML
                </Button>
                <Button size="sm" variant="outline" className="gap-1" disabled={!detalhe.pdf_storage_path && !detalhe.danfe_storage_path}
                  onClick={() => baixarArquivo("notas-fiscais", detalhe.pdf_storage_path || detalhe.danfe_storage_path)}>
                  <Download className="w-3.5 h-3.5"/> {detalhe.tipo === "nfse" ? "PDF" : "DANFE"}
                </Button>
                <DisabledAcao icon={<Send className="w-3.5 h-3.5"/>} label="Emitir"/>
                <DisabledAcao icon={<RefreshCw className="w-3.5 h-3.5"/>} label="Consultar status"/>
                <DisabledAcao icon={<XCircle className="w-3.5 h-3.5"/>} label="Cancelar"/>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: any }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 border-b last:border-0">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="col-span-2 break-all">{v || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function DisabledAcao({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Button size="sm" variant="outline" className="gap-1" disabled>{icon}{label}</Button></span>
        </TooltipTrigger>
        <TooltipContent>Disponível na próxima fase: emissão em homologação.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

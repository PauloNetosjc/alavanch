import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Eye, ExternalLink, RefreshCcw, Ban, PenLine, FileDown, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EvidenciasDialog } from "@/components/assinaturas/EvidenciasDialog";
import { AssinarPelaLojaDialog } from "@/components/assinaturas/AssinarPelaLojaDialog";
import { usePermissions } from "@/hooks/usePermissions";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_cliente: "Aguardando cliente",
  assinado_cliente: "Assinado pelo cliente",
  aguardando_loja: "Aguardando loja",
  assinado_loja: "Assinado pela loja",
  concluido: "Concluído",
  recusado: "Recusado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const STATUS_VARIANT: Record<string, any> = {
  concluido: "default",
  cancelado: "destructive",
  recusado: "destructive",
  expirado: "secondary",
};

export default function Assinaturas() {
  const { can } = usePermissions();
  const [items, setItems] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [tipoF, setTipoF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [evidId, setEvidId] = useState<string | null>(null);
  const [assinarId, setAssinarId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const baixarPdf = async (id: string) => {
    setPdfBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("assinatura-pdf-final", {
        body: { solicitacao_id: id },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Falha ao gerar PDF");
      window.open(data.url, "_blank");
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  async function load() {
    const { data } = await supabase
      .from("solicitacoes_assinatura")
      .select(`*,
        tipo:tipos_documento(slug,nome,requer_assinatura_loja),
        pedido:pedidos(id,codigo),
        cliente:clientes(nome),
        loja:lojas(nome)`)
      .order("created_at", { ascending: false })
      .limit(500);
    setItems(data || []);
  }
  useEffect(() => {
    load();
    supabase.from("tipos_documento").select("*").then(({ data }) => setTipos(data || []));
  }, []);

  const filtered = items.filter((i) => {
    if (tipoF !== "all" && i.tipo_documento_id !== tipoF) return false;
    if (statusF !== "all" && i.status !== statusF) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (
        !(i.pedido?.codigo || "").toLowerCase().includes(q) &&
        !(i.cliente?.nome || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/assinatura/${token}`);
    toast.success("Link copiado");
  };

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar esta solicitação?")) return;
    await supabase.from("solicitacoes_assinatura").update({
      status: "cancelado", cancelado_em: new Date().toISOString(),
    }).eq("id", id);
    await supabase.from("assinatura_eventos").insert({
      solicitacao_id: id, tipo_evento: "cancelada", status_novo: "cancelado",
      descricao: "Solicitação cancelada",
    });
    toast.success("Cancelada"); load();
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={PenLine} iconVariant="green" title="Assinaturas Digitais" subtitle="Solicitações enviadas para clientes e loja" />

      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Buscar por pedido ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Select value={tipoF} onValueChange={setTipoF}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}><RefreshCcw className="w-4 h-4 mr-1" /> Atualizar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente assinou</TableHead>
                <TableHead>Loja assinou</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link to={`/pedidos/${i.pedido_id}`} className="text-primary hover:underline">
                      {i.pedido?.codigo || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{i.cliente?.nome || "—"}</TableCell>
                  <TableCell>{i.tipo?.nome}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.status] || "outline"}>{STATUS_LABEL[i.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{i.cliente_assinado_em ? new Date(i.cliente_assinado_em).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-xs">{i.loja_assinado_em ? new Date(i.loja_assinado_em).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(i.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" title="Copiar link" onClick={() => copyLink(i.token)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Abrir link" asChild>
                      <a href={`/assinatura/${i.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button size="icon" variant="ghost" title="Evidências" onClick={() => setEvidId(i.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {i.status === "aguardando_loja" && can("assinaturas", "assinar_loja") && (
                      <Button size="icon" variant="ghost" title="Assinar pela loja" onClick={() => setAssinarId(i.id)}>
                        <PenLine className="w-4 h-4 text-emerald-600" />
                      </Button>
                    )}
                    {["concluido", "assinado_loja"].includes(i.status) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Baixar PDF final assinado"
                        disabled={pdfBusy === i.id}
                        onClick={() => baixarPdf(i.id)}
                      >
                        {pdfBusy === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-emerald-600" />}
                      </Button>
                    )}
                    {!["concluido", "cancelado", "expirado"].includes(i.status) && (
                      <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelar(i.id)}>
                        <Ban className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EvidenciasDialog open={!!evidId} onOpenChange={(v) => !v && setEvidId(null)} solicitacaoId={evidId} />
      <AssinarPelaLojaDialog open={!!assinarId} onOpenChange={(v) => !v && setAssinarId(null)} solicitacaoId={assinarId} onDone={load} />
    </div>
  );
}

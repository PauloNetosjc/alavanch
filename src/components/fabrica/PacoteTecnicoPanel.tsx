import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, FileArchive, Layers, Tag, FileText, ExternalLink } from "lucide-react";
import { getSignedUrlPacoteTecnico } from "@/lib/fabrica/importacaoTecnica";
import { DadosVetoriaisPanel } from "@/components/fabrica/DadosVetoriaisPanel";

interface Props {
  pedidoId?: string | null;
  loteId?: string | null;
}

export function PacoteTecnicoPanel({ pedidoId, loteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [importacoes, setImportacoes] = useState<any[]>([]);
  const [chapas, setChapas] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<any[]>([]);

  async function carregar() {
    if (!pedidoId && !loteId) { setLoading(false); return; }
    setLoading(true);
    const filtro = pedidoId ? { col: "pedido_id", val: pedidoId } : { col: "lote_id", val: loteId! };
    const [imp, ch, et, ar] = await Promise.all([
      (supabase as any).from("fabrica_importacoes_tecnicas").select("*").eq(filtro.col, filtro.val).order("created_at", { ascending: false }),
      (supabase as any).from("fabrica_chapas_lote").select("*").eq(filtro.col, filtro.val).order("ordem_chapa", { ascending: true }),
      (supabase as any).from("fabrica_etiquetas").select("*").eq(filtro.col, filtro.val).order("codigo_etiqueta_completo", { ascending: true }).limit(500),
      (supabase as any).from("fabrica_arquivos_tecnicos").select("*").eq(filtro.col, filtro.val).order("origem_pasta", { ascending: true }).limit(1000),
    ]);
    setImportacoes(imp.data || []);
    setChapas(ch.data || []);
    setEtiquetas(et.data || []);
    setArquivos(ar.data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [pedidoId, loteId]);

  async function abrir(path: string) {
    const u = await getSignedUrlPacoteTecnico(path, 3600);
    if (u) window.open(u, "_blank");
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const pdfs = arquivos.filter((a) => ["lista_corte_pdf","preview_corte_pdf","relatorio_almoxarifado_pdf","labels_pdf"].includes(a.tipo_arquivo));

  return (
    <div className="space-y-3">
      {importacoes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma importação técnica encontrada para {pedidoId ? "este pedido" : "este lote"}.
        </Card>
      ) : (
        <>
          {/* Dados vetoriais para a importação mais recente */}
          {importacoes[0]?.id && <DadosVetoriaisPanel importacaoId={importacoes[0].id} compact />}

        <Tabs defaultValue="importacoes" className="space-y-3">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="importacoes"><FileArchive className="h-3 w-3 mr-1" /> Importações ({importacoes.length})</TabsTrigger>
            <TabsTrigger value="chapas"><Layers className="h-3 w-3 mr-1" /> Chapas ({chapas.length})</TabsTrigger>
            <TabsTrigger value="etiquetas"><Tag className="h-3 w-3 mr-1" /> Etiquetas ({etiquetas.length})</TabsTrigger>
            <TabsTrigger value="pdfs"><FileText className="h-3 w-3 mr-1" /> PDFs ({pdfs.length})</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos técnicos ({arquivos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="importacoes" className="space-y-2">
            {importacoes.map((i) => (
              <Card key={i.id} className="p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium">{i.arquivo_original_nome || "Pacote técnico"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(i.data_importacao).toLocaleString("pt-BR")} • {i.tipo_importacao === "individual" ? "Individual" : "Lote multi-cliente"}
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    i.status_importacao === "processado" ? "bg-green-50 text-green-700 border-green-200" :
                    i.status_importacao === "processado_com_alertas" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    i.status_importacao === "erro" ? "bg-red-50 text-red-700 border-red-200" : ""
                  }>{i.status_importacao}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                  <div><div className="text-muted-foreground">Arquivos</div><div className="font-medium">{i.total_arquivos}</div></div>
                  <div><div className="text-muted-foreground">Chapas</div><div className="font-medium">{i.total_chapas}</div></div>
                  <div><div className="text-muted-foreground">Etiquetas</div><div className="font-medium">{i.total_etiquetas}</div></div>
                  <div><div className="text-muted-foreground">Catalogados</div><div className="font-medium">{i.total_arquivos_tecnicos}</div></div>
                </div>
                {i.mensagem_processamento && <div className="text-xs text-amber-700 mt-2">{i.mensagem_processamento}</div>}
                {i.arquivo_original_url && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => abrir(i.arquivo_original_url)}>
                    <Download className="h-3 w-3 mr-1" /> Baixar ZIP original
                  </Button>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="chapas">
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs">
                  <tr><th className="p-2">#</th><th className="p-2">Material</th><th className="p-2">Cor</th><th className="p-2">Esp.</th><th className="p-2">Dim.</th><th className="p-2">Status</th></tr>
                </thead>
                <tbody>
                  {chapas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2 font-medium">{c.numero_chapa}</td>
                      <td className="p-2">{c.material || "—"}</td>
                      <td className="p-2">{c.cor_linha || "—"}</td>
                      <td className="p-2">{c.espessura ? `${c.espessura}mm` : "—"}</td>
                      <td className="p-2 text-xs">{c.largura_chapa}x{c.altura_chapa}</td>
                      <td className="p-2"><Badge variant="outline">{c.status_chapa}</Badge></td>
                    </tr>
                  ))}
                  {chapas.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma chapa identificada</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="etiquetas">
            <Card className="p-0 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs sticky top-0">
                  <tr><th className="p-2">Código</th><th className="p-2">Ref</th><th className="p-2">Peça</th><th className="p-2">Sufixo</th><th className="p-2">Dup</th></tr>
                </thead>
                <tbody>
                  {etiquetas.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2 font-mono text-xs">{e.codigo_etiqueta_completo}</td>
                      <td className="p-2">{e.referencia_peca || "—"}</td>
                      <td className="p-2">{e.codigo_peca || "—"}</td>
                      <td className="p-2">{e.sufixo || "—"}</td>
                      <td className="p-2">{e.indice_duplicidade ?? "—"}</td>
                    </tr>
                  ))}
                  {etiquetas.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma etiqueta identificada</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="pdfs" className="space-y-2">
            {pdfs.length === 0 ? <div className="text-sm text-muted-foreground p-4 text-center">Nenhum PDF técnico catalogado.</div> : pdfs.map((a) => (
              <Card key={a.id} className="p-2 flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-medium">{a.nome_arquivo}</div>
                  <div className="text-xs text-muted-foreground">{a.tipo_arquivo}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrir(a.url_arquivo)}><ExternalLink className="h-3 w-3 mr-1" /> Abrir</Button>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="arquivos">
            <Card className="p-0 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs sticky top-0">
                  <tr><th className="p-2">Pasta</th><th className="p-2">Tipo</th><th className="p-2">Arquivo</th><th className="p-2 w-20"></th></tr>
                </thead>
                <tbody>
                  {arquivos.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2"><Badge variant="outline" className="text-xs">{a.origem_pasta}</Badge></td>
                      <td className="p-2 text-xs">{a.tipo_arquivo}</td>
                      <td className="p-2 font-mono text-xs truncate max-w-xs">{a.caminho_relativo || a.nome_arquivo}</td>
                      <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => abrir(a.url_arquivo)}><Download className="h-3 w-3" /></Button></td>
                    </tr>
                  ))}
                  {arquivos.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum arquivo</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

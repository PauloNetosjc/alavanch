import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, FileArchive, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { importarPacoteTecnico, type ResultadoImportacao } from "@/lib/fabrica/importacaoTecnica";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modo: "individual" | "lote_multi_cliente";
  pedidoId?: string | null;
  pedidoCodigo?: string | null;
  loteId?: string | null;
  pedidosIds?: string[];
  onConcluido?: (r: ResultadoImportacao) => void;
}

export function ImportarPacoteTecnicoDialog({ open, onOpenChange, modo, pedidoId, pedidoCodigo, loteId, pedidosIds, onConcluido }: Props) {
  const { selectedLojaId } = useLoja();
  const [file, setFile] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [projetoNome, setProjetoNome] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ etapa: string; detalhe?: string; atual?: number; total?: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null); setResultado(null); setProjetoNome(""); setAmbiente("");
      setClienteNome(null); setErro(null); setProgresso(null);
      return;
    }
    if (pedidoId) {
      (supabase as any).from("pedidos")
        .select("cliente:clientes(nome), ambiente")
        .eq("id", pedidoId).maybeSingle()
        .then(({ data }: any) => {
          if (data?.cliente?.nome) setClienteNome(data.cliente.nome);
          if (data?.ambiente) setAmbiente(data.ambiente);
        });
    }
  }, [open, pedidoId]);

  const ETAPA_LABELS: Record<string, string> = {
    validacao: "Validando arquivo",
    criando_importacao: "Criando registro de importação",
    enviando_zip_original: "Enviando ZIP",
    zip_original_enviado: "ZIP enviado",
    zip_original_falhou: "Falha ao enviar ZIP",
    extraindo_zip: "Extraindo arquivos",
    zip_extraido: "ZIP extraído",
    enviando_arquivos: "Enviando arquivos extraídos",
    catalogando_arquivos: "Catalogando arquivos",
    processando_list: "Processando List",
    criando_chapas_complementares: "Criando chapas",
    criando_etiquetas: "Criando etiquetas",
    finalizando: "Finalizando",
  };

  async function handleImportar() {
    if (!file) { toast.error("Selecione um arquivo .zip"); return; }
    if (!/\.zip$/i.test(file.name)) { toast.error("Arquivo deve ser .zip"); return; }
    setProcessando(true);
    setErro(null);
    setProgresso({ etapa: "validacao" });
    try {
      const r = await importarPacoteTecnico({
        pedidoId: pedidoId || null,
        loteId: loteId || null,
        pedidosIds,
        lojaId: selectedLojaId || null,
        tipoImportacao: modo,
        arquivoZip: file,
        clienteNome,
        projetoNome: projetoNome || null,
        ambiente: ambiente || null,
        onProgress: (ev) => setProgresso(ev),
      });
      setResultado(r);
      if (r.status === "processado") toast.success("Pacote técnico importado com sucesso");
      else if (r.status === "processado_com_alertas") toast.warning("Importado com alertas");
      onConcluido?.(r);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error("Erro na importação técnica:", err);
      setErro(msg);
      toast.error(`Erro: ${msg}`);
    } finally {
      setProcessando(false);
      setProgresso(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Importar pacote técnico Promob/Nesting
          </DialogTitle>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {modo === "individual" ? (
                <>Pedido: <strong>{pedidoCodigo || pedidoId}</strong></>
              ) : (
                <>Lote multi-cliente {loteId ? `(${loteId.slice(0, 8)})` : ""} — {pedidosIds?.length || 0} pedido(s)</>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Projeto (opcional)</Label>
                <Input value={projetoNome} onChange={(e) => setProjetoNome(e.target.value)} placeholder="Nome do projeto" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ambiente (opcional)</Label>
                <Input value={ambiente} onChange={(e) => setAmbiente(e.target.value)} placeholder="Ex.: Cozinha" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Arquivo ZIP do Promob/Nesting</Label>
              <Input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="text-xs text-muted-foreground">Selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div>}
            </div>

            <Card className="p-3 text-xs space-y-1 bg-muted/30">
              <div className="font-medium">O sistema irá:</div>
              <ul className="list-disc ml-4 text-muted-foreground space-y-0.5">
                <li>Catalogar arquivos em AutoLabel, NC, Parts, Profile, xml</li>
                <li>Processar arquivo List (quando existir)</li>
                <li>Criar chapas iniciais (padrão 2750x1850)</li>
                <li>Criar etiquetas a partir de nomes (ex.: GAV8252A(1))</li>
                <li>Vincular PDFs: ListaCorte, PreviewCorte, Relatório de almoxarifado</li>
              </ul>
            </Card>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {resultado.status === "processado" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {resultado.status === "processado_com_alertas" && <AlertTriangle className="h-5 w-5 text-amber-600" />}
              {resultado.status === "erro" && <XCircle className="h-5 w-5 text-red-600" />}
              <div className="font-medium">
                {resultado.status === "processado" && "Importação concluída"}
                {resultado.status === "processado_com_alertas" && "Importação com alertas"}
                {resultado.status === "erro" && "Erro na importação"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Card className="p-2"><div className="text-xs text-muted-foreground">Arquivos</div><div className="text-xl font-bold">{resultado.totalArquivos}</div></Card>
              <Card className="p-2"><div className="text-xs text-muted-foreground">Catalogados</div><div className="text-xl font-bold">{resultado.totalArquivosTecnicos}</div></Card>
              <Card className="p-2"><div className="text-xs text-muted-foreground">Chapas</div><div className="text-xl font-bold">{resultado.totalChapas}</div></Card>
              <Card className="p-2"><div className="text-xs text-muted-foreground">Etiquetas</div><div className="text-xl font-bold">{resultado.totalEtiquetas}</div></Card>
            </div>
            {resultado.alertas.length > 0 && (
              <Card className="p-3 text-xs space-y-1 max-h-40 overflow-auto">
                <div className="font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Alertas</div>
                {resultado.alertas.map((a, i) => <div key={i} className="text-muted-foreground">• {a}</div>)}
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {!resultado ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processando}>Cancelar</Button>
              <Button onClick={handleImportar} disabled={processando || !file}>
                {processando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…</> : <><Upload className="h-4 w-4 mr-2" /> Importar</>}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

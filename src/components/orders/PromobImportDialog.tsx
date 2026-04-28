import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parsePromobTxt, type PromobParseResult } from '@/lib/promobParser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, Upload, FileText, CheckCircle, XCircle, Loader2, Package, RotateCcw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PromobImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  existingEnvironmentId?: string | null;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export default function PromobImportDialog({
  open, onOpenChange, orderId, existingEnvironmentId, onImportComplete,
}: PromobImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<PromobParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    setFileName('');
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        const result = parsePromobTxt(content);
        setParseResult(result);
        setStep('preview');
      } catch {
        toast.error('Erro ao processar o arquivo. Verifique o formato.');
      }
    };
    reader.readAsText(file, 'latin1'); // Promob usually exports in latin1/windows-1252
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const doImport = async (mode: 'new' | 'replace') => {
    if (!parseResult) return;
    setImporting(true);
    setStep('importing');

    try {
      for (const env of parseResult.environments) {
        let envId: string;
        const envValue = env.items.reduce((s, it) => s + ((it as any).finalPrice ?? it.cost) * it.quantity, 0);
        const envFactoryCost = env.items.reduce((s, it) => s + ((it as any).factoryPrice ?? 0) * it.quantity, 0);

        if (mode === 'replace' && existingEnvironmentId) {
          // Delete old items first
          await supabase.from('order_items').delete().eq('environment_id', existingEnvironmentId);
          // Update environment
          await supabase.from('order_environments').update({
            name: env.name,
            value: envValue,
            factory_cost: envFactoryCost,
            description: `Importado do Promob - ${fileName}`,
          }).eq('id', existingEnvironmentId);
          envId = existingEnvironmentId;
        } else {
          // Create new environment
          const { data: newEnv, error: envError } = await supabase.from('order_environments').insert({
            order_id: orderId,
            name: env.name,
            value: envValue,
            factory_cost: envFactoryCost,
            description: `Importado do Promob - ${fileName}`,
          }).select('id').single();

          if (envError) throw envError;
          envId = newEnv.id;
        }

        // Get current max version for this order
        const { data: existingImports } = await supabase
          .from('promob_imports')
          .select('version')
          .eq('order_id', orderId)
          .order('version', { ascending: false })
          .limit(1);

        const nextVersion = (existingImports?.[0]?.version ?? 0) + 1;

        // Save import record
        const { data: importRecord, error: importError } = await supabase.from('promob_imports').insert({
          order_id: orderId,
          environment_id: envId,
          project_id: parseResult.header.projectId,
          promob_version: parseResult.header.promobVersion,
          store_name: parseResult.header.storeName,
          client_name: parseResult.header.clientName,
          address: parseResult.header.address,
          neighborhood: parseResult.header.neighborhood,
          phone: parseResult.header.phone,
          cpf: parseResult.header.cpf,
          delivery_address: parseResult.header.deliveryAddress,
          raw_content: parseResult.rawContent,
          status: 'imported',
          version: nextVersion,
        }).select('id').single();

        if (importError) throw importError;

        // Insert items
        if (env.items.length > 0) {
          const itemsToInsert = env.items.map(item => ({
            environment_id: envId,
            import_id: importRecord.id,
            index_num: item.index,
            quantity: item.quantity,
            description: item.description,
            width: item.width,
            height: item.height,
            depth: item.depth,
            cost: (item as any).finalPrice ?? item.cost,
            final_price: (item as any).finalPrice ?? item.cost,
            factory_price: (item as any).factoryPrice ?? 0,
            extra_cost: (item as any).extraCost ?? 0,
            category: item.category,
            finish: item.finish,
            project_ref: parseResult.header.projectId,
          }));

          const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      setStep('done');
      toast.success('Importação concluída com sucesso!');
      onImportComplete();
    } catch (err: any) {
      toast.error('Erro na importação: ' + (err.message || 'Erro desconhecido'));
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const totalItems = parseResult?.environments.reduce((s, e) => s + e.items.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Arquivo Promob
          </DialogTitle>
          <DialogDescription>
            Envie um arquivo TXT exportado do Promob para importar ambientes e itens.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Clique para selecionar um arquivo TXT</p>
              <p className="text-xs text-muted-foreground mt-1">Arquivo exportado do Promob (.txt)</p>
            </div>
          </div>
        )}

        {step === 'preview' && parseResult && (
          <div className="space-y-4 mt-2">
            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Header info */}
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" /> Dados do Cabeçalho
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {parseResult.header.clientName && (
                    <div><span className="text-muted-foreground text-xs">Cliente:</span> <span className="font-medium">{parseResult.header.clientName}</span></div>
                  )}
                  {parseResult.header.storeName && (
                    <div><span className="text-muted-foreground text-xs">Loja:</span> <span className="font-medium">{parseResult.header.storeName}</span></div>
                  )}
                  {parseResult.header.projectId && (
                    <div><span className="text-muted-foreground text-xs">Projeto:</span> <span className="font-mono text-xs">{parseResult.header.projectId}</span></div>
                  )}
                  {parseResult.header.cpf && (
                    <div><span className="text-muted-foreground text-xs">CPF:</span> <span>{parseResult.header.cpf}</span></div>
                  )}
                  {parseResult.header.phone && (
                    <div><span className="text-muted-foreground text-xs">Fone:</span> <span>{parseResult.header.phone}</span></div>
                  )}
                  {parseResult.header.promobVersion && (
                    <div><span className="text-muted-foreground text-xs">Promob:</span> <span>{parseResult.header.promobVersion}</span></div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-primary">{parseResult.environments.length}</p>
                  <p className="text-xs text-muted-foreground">Ambiente(s)</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-primary">{totalItems}</p>
                  <p className="text-xs text-muted-foreground">Itens</p>
                </CardContent>
              </Card>
              <Card className={`border-border/60 ${parseResult.hasDivergence ? 'border-destructive' : ''}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-lg font-bold ${parseResult.hasDivergence ? 'text-destructive' : 'text-primary'}`}>
                    {fmt(parseResult.fileTotal || parseResult.calculatedTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </div>

            {/* Environments and items */}
            {parseResult.environments.map((env, ei) => (
              <Card key={ei} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-primary" /> {env.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{env.items.length} itens</Badge>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold">
                          {fmt(env.items.reduce((s, it) => s + ((it as any).finalPrice ?? it.cost) * it.quantity, 0))}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Fábrica: {fmt(env.items.reduce((s, it) => s + ((it as any).factoryPrice ?? 0) * it.quantity, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {env.items.length > 0 && (
                    <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-[40px]">#</TableHead>
                            <TableHead className="text-xs w-[40px]">Qtd</TableHead>
                            <TableHead className="text-xs">Descrição</TableHead>
                            <TableHead className="text-xs w-[80px]">Medidas</TableHead>
                            <TableHead className="text-xs w-[90px]">Preço Final</TableHead>
                            <TableHead className="text-xs w-[90px]">Preço Fábrica</TableHead>
                            <TableHead className="text-xs w-[80px]">Acabamento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {env.items.map((item, ii) => (
                            <TableRow key={ii}>
                              <TableCell className="text-xs">{item.index}</TableCell>
                              <TableCell className="text-xs">{item.quantity}</TableCell>
                              <TableCell className="text-xs font-medium">{item.description}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {[item.width, item.height, item.depth].filter(Boolean).join(' × ') || '—'}
                              </TableCell>
                              <TableCell className="text-xs font-medium">{fmt((item as any).finalPrice ?? item.cost)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{fmt((item as any).factoryPrice ?? 0)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.finish || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => handleClose(false)}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              {existingEnvironmentId && (
                <Button variant="outline" onClick={() => doImport('replace')}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Substituir ambiente anterior
                </Button>
              )}
              <Button onClick={() => doImport('new')}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {existingEnvironmentId ? 'Importar como nova versão' : 'Confirmar importação'}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Importando dados do Promob...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-12 text-center space-y-3">
            <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="text-sm font-medium">Importação concluída com sucesso!</p>
            <p className="text-xs text-muted-foreground">{totalItems} itens importados em {parseResult?.environments.length ?? 0} ambiente(s).</p>
            <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

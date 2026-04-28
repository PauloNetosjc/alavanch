import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Check, ChevronsUpDown, Upload, FileText, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/lib/masks';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { TagSelector } from '@/components/ui/tag-selector';
import { parsePromobTxt, type PromobParseResult } from '@/lib/promobParser';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Tables } from '@/integrations/supabase/types';

const quoteSchema = z.object({
  client_id: z.string().min(1, 'Selecione um cliente'),
  store_id: z.string().optional().or(z.literal('')),
  focal_point: z.string().trim().max(200).optional().or(z.literal('')),
  origin: z.string().trim().max(100).optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  expiry_date: z.string().optional().or(z.literal('')),
  urgency: z.string().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editQuote?: Tables<'quotes'> | null;
}

export function QuoteFormDialog({ open, onOpenChange, onSuccess, editQuote }: QuoteFormDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Tables<'clients'>[]>([]);
  const [stores, setStores] = useState<Tables<'stores'>[]>([]);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualEnvs, setManualEnvs] = useState<Array<{ name: string; value: string; description: string }>>([]);
  const [promob, setPromob] = useState<{ result: PromobParseResult; fileName: string } | null>(null);
  const [parsingPromob, setParsingPromob] = useState(false);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: '',
      store_id: '',
      focal_point: '',
      origin: '',
      start_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      urgency: 'normal',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        client_id: editQuote?.client_id ?? '',
        store_id: editQuote?.store_id ?? '',
        focal_point: editQuote?.focal_point ?? '',
        origin: editQuote?.origin ?? '',
        start_date: editQuote?.start_date ?? new Date().toISOString().split('T')[0],
        expiry_date: editQuote?.expiry_date ?? '',
        urgency: editQuote?.urgency ?? 'normal',
        notes: editQuote?.notes ?? '',
      });
      setSelectedTags(editQuote?.tags ?? []);
      setManualEnvs([]);
      setPromob(null);
      loadData();
    }
  }, [open, editQuote]);

  const loadData = async () => {
    const [clientsRes, storesRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('stores').select('*').eq('active', true).order('name'),
    ]);
    setClients(clientsRes.data ?? []);
    setStores(storesRes.data ?? []);
  };

  const handleClientCreated = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      await loadData();
      form.setValue('client_id', data[0].id);
    }
  }, [form]);

  const generateCode = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .ilike('code', `ORC-${year}%`);
    const num = (count ?? 0) + 1;
    return `ORC-${year}-${String(num).padStart(4, '0')}`;
  };

  const handlePromobFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingPromob(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parsePromobTxt(ev.target?.result as string);
        if (result.environments.length === 0) {
          toast.error('Nenhum ambiente encontrado no arquivo.');
        } else {
          setPromob({ result, fileName: file.name });
          toast.success(`${result.environments.length} ambiente(s) detectado(s)`);
        }
      } catch {
        toast.error('Erro ao processar o arquivo Promob.');
      } finally {
        setParsingPromob(false);
      }
    };
    reader.onerror = () => { setParsingPromob(false); toast.error('Falha ao ler o arquivo.'); };
    reader.readAsText(file, 'latin1');
    e.target.value = '';
  };

  const addManualEnv = () => setManualEnvs(prev => [...prev, { name: '', value: '', description: '' }]);
  const updateManualEnv = (i: number, key: 'name' | 'value' | 'description', val: string) =>
    setManualEnvs(prev => prev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));
  const removeManualEnv = (i: number) => setManualEnvs(prev => prev.filter((_, idx) => idx !== i));

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const onSubmit = async (data: QuoteFormData) => {
    setSaving(true);
    try {
      if (editQuote) {
        const { error } = await supabase
          .from('quotes')
          .update({
            client_id: data.client_id,
            store_id: data.store_id || null,
            focal_point: data.focal_point || null,
            origin: data.origin || null,
            start_date: data.start_date || null,
            expiry_date: data.expiry_date || null,
            urgency: data.urgency || 'normal',
            notes: data.notes || null,
            tags: selectedTags.length > 0 ? selectedTags : null,
          })
          .eq('id', editQuote.id);
        if (error) throw error;
        toast.success('Orçamento atualizado');
      } else {
        const code = await generateCode();
        const { data: created, error } = await supabase
          .from('quotes')
          .insert({
            code,
            client_id: data.client_id,
            store_id: data.store_id || null,
            seller_id: user?.id,
            focal_point: data.focal_point || null,
            origin: data.origin || null,
            start_date: data.start_date || null,
            expiry_date: data.expiry_date || null,
            urgency: data.urgency || 'normal',
            notes: data.notes || null,
            status: 'novo_lead',
            tags: selectedTags.length > 0 ? selectedTags : null,
          })
          .select('id')
          .single();
        if (error) throw error;

        const quoteId = created.id;

        // Insert Promob environments + items
        if (promob) {
          let totalFromPromob = 0;
          for (const env of promob.result.environments) {
            // value = soma do PREÇO FINAL (vai para o orçamento do cliente)
            // factory_cost = soma do PREÇO DE FÁBRICA (custo gerencial interno)
            const envValue = env.items.reduce((s, it) => s + (it.finalPrice ?? it.cost) * it.quantity, 0);
            const envFactoryCost = env.items.reduce((s, it) => s + (it.factoryPrice ?? 0) * it.quantity, 0);
            totalFromPromob += envValue;

            const { data: newEnv, error: envErr } = await supabase
              .from('quote_environments')
              .insert({
                quote_id: quoteId,
                name: env.name,
                value: envValue,
                cost: envFactoryCost,
                factory_cost: envFactoryCost,
                description: `Importado do Promob - ${promob.fileName}`,
              })
              .select('id')
              .single();
            if (envErr) throw envErr;

            const { data: importRec } = await supabase.from('promob_imports').insert({
              quote_id: quoteId,
              quote_environment_id: newEnv.id,
              project_id: promob.result.header.projectId,
              promob_version: promob.result.header.promobVersion,
              store_name: promob.result.header.storeName,
              client_name: promob.result.header.clientName,
              address: promob.result.header.address,
              neighborhood: promob.result.header.neighborhood,
              phone: promob.result.header.phone,
              cpf: promob.result.header.cpf,
              delivery_address: promob.result.header.deliveryAddress,
              raw_content: promob.result.rawContent,
              status: 'imported',
              version: 1,
              created_by: user?.id,
            }).select('id').single();

            if (env.items.length > 0) {
              await supabase.from('quote_items').insert(env.items.map(item => ({
                environment_id: newEnv.id,
                import_id: importRec?.id,
                index_num: item.index,
                quantity: item.quantity,
                description: item.description,
                width: item.width,
                height: item.height,
                depth: item.depth,
                cost: item.finalPrice ?? item.cost,
                final_price: item.finalPrice ?? item.cost,
                factory_price: item.factoryPrice ?? 0,
                extra_cost: item.extraCost ?? 0,
                category: item.category,
                finish: item.finish,
                project_ref: promob.result.header.projectId,
              })));
            }
          }

          // Update quote totals
          await supabase.from('quotes').update({
            total_value: totalFromPromob,
            final_value: totalFromPromob,
          }).eq('id', quoteId);
        }

        // Insert manual environments
        const manualValid = manualEnvs.filter(e => e.name.trim());
        if (manualValid.length > 0) {
          await supabase.from('quote_environments').insert(manualValid.map(e => ({
            quote_id: quoteId,
            name: e.name.trim(),
            value: parseFloat(e.value) || 0,
            description: e.description || null,
          })));

          if (!promob) {
            const sum = manualValid.reduce((s, e) => s + (parseFloat(e.value) || 0), 0);
            await supabase.from('quotes').update({
              total_value: sum,
              final_value: sum,
            }).eq('id', quoteId);
          }
        }

        toast.success('Orçamento criado');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar orçamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editQuote ? 'Editar Orçamento' : 'Novo Orçamento'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dados Principais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Cliente *</FormLabel>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn('flex-1 justify-between font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value
                                  ? (() => {
                                      const c = clients.find(c => c.id === field.value);
                                      return c ? `${c.name}${c.phone ? ` — ${maskPhone(c.phone)}` : ''}` : 'Selecione...';
                                    })()
                                  : 'Buscar cliente...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nome, telefone, CPF..." />
                              <CommandList>
                                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {clients.map(c => (
                                    <CommandItem
                                      key={c.id}
                                      value={`${c.name} ${c.phone ?? ''} ${c.cpf ?? ''}`}
                                      onSelect={() => field.onChange(c.id)}
                                    >
                                      <Check className={cn('mr-2 h-4 w-4', field.value === c.id ? 'opacity-100' : 'opacity-0')} />
                                      <div className="flex flex-col">
                                        <span className="text-sm">{c.name}</span>
                                        {c.phone && <span className="text-xs text-muted-foreground">{maskPhone(c.phone)}</span>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setClientFormOpen(true)}
                          title="Cadastrar novo cliente"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="store_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loja</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a loja" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Indicação', 'Instagram', 'Facebook', 'Google', 'Loja física', 'Site', 'WhatsApp', 'Outro'].map(o => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Detalhes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="focal_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Focal point</FormLabel>
                      <FormControl>
                        <Input placeholder="Ponto focal do projeto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de validade</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h3>
              <TagSelector value={selectedTags} onChange={setSelectedTags} types={['orcamento']} />
            </div>

            {!editQuote && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ambientes do Projeto
                </h3>

                {/* Promob upload */}
                <Card className="border-dashed border-border/70">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Importar do Promob (.txt)</span>
                      </div>
                      {promob && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPromob(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Remover
                        </Button>
                      )}
                    </div>

                    {!promob ? (
                      <label className="block">
                        <input
                          type="file"
                          accept=".txt,.xml"
                          onChange={handlePromobFile}
                          className="hidden"
                          disabled={parsingPromob}
                        />
                        <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors">
                          {parsingPromob ? (
                            <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" />
                          ) : (
                            <>
                              <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">Clique para selecionar o arquivo exportado do Promob</p>
                            </>
                          )}
                        </div>
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{promob.fileName}</span>
                        </div>
                        {promob.result.environments.map((env, i) => (
                          <div key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium">{env.name}</span>
                              <Badge variant="secondary" className="text-[10px]">{env.items.length} itens</Badge>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-xs">
                                {fmt(env.items.reduce((s, it) => s + (it.finalPrice ?? it.cost) * it.quantity, 0))}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Loja: {fmt(env.items.reduce((s, it) => s + ((it as any).storePrice ?? 0) * it.quantity, 0))}
                                {' · '}
                                Fábrica: {fmt(env.items.reduce((s, it) => s + (it.factoryPrice ?? 0) * it.quantity, 0))}
                              </span>
                            </div>
                          </div>
                        ))}
                        {promob.result.warnings.length > 0 && (
                          <p className="text-[11px] text-amber-600">{promob.result.warnings[0]}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Manual envs */}
                <div className="space-y-2">
                  {manualEnvs.map((env, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <Input
                        className="col-span-5"
                        placeholder="Nome do ambiente"
                        value={env.name}
                        onChange={(e) => updateManualEnv(i, 'name', e.target.value)}
                      />
                      <Input
                        className="col-span-3"
                        type="number"
                        step="0.01"
                        placeholder="Valor (R$)"
                        value={env.value}
                        onChange={(e) => updateManualEnv(i, 'value', e.target.value)}
                      />
                      <Input
                        className="col-span-3"
                        placeholder="Descrição"
                        value={env.description}
                        onChange={(e) => updateManualEnv(i, 'description', e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeManualEnv(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addManualEnv}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ambiente manual
                  </Button>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações internas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={2000} placeholder="Notas sobre o orçamento..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editQuote ? 'Salvar' : 'Criar orçamento'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <ClientFormDialog
      open={clientFormOpen}
      onOpenChange={setClientFormOpen}
      onSuccess={handleClientCreated}
    />
  </>
  );
}

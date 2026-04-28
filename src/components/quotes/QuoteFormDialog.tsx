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
        const { error } = await supabase
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
          });
        if (error) throw error;
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

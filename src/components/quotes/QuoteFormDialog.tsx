import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { maskPhone } from '@/lib/masks';
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.phone ? `— ${maskPhone(c.phone)}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
  );
}

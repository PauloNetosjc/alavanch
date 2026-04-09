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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Tables } from '@/integrations/supabase/types';
import { maskCpf, maskPhone } from '@/lib/masks';

const clientSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  cpf: z.string().trim().max(14).optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')),
  email: z.string().trim().email('E-mail inválido').max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  phone_secondary: z.string().trim().max(20).optional().or(z.literal('')),
  delivery_address: z.string().trim().max(500).optional().or(z.literal('')),
  billing_address: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface DuplicateMatch {
  id: string;
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  matchField: string;
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editClient?: Tables<'clients'> | null;
}

export function ClientFormDialog({ open, onOpenChange, onSuccess, editClient }: ClientFormDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: editClient?.name ?? '',
      cpf: editClient?.cpf ? maskCpf(editClient.cpf) : '',
      birth_date: editClient?.birth_date ?? '',
      email: editClient?.email ?? '',
      phone: editClient?.phone ? maskPhone(editClient.phone) : '',
      phone_secondary: editClient?.phone_secondary ? maskPhone(editClient.phone_secondary) : '',
      delivery_address: editClient?.delivery_address ?? '',
      billing_address: editClient?.billing_address ?? '',
      notes: editClient?.notes ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editClient?.name ?? '',
        cpf: editClient?.cpf ? maskCpf(editClient.cpf) : '',
        birth_date: editClient?.birth_date ?? '',
        email: editClient?.email ?? '',
        phone: editClient?.phone ? maskPhone(editClient.phone) : '',
        phone_secondary: editClient?.phone_secondary ? maskPhone(editClient.phone_secondary) : '',
        delivery_address: editClient?.delivery_address ?? '',
        billing_address: editClient?.billing_address ?? '',
        notes: editClient?.notes ?? '',
      });
      setDuplicates([]);
      setSkipDuplicateCheck(false);
    }
  }, [open, editClient]);

  const checkDuplicates = async (data: ClientFormData): Promise<DuplicateMatch[]> => {
    const matches: DuplicateMatch[] = [];
    const excludeId = editClient?.id;

    if (data.cpf && data.cpf.length >= 11) {
      const { data: cpfMatches } = await supabase
        .from('clients')
        .select('id, name, cpf, email, phone')
        .eq('cpf', data.cpf)
        .limit(5);
      cpfMatches?.filter(c => c.id !== excludeId).forEach(c =>
        matches.push({ ...c, matchField: 'CPF' })
      );
    }

    if (data.email) {
      const { data: emailMatches } = await supabase
        .from('clients')
        .select('id, name, cpf, email, phone')
        .ilike('email', data.email)
        .limit(5);
      emailMatches?.filter(c => c.id !== excludeId && !matches.find(m => m.id === c.id)).forEach(c =>
        matches.push({ ...c, matchField: 'E-mail' })
      );
    }

    if (data.phone) {
      const { data: phoneMatches } = await supabase
        .from('clients')
        .select('id, name, cpf, email, phone')
        .eq('phone', data.phone)
        .limit(5);
      phoneMatches?.filter(c => c.id !== excludeId && !matches.find(m => m.id === c.id)).forEach(c =>
        matches.push({ ...c, matchField: 'Telefone' })
      );
    }

    return matches;
  };

  const onSubmit = async (data: ClientFormData) => {
    if (!skipDuplicateCheck) {
      setSaving(true);
      const found = await checkDuplicates(data);
      if (found.length > 0) {
        setDuplicates(found);
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: data.name,
        cpf: data.cpf || null,
        birth_date: data.birth_date || null,
        email: data.email || null,
        phone: data.phone || null,
        phone_secondary: data.phone_secondary || null,
        delivery_address: data.delivery_address || null,
        billing_address: data.billing_address || null,
        notes: data.notes || null,
      };

      if (editClient) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editClient.id);
        if (error) throw error;
        toast.success('Cliente atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success('Cliente cadastrado com sucesso');
      }

      // Log timeline event
      if (!editClient) {
        // timeline insert is fire-and-forget
        supabase.from('timeline_events').insert({
          entity_type: 'client',
          entity_id: crypto.randomUUID(),
          event_type: 'criacao',
          description: `Cliente "${data.name}" cadastrado`,
          user_id: user?.id,
        });
      }

      form.reset();
      setDuplicates([]);
      setSkipDuplicateCheck(false);
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cliente';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleForceCreate = () => {
    setSkipDuplicateCheck(true);
    setDuplicates([]);
    form.handleSubmit(onSubmit)();
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      form.reset();
      setDuplicates([]);
      setSkipDuplicateCheck(false);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editClient ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        {duplicates.length > 0 && (
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Possível duplicidade encontrada:</p>
              <ul className="space-y-1 text-sm">
                {duplicates.map(d => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                      {d.matchField}
                    </span>
                    {d.cpf && <span className="text-xs text-muted-foreground">CPF: {d.cpf}</span>}
                    {d.phone && <span className="text-xs text-muted-foreground">Tel: {d.phone}</span>}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleForceCreate}
                >
                  Cadastrar mesmo assim
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDuplicates([])}
                >
                  Corrigir dados
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Dados Pessoais */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          maxLength={14}
                          {...field}
                          onChange={(e) => field.onChange(maskCpf(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone principal</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          {...field}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone_secondary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone secundário</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          {...field}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Endereços */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Endereços
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="delivery_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço de entrega</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade - UF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billing_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço de cobrança</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade - UF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações internas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas sobre o cliente..."
                      rows={3}
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editClient ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

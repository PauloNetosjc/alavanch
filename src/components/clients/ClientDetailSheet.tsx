import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, MapPin, Calendar, FileText } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface ClientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Tables<'clients'> | null;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ClientDetailSheet({ open, onOpenChange, client }: ClientDetailSheetProps) {
  if (!client) return null;

  const formatDate = (d: string | null) => {
    if (!d) return null;
    try {
      return format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            {client.name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Dados Pessoais
            </h4>
            <InfoRow icon={FileText} label="CPF" value={client.cpf} />
            <InfoRow icon={Calendar} label="Data de nascimento" value={formatDate(client.birth_date)} />
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Contato
            </h4>
            <InfoRow icon={Mail} label="E-mail" value={client.email} />
            <InfoRow icon={Phone} label="Telefone principal" value={client.phone} />
            <InfoRow icon={Phone} label="Telefone secundário" value={client.phone_secondary} />
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Endereços
            </h4>
            <InfoRow icon={MapPin} label="Endereço de entrega" value={client.delivery_address} />
            <InfoRow icon={MapPin} label="Endereço de cobrança" value={client.billing_address} />
          </div>

          {client.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Observações
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Cadastrado em: {formatDate(client.created_at)}</p>
            <p>Atualizado em: {formatDate(client.updated_at)}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TIPOS_EVENTO, STATUS_EVENTO, type EventoAgenda } from "@/lib/sistema-saas/crmSaas";

type Opt = { id: string; nome: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  evento?: EventoAgenda | null;
  oportunidadeId?: string | null;
  baseClienteId?: string | null;
  onSaved?: () => void;
}

export function AgendaEventoSaaSDialog({ open, onOpenChange, evento, oportunidadeId, baseClienteId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<EventoAgenda>>({});
  const [oportunidades, setOportunidades] = useState<Opt[]>([]);
  const [bases, setBases] = useState<Opt[]>([]);

  useEffect(() => {
    if (!open) return;
    if (evento) {
      setForm({ ...evento });
    } else {
      const now = new Date();
      const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setForm({
        titulo: "", tipo: "reuniao", status: "agendado",
        data_inicio: iso,
        oportunidade_id: oportunidadeId ?? null,
        base_cliente_id: baseClienteId ?? null,
      });
    }
    supabase.from("saas_crm_oportunidades" as any).select("id,nome_empresa").order("nome_empresa")
      .then(({ data }) => setOportunidades(((data as any) ?? []).map((o: any) => ({ id: o.id, nome: o.nome_empresa }))));
    supabase.from("bases_clientes" as any).select("id,nome").order("nome")
      .then(({ data }) => setBases(((data as any) ?? []).map((b: any) => ({ id: b.id, nome: b.nome }))));
  }, [open, evento, oportunidadeId, baseClienteId]);

  const set = (k: keyof EventoAgenda, v: any) => setForm(s => ({ ...s, [k]: v }));

  async function handleSave() {
    if (!form.titulo?.trim()) { toast.error("Título é obrigatório"); return; }
    if (!form.data_inicio) { toast.error("Data início é obrigatória"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        titulo: form.titulo,
        tipo: form.tipo ?? "reuniao",
        status: form.status ?? "agendado",
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        responsavel_id: form.responsavel_id || null,
        participantes: form.participantes || null,
        link_reuniao: form.link_reuniao || null,
        local: form.local || null,
        observacoes: form.observacoes || null,
        oportunidade_id: form.oportunidade_id || null,
        base_cliente_id: form.base_cliente_id || null,
        atualizado_por: u.user?.id ?? null,
      };
      if (evento?.id) {
        const { error } = await supabase.from("saas_agenda_eventos" as any).update(payload).eq("id", evento.id);
        if (error) throw error;
      } else {
        payload.criado_por = u.user?.id ?? null;
        const { error } = await supabase.from("saas_agenda_eventos" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Evento salvo");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">
            <Label className="text-xs">Título *</Label>
            <Input value={form.titulo ?? ""} onChange={e => set("titulo", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo ?? "reuniao"} onValueChange={v => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_EVENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status ?? "agendado"} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_EVENTO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data início *</Label>
            <Input type="datetime-local" value={form.data_inicio?.slice(0, 16) ?? ""} onChange={e => set("data_inicio", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Data fim</Label>
            <Input type="datetime-local" value={form.data_fim?.slice(0, 16) ?? ""} onChange={e => set("data_fim", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Oportunidade vinculada</Label>
            <Select value={form.oportunidade_id ?? "_none"} onValueChange={v => set("oportunidade_id", v === "_none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhuma</SelectItem>
                {oportunidades.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Base vinculada</Label>
            <Select value={form.base_cliente_id ?? "_none"} onValueChange={v => set("base_cliente_id", v === "_none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhuma</SelectItem>
                {bases.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Participantes</Label>
            <Input value={form.participantes ?? ""} onChange={e => set("participantes", e.target.value)} placeholder="Nomes ou e-mails" />
          </div>
          <div>
            <Label className="text-xs">Link da reunião</Label>
            <Input value={form.link_reuniao ?? ""} onChange={e => set("link_reuniao", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">Local</Label>
            <Input value={form.local ?? ""} onChange={e => set("local", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={3} value={form.observacoes ?? ""} onChange={e => set("observacoes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

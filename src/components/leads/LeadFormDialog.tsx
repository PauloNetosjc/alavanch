import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskPhone } from "@/lib/masks";

export interface LeadRow {
  id: string;
  nome: string;
  whatsapp: string;
  status: string;
  indicador: string | null;
  interesse: string[] | null;
  notas: string | null;
  created_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: LeadRow | null;
  onSaved: () => void;
}

const STATUS = ["novo", "em_contato", "orcamento", "negociacao", "fechado", "perdido"];

export function LeadFormDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    status: "novo",
    indicador: "",
    interesse: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome,
        whatsapp: lead.whatsapp,
        status: lead.status,
        indicador: lead.indicador ?? "",
        interesse: (lead.interesse ?? []).join(", "),
        notas: lead.notas ?? "",
      });
    } else {
      setForm({ nome: "", whatsapp: "", status: "novo", indicador: "", interesse: "", notas: "" });
    }
  }, [lead, open]);

  const submit = async () => {
    if (!form.nome.trim() || !form.whatsapp.trim()) {
      toast.error("Nome e WhatsApp são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp,
      status: form.status,
      indicador: form.indicador || null,
      interesse: form.interesse ? form.interesse.split(",").map((s) => s.trim()).filter(Boolean) : null,
      notas: form.notas || null,
    };
    const { error } = lead
      ? await supabase.from("leads").update(payload).eq("id", lead.id)
      : await supabase.from("leads").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lead ? "Lead atualizado" : "Lead criado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Indicador</Label>
            <Input value={form.indicador} onChange={(e) => setForm({ ...form, indicador: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Interesse (separado por vírgula)</Label>
            <Input value={form.interesse} onChange={(e) => setForm({ ...form, interesse: e.target.value })} placeholder="cozinha, dormitório" />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

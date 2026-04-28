import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCpf, maskCnpj, maskPhone, unmask } from "@/lib/masks";

export interface ClienteRow {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  telefone_secundario: string | null;
  endereco_cobranca: string | null;
  endereco_entrega: string | null;
  data_nascimento: string | null;
  observacoes: string | null;
  ativo: boolean | null;
  created_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: ClienteRow | null;
  onSaved: (created?: { id: string; nome: string }) => void;
}


const empty = {
  nome: "",
  cpf_cnpj: "",
  email: "",
  telefone: "",
  telefone_secundario: "",
  endereco_cobranca: "",
  endereco_entrega: "",
  data_nascimento: "",
  observacoes: "",
};

export function ClienteFormDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome,
        cpf_cnpj: cliente.cpf_cnpj ?? "",
        email: cliente.email ?? "",
        telefone: cliente.telefone ?? "",
        telefone_secundario: cliente.telefone_secundario ?? "",
        endereco_cobranca: cliente.endereco_cobranca ?? "",
        endereco_entrega: cliente.endereco_entrega ?? "",
        data_nascimento: cliente.data_nascimento ?? "",
        observacoes: cliente.observacoes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [cliente, open]);

  const maskDoc = (v: string) => (unmask(v).length > 11 ? maskCnpj(v) : maskCpf(v));

  const submit = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      telefone_secundario: form.telefone_secundario || null,
      endereco_cobranca: form.endereco_cobranca || null,
      endereco_entrega: form.endereco_entrega || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes || null,
    };
    let createdId: string | undefined;
    let createdNome: string | undefined;
    if (cliente) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("clientes").insert(payload).select("id, nome").single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      createdId = data?.id; createdNome = data?.nome;
    }

    setSaving(false);
    toast.success(cliente ? "Cliente atualizado" : "Cliente criado");
    onSaved(createdId && createdNome ? { id: createdId, nome: createdNome } : undefined);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: maskDoc(e.target.value) })} />
          </div>
          <div>
            <Label>Data nascimento</Label>
            <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label>Telefone secundário</Label>
            <Input value={form.telefone_secundario} onChange={(e) => setForm({ ...form, telefone_secundario: maskPhone(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label>Endereço de cobrança</Label>
            <Textarea rows={2} value={form.endereco_cobranca} onChange={(e) => setForm({ ...form, endereco_cobranca: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Endereço de entrega</Label>
            <Textarea rows={2} value={form.endereco_entrega} onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
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

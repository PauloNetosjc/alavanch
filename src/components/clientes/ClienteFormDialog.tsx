import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCpf, maskCnpj, maskPhone, unmask } from "@/lib/masks";
import { CalendarDays, FileText } from "lucide-react";

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
  vendedor_id?: string | null;
  origem_id?: string | null;
  parceiro_id?: string | null;
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
  vendedor_id: "",
  origem_id: "",
  parceiro_id: "",
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function ClienteFormDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [vendedores, setVendedores] = useState<{ user_id: string; nome_completo: string }[]>([]);
  const [origens, setOrigens] = useState<{ id: string; nome: string }[]>([]);
  const [parceiros, setParceiros] = useState<{ id: string; nome: string }[]>([]);
  const [tab, setTab] = useState("dados");
  const [agendas, setAgendas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: profs }, { data: oris }, { data: pars }] = await Promise.all([
        supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
        supabase.from("origens_lead").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("parceiros").select("id, nome").order("nome"),
      ]);
      setVendedores((profs ?? []) as any);
      setOrigens((oris ?? []) as any);
      setParceiros((pars ?? []) as any);
    })();
  }, [open]);

  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome ?? "",
        cpf_cnpj: cliente.cpf_cnpj ?? "",
        email: cliente.email ?? "",
        telefone: cliente.telefone ?? "",
        telefone_secundario: cliente.telefone_secundario ?? "",
        endereco_cobranca: cliente.endereco_cobranca ?? "",
        endereco_entrega: cliente.endereco_entrega ?? "",
        data_nascimento: cliente.data_nascimento ?? "",
        observacoes: cliente.observacoes ?? "",
        vendedor_id: cliente.vendedor_id ?? "",
        origem_id: cliente.origem_id ?? "",
        parceiro_id: cliente.parceiro_id ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [cliente, open]);

  // Detecta CPF/CNPJ pela quantidade de dígitos automaticamente
  const maskDoc = (v: string) => (unmask(v).length > 11 ? maskCnpj(v) : maskCpf(v));
  const docTipo = useMemo(() => {
    const len = unmask(form.cpf_cnpj).length;
    if (len === 0) return "";
    return len > 11 ? "CNPJ" : "CPF";
  }, [form.cpf_cnpj]);

  const submit = async () => {
    // Validações obrigatórias
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.email.trim() || !isEmail(form.email)) return toast.error("E-mail válido é obrigatório");
    if (unmask(form.telefone).length < 10) return toast.error("Telefone é obrigatório");

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
      vendedor_id: form.vendedor_id || null,
      origem_id: form.origem_id || null,
      parceiro_id: form.parceiro_id || null,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF / CNPJ {docTipo && <span className="text-muted-foreground text-xs">({docTipo})</span>}</Label>
            <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: maskDoc(e.target.value) })} />
          </div>
          <div>
            <Label>Data nascimento</Label>
            <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div>
            <Label>E-mail <span className="text-destructive">*</span></Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone <span className="text-destructive">*</span></Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label>Telefone secundário</Label>
            <Input value={form.telefone_secundario} onChange={(e) => setForm({ ...form, telefone_secundario: maskPhone(e.target.value) })} />
          </div>

          <div>
            <Label>Vendedor / Consultor</Label>
            <Select value={form.vendedor_id || "none"} onValueChange={(v) => setForm({ ...form, vendedor_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {vendedores.map((v) => <SelectItem key={v.user_id} value={v.user_id}>{v.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem do lead</Label>
            <Select value={form.origem_id || "none"} onValueChange={(v) => setForm({ ...form, origem_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhuma —</SelectItem>
                {origens.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Indicador / Parceiro</Label>
            <Select value={form.parceiro_id || "none"} onValueChange={(v) => setForm({ ...form, parceiro_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {parceiros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
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

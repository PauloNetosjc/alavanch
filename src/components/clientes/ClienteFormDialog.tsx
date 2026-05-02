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
    setTab("dados");
  }, [cliente, open]);

  // Carrega histórico (agendas + pedidos) do cliente em edição
  useEffect(() => {
    if (!open || !cliente?.id) { setAgendas([]); setPedidos([]); return; }
    (async () => {
      const [{ data: ags }, { data: peds }] = await Promise.all([
        supabase.from("agenda_eventos" as any).select("id, tipo, titulo, data, hora_inicio, status, endereco")
          .eq("cliente_id", cliente.id).order("data", { ascending: false }).order("hora_inicio", { ascending: false }),
        supabase.from("pedidos").select("id, codigo, status, valor_total, created_at")
          .eq("cliente_id", cliente.id).order("created_at", { ascending: false }),
      ]);
      setAgendas((ags as any) || []);
      setPedidos((peds as any) || []);
    })();
  }, [open, cliente?.id]);

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

  const TIPO_LABEL: Record<string, string> = {
    apresentacao_comercial: "Apresentação", medicao_tecnica: "Medição",
    revisao_final: "Revisão", entrega: "Entrega", montagem: "Montagem",
    assistencia_tecnica: "Assistência", tarefa_interna: "Tarefa",
  };
  const fmtBR = (d: string) => new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
  const fmtMoney = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={cliente ? "grid grid-cols-3 w-full" : "grid grid-cols-1 w-full"}>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            {cliente && <TabsTrigger value="agendas">Agendamentos ({agendas.length})</TabsTrigger>}
            {cliente && <TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="dados">
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
          </TabsContent>

          {cliente && (
            <TabsContent value="agendas">
              {agendas.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <CalendarDays className="w-8 h-8 opacity-40" />
                  Nenhum agendamento registrado para este cliente.
                </div>
              ) : (
                <ul className="divide-y">
                  {agendas.map((a) => (
                    <li key={a.id} className="py-2 flex items-start gap-3">
                      <div className="text-[11px] text-center w-14 shrink-0">
                        <div className="font-semibold">{fmtBR(a.data)}</div>
                        <div className="text-muted-foreground">{a.hora_inicio?.slice(0, 5)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{a.titulo}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {TIPO_LABEL[a.tipo] || a.tipo} • <span className="capitalize">{a.status}</span>
                          {a.endereco ? ` • ${a.endereco}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          )}

          {cliente && (
            <TabsContent value="pedidos">
              {pedidos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 opacity-40" />
                  Nenhum pedido registrado para este cliente.
                </div>
              ) : (
                <ul className="divide-y">
                  {pedidos.map((p) => (
                    <li key={p.id} className="py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{p.codigo}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {fmtBR((p.created_at as string).slice(0, 10))} • <span className="capitalize">{p.status}</span>
                        </div>
                      </div>
                      <div className="text-[13px] font-semibold">{fmtMoney(Number(p.valor_total))}</div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

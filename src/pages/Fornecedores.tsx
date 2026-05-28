import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { maskPhone, maskCpf, maskCnpj } from "@/lib/masks";

type Fornecedor = {
  id: string;
  loja_id: string | null;
  nome: string;
  documento: string | null;
  tipo_documento: string | null;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  endereco_cobranca: string | null;
  endereco_entrega: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  contato: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  categoria: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const empty = {
  nome: "",
  documento: "",
  tipo_documento: "CNPJ",
  inscricao_estadual: "",
  email: "",
  telefone: "",
  endereco: "",
  endereco_cobranca: "",
  endereco_entrega: "",
  cidade: "",
  estado: "",
  cep: "",
  contato: "",
  banco: "",
  agencia: "",
  conta: "",
  pix: "",
  categoria: "",
  observacoes: "",
  ativo: true,
};

export default function Fornecedores() {
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<typeof empty>({ ...empty });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("fornecedores").select("*").order("nome");
    setRows((data as Fornecedor[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function novo() {
    setEdit(null);
    setForm({ ...empty });
    setOpen(true);
  }
  function editar(f: Fornecedor) {
    setEdit(f);
    setForm({
      nome: f.nome || "",
      documento: f.documento || "",
      tipo_documento: f.tipo_documento || "CNPJ",
      inscricao_estadual: f.inscricao_estadual || "",
      email: f.email || "",
      telefone: f.telefone || "",
      endereco: f.endereco || "",
      endereco_cobranca: f.endereco_cobranca || "",
      endereco_entrega: f.endereco_entrega || "",
      cidade: f.cidade || "",
      estado: f.estado || "",
      cep: f.cep || "",
      contato: f.contato || "",
      banco: f.banco || "",
      agencia: f.agencia || "",
      conta: f.conta || "",
      pix: f.pix || "",
      categoria: f.categoria || "",
      observacoes: f.observacoes || "",
      ativo: f.ativo,
    });
    setOpen(true);
  }
  async function salvar() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    const payload: any = { ...form };
    if (edit) {
      const { error } = await supabase.from("fornecedores").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Fornecedor atualizado");
    } else {
      const { error } = await supabase.from("fornecedores").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Fornecedor criado");
    }
    setOpen(false);
    load();
  }
  async function excluir(f: Fornecedor) {
    if (!confirm(`Excluir "${f.nome}"?`)) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor excluído");
    load();
  }

  const filtered = rows.filter((r) => {
    const q = busca.toLowerCase();
    return !q || r.nome.toLowerCase().includes(q) || (r.documento || "").includes(q) || (r.categoria || "").toLowerCase().includes(q);
  });

  function maskDoc(v: string, tipo: string) {
    return tipo === "CPF" ? maskCpf(v) : maskCnpj(v);
  }

  return (
    <div>
      <PageHeader icon={Truck} title="Fornecedores" subtitle="Cadastro de fornecedores para contas a pagar" />

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, documento ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button size="sm" onClick={novo}><Plus className="w-3.5 h-3.5 mr-1.5" />Novo fornecedor</Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-[13px]">Carregando…</div>
      ) : (
        <div className="border rounded-md divide-y">
          {filtered.length === 0 && <div className="p-6 text-center text-muted-foreground text-[13px]">Nenhum fornecedor cadastrado.</div>}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{r.nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[r.documento, r.categoria, r.telefone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${r.ativo ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                {r.ativo ? "Ativo" : "Inativo"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => editar(r)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => excluir(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome / Razão Social *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <select className="w-full h-9 rounded-md border bg-background px-3 text-[13px]" value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
              </select>
            </div>
            <div>
              <Label>Documento</Label>
              <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: maskDoc(e.target.value, form.tipo_documento) })} />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>UF</Label>
                <Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
              </div>
            </div>
            <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Dados bancários</div>
            <div>
              <Label>Banco</Label>
              <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Agência</Label>
                <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
              </div>
              <div>
                <Label>Conta</Label>
                <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Chave PIX</Label>
              <Input value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Categoria</Label>
              <Input placeholder="Ex.: Matéria-prima, Serviços, Logística" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

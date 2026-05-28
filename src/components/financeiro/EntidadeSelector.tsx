import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus, Check, User, Building2, Handshake } from "lucide-react";
import { toast } from "sonner";

export type EntidadeTipo = "cliente" | "fornecedor" | "parceiro";

export type EntidadeRef = {
  tipo: EntidadeTipo;
  id: string;
  nome: string;
};

type Item = {
  id: string;
  nome: string;
  tipo: EntidadeTipo;
  doc: string | null;
  email: string | null;
  telefone: string | null;
};

type Props = {
  value: EntidadeRef | null;
  onChange: (v: EntidadeRef | null) => void;
  /** Ordena/limita os tipos disponíveis na busca. Padrão: todos os três. */
  tipos?: EntidadeTipo[];
  placeholder?: string;
  /** Loja default ao criar nova entidade */
  lojaId?: string | null;
};

const TIPO_META: Record<EntidadeTipo, { label: string; color: string; icon: any }> = {
  cliente: { label: "Cliente", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: User },
  fornecedor: { label: "Fornecedor", color: "bg-rose-100 text-rose-700 border-rose-300", icon: Building2 },
  parceiro: { label: "Parceiro", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Handshake },
};

export default function EntidadeSelector({
  value,
  onChange,
  tipos = ["cliente", "fornecedor", "parceiro"],
  placeholder = "Buscar pessoa…",
  lojaId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [novoTipo, setNovoTipo] = useState<EntidadeTipo | null>(null);

  async function loadAll() {
    const empty = Promise.resolve({ data: [] as any[] });
    const cliQ = tipos.includes("cliente")
      ? supabase.from("clientes").select("id,nome,cpf_cnpj,email,telefone").eq("ativo", true).order("nome").limit(2000).then((r) => r)
      : empty;
    const fornQ = tipos.includes("fornecedor")
      ? supabase.from("fornecedores").select("id,nome,documento,email,telefone").eq("ativo", true).order("nome").limit(2000).then((r) => r)
      : empty;
    const parcQ = tipos.includes("parceiro")
      ? supabase.from("parceiros").select("id,nome,cpf_cnpj,email,telefone").eq("ativo", true).order("nome").limit(2000).then((r) => r)
      : empty;

    const [cli, forn, parc] = await Promise.all([cliQ, fornQ, parcQ]);
    const all: Item[] = [
      ...((cli.data as any[]) || []).map((c) => ({
        id: c.id, nome: c.nome, tipo: "cliente" as const, doc: c.cpf_cnpj || null, email: c.email || null, telefone: c.telefone || null,
      })),
      ...((forn.data as any[]) || []).map((f) => ({
        id: f.id, nome: f.nome, tipo: "fornecedor" as const, doc: f.documento || null, email: f.email || null, telefone: f.telefone || null,
      })),
      ...((parc.data as any[]) || []).map((p) => ({
        id: p.id, nome: p.nome, tipo: "parceiro" as const, doc: p.cpf_cnpj || null, email: p.email || null, telefone: p.telefone || null,
      })),
    ];
    setItems(all);
  }
  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const grupos = useMemo(() => {
    const g: Record<EntidadeTipo, Item[]> = { cliente: [], fornecedor: [], parceiro: [] };
    items.forEach((i) => g[i.tipo].push(i));
    return g;
  }, [items]);

  function selecionar(it: Item) {
    onChange({ tipo: it.tipo, id: it.id, nome: it.nome });
    setOpen(false);
  }

  async function afterCreate(tipo: EntidadeTipo, id: string, nome: string) {
    await loadAll();
    onChange({ tipo, id, nome });
    setNovoTipo(null);
  }

  const meta = value ? TIPO_META[value.tipo] : null;
  const Icon = meta?.icon;

  return (
    <>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
              {value ? (
                <span className="flex items-center gap-2 truncate">
                  {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{value.nome}</span>
                  {meta && (
                    <Badge variant="outline" className={`text-[10px] ${meta.color} ml-1`}>{meta.label}</Badge>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[360px]" align="start">
            <Command
              filter={(val, search) => {
                // val = id::nome::tipo::doc::email::telefone (lowercased)
                if (!search) return 1;
                return val.includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Pesquisar por nome, CPF/CNPJ, email, telefone, tipo…" />
              <CommandList className="max-h-72">
                <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                {tipos.map((t) => {
                  const lista = grupos[t];
                  if (!lista.length) return null;
                  const m = TIPO_META[t];
                  return (
                    <CommandGroup key={t} heading={m.label + "s"}>
                      {lista.map((it) => {
                        const haystack = [it.nome, m.label, it.doc, it.email, it.telefone, it.tipo].filter(Boolean).join(" ").toLowerCase();
                        return (
                          <CommandItem key={it.tipo + ":" + it.id} value={haystack} onSelect={() => selecionar(it)}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Check className={`w-3.5 h-3.5 ${value?.id === it.id && value?.tipo === it.tipo ? "opacity-100" : "opacity-0"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{it.nome}</div>
                                {(it.doc || it.email || it.telefone) && (
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {[it.doc, it.email, it.telefone].filter(Boolean).join(" • ")}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${m.color}`}>{m.label}</Badge>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {tipos.includes("cliente") && (
              <DropdownMenuItem onSelect={() => setNovoTipo("cliente")}>
                <User className="w-3.5 h-3.5 mr-2" /> Novo Cliente
              </DropdownMenuItem>
            )}
            {tipos.includes("fornecedor") && (
              <DropdownMenuItem onSelect={() => setNovoTipo("fornecedor")}>
                <Building2 className="w-3.5 h-3.5 mr-2" /> Novo Fornecedor
              </DropdownMenuItem>
            )}
            {tipos.includes("parceiro") && (
              <DropdownMenuItem onSelect={() => setNovoTipo("parceiro")}>
                <Handshake className="w-3.5 h-3.5 mr-2" /> Novo Parceiro
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <NovoEntidadeDialog
        tipo={novoTipo}
        onClose={() => setNovoTipo(null)}
        lojaId={lojaId ?? null}
        onCreated={afterCreate}
      />
    </>
  );
}

/* ============== Quick create modal ============== */

function NovoEntidadeDialog({
  tipo,
  onClose,
  onCreated,
  lojaId,
}: {
  tipo: EntidadeTipo | null;
  onClose: () => void;
  onCreated: (tipo: EntidadeTipo, id: string, nome: string) => void;
  lojaId: string | null;
}) {
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [ie, setIe] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [endCob, setEndCob] = useState("");
  const [endEnt, setEndEnt] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipoParceiro, setTipoParceiro] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tipo) {
      setNome(""); setDoc(""); setIe(""); setTel(""); setEmail("");
      setEndCob(""); setEndEnt(""); setEndereco(""); setTipoParceiro(""); setObs("");
    }
  }, [tipo]);

  if (!tipo) return null;

  const titulos: Record<EntidadeTipo, string> = {
    cliente: "Novo Cliente",
    fornecedor: "Novo Fornecedor",
    parceiro: "Novo Parceiro",
  };

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    setSaving(true);
    try {
      const onlyDigits = doc.replace(/\D/g, "");
      const tipo_documento = onlyDigits.length === 11 ? "CPF" : onlyDigits.length === 14 ? "CNPJ" : null;

      let inserted: { id: string; nome: string } | null = null;

      if (tipo === "fornecedor") {
        const { data, error } = await supabase
          .from("fornecedores")
          .insert({
            nome: nome.trim(),
            documento: doc.trim() || null,
            tipo_documento,
            inscricao_estadual: ie.trim() || null,
            telefone: tel.trim() || null,
            email: email.trim() || null,
            endereco_cobranca: endCob.trim() || null,
            endereco_entrega: endEnt.trim() || null,
            observacoes: obs.trim() || null,
            loja_id: lojaId,
            ativo: true,
          } as any)
          .select("id,nome")
          .single();
        if (error) throw error;
        inserted = data as any;
      } else if (tipo === "cliente") {
        const { data, error } = await supabase
          .from("clientes")
          .insert({
            nome: nome.trim(),
            cpf_cnpj: doc.trim() || null,
            telefone: tel.trim() || null,
            email: email.trim() || null,
            endereco_cobranca: endereco.trim() || null,
            observacoes: obs.trim() || null,
            loja_id: lojaId,
            ativo: true,
          } as any)
          .select("id,nome")
          .single();
        if (error) throw error;
        inserted = data as any;
      } else if (tipo === "parceiro") {
        const { data, error } = await supabase
          .from("parceiros")
          .insert({
            nome: nome.trim(),
            cpf_cnpj: doc.trim() || null,
            telefone: tel.trim() || null,
            email: email.trim() || null,
            tipo: tipoParceiro.trim() || null,
            endereco: endereco.trim() || null,
            observacoes: obs.trim() || null,
            loja_id: lojaId,
            ativo: true,
          } as any)
          .select("id,nome")
          .single();
        if (error) throw error;
        inserted = data as any;
      }

      if (inserted) {
        toast.success(`${titulos[tipo]} cadastrado`);
        onCreated(tipo, inserted.id, inserted.nome);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!tipo} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="text-lg font-semibold">{titulos[tipo]}</div>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dados principais</div>
            <div>
              <Label className="text-xs">Nome / Razão social *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CPF / CNPJ</Label>
                <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Documento" />
              </div>
              {tipo === "fornecedor" && (
                <div>
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input value={ie} onChange={(e) => setIe(e.target.value)} />
                </div>
              )}
              {tipo === "parceiro" && (
                <div>
                  <Label className="text-xs">Tipo de parceiro</Label>
                  <Input value={tipoParceiro} onChange={(e) => setTipoParceiro(e.target.value)} placeholder="Ex: Arquiteto" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contato</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endereço</div>
            {tipo === "fornecedor" ? (
              <>
                <div>
                  <Label className="text-xs">Endereço de cobrança</Label>
                  <Input value={endCob} onChange={(e) => setEndCob(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Endereço de entrega</Label>
                  <Input value={endEnt} onChange={(e) => setEndEnt(e.target.value)} />
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs">Endereço</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</div>
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-[13px]"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

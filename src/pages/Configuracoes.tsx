import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Settings, Store, Users, Shield, Tags, CreditCard, Landmark, FileText,
  Plus, Pencil, Trash2, FolderTree, ChevronRight,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type BankAccount = Tables<'bank_accounts'>;
type FinancialCategory = Tables<'financial_categories'>;

// ─── Bank Account Form ───
function BankAccountForm({
  open, onClose, account,
}: { open: boolean; onClose: (saved?: boolean) => void; account?: BankAccount | null }) {
  const [form, setForm] = useState({ name: '', bank: '', agency: '', account_number: '', balance: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name, bank: account.bank ?? '', agency: account.agency ?? '',
        account_number: account.account_number ?? '', balance: String(account.balance ?? 0),
      });
    } else {
      setForm({ name: '', bank: '', agency: '', account_number: '', balance: '0' });
    }
  }, [account, open]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      name: form.name, bank: form.bank || null, agency: form.agency || null,
      account_number: form.account_number || null, balance: parseFloat(form.balance) || 0,
    };
    let error;
    if (account) {
      ({ error } = await supabase.from('bank_accounts').update(payload).eq('id', account.id));
    } else {
      ({ error } = await supabase.from('bank_accounts').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(account ? 'Conta atualizada' : 'Conta criada');
    onClose(true);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{account ? 'Editar' : 'Nova'} Conta Bancária</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Banco</Label><Input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="Ex: Bradesco" /></div>
            <div><Label>Agência</Label><Input value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Conta</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
            <div><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Form ───
function CategoryForm({
  open, onClose, category, categories,
}: { open: boolean; onClose: (saved?: boolean) => void; category?: FinancialCategory | null; categories: FinancialCategory[] }) {
  const [form, setForm] = useState({ name: '', type: 'despesa', parent_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setForm({ name: category.name, type: category.type, parent_id: category.parent_id ?? '' });
    } else {
      setForm({ name: '', type: 'despesa', parent_id: '' });
    }
  }, [category, open]);

  const parents = categories.filter(c => !c.parent_id && (!category || c.id !== category.id));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = { name: form.name, type: form.type, parent_id: form.parent_id || null };
    let error;
    if (category) {
      ({ error } = await supabase.from('financial_categories').update(payload).eq('id', category.id));
    } else {
      ({ error } = await supabase.from('financial_categories').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(category ? 'Categoria atualizada' : 'Categoria criada');
    onClose(true);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{category ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria Pai</Label>
              <Select value={form.parent_id} onValueChange={v => setForm(f => ({ ...f, parent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (raiz)</SelectItem>
                  {parents.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Settings Page ───
export default function Configuracoes() {
  const [tab, setTab] = useState('geral');

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accFormOpen, setAccFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);

  // Categories
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<FinancialCategory | null>(null);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('bank_accounts').select('*').order('name');
    setAccounts(data ?? []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('financial_categories').select('*').order('name');
    setCategories(data ?? []);
  };

  useEffect(() => { fetchAccounts(); fetchCategories(); }, []);

  const fmt = (v: number | null | undefined) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const sections = [
    { title: 'Lojas', desc: 'Gerenciar lojas cadastradas', icon: Store },
    { title: 'Usuários', desc: 'Gerenciar usuários do sistema', icon: Users },
    { title: 'Perfis e Permissões', desc: 'Definir níveis de acesso', icon: Shield },
    { title: 'Tags e Origens', desc: 'Configurar tags e origens de leads', icon: Tags },
    { title: 'Formas de Pagamento', desc: 'Gerenciar formas de pagamento', icon: CreditCard },
    { title: 'Templates de Contrato', desc: 'Modelos de contrato por loja', icon: FileText },
    { title: 'Regras de Aprovação', desc: 'Limites de desconto e aprovações', icon: Settings },
  ];

  // Build category tree
  const rootCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Configurações gerais do sistema</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
          <TabsTrigger value="categorias">Categorias Financeiras</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="geral">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sections.map(s => (
              <Card key={s.title} className="border-border/60 hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <s.icon className="h-5 w-5 text-primary mb-2" />
                  <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Bank Accounts */}
        <TabsContent value="contas">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Contas Bancárias</h2>
              <Button onClick={() => { setEditAccount(null); setAccFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova Conta
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Agência</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conta cadastrada</TableCell></TableRow>
                  )}
                  {accounts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.bank ?? '—'}</TableCell>
                      <TableCell>{a.agency ?? '—'}</TableCell>
                      <TableCell>{a.account_number ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(a.balance)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={a.active ? 'bg-success/10 text-success border-success/30' : ''}>
                          {a.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditAccount(a); setAccFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Financial Categories */}
        <TabsContent value="categorias">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Categorias Financeiras</h2>
              <Button onClick={() => { setEditCategory(null); setCatFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova Categoria
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receitas */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success" /> Receitas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {rootCategories.filter(c => c.type === 'receita').length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria de receita</p>
                  )}
                  {rootCategories.filter(c => c.type === 'receita').map(cat => (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                          {cat.name}
                        </div>
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditCategory(cat); setCatFormOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      {getChildren(cat.id).map(sub => (
                        <div key={sub.id} className="flex items-center justify-between py-1 px-2 pl-8 rounded hover:bg-muted/50 group">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-3 w-3" /> {sub.name}
                          </div>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditCategory(sub); setCatFormOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Despesas */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive" /> Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {rootCategories.filter(c => c.type === 'despesa').length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria de despesa</p>
                  )}
                  {rootCategories.filter(c => c.type === 'despesa').map(cat => (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                          {cat.name}
                        </div>
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditCategory(cat); setCatFormOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      {getChildren(cat.id).map(sub => (
                        <div key={sub.id} className="flex items-center justify-between py-1 px-2 pl-8 rounded hover:bg-muted/50 group">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-3 w-3" /> {sub.name}
                          </div>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditCategory(sub); setCatFormOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <BankAccountForm open={accFormOpen} onClose={(saved) => { setAccFormOpen(false); setEditAccount(null); if (saved) fetchAccounts(); }} account={editAccount} />
      <CategoryForm open={catFormOpen} onClose={(saved) => { setCatFormOpen(false); setEditCategory(null); if (saved) fetchCategories(); }} category={editCategory} categories={categories} />
    </div>
  );
}

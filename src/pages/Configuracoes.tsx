import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { maskCnpj, maskPhone } from '@/lib/masks';
import {
  Store, Users, Shield, Tags, CreditCard, Landmark, FileText,
  Plus, Pencil, FolderTree, ChevronRight, GitBranch, Trash2, DollarSign,
} from 'lucide-react';
import Financeiro from '@/pages/Financeiro';
import type { Tables as DBTables } from '@/integrations/supabase/types';

type BankAccount = DBTables<'bank_accounts'>;
type FinancialCategory = DBTables<'financial_categories'>;
type StoreType = DBTables<'stores'>;
type Profile = DBTables<'profiles'>;

const NONE = '__none__';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  projetista: 'Projetista',
  financeiro: 'Financeiro',
  gerente_loja: 'Gerente',
  conferente: 'Conferente',
  atendente: 'Atendente',
  vendedor: 'Vendedor',
  diretoria: 'Diretoria',
  revisao: 'Revisão',
  montagem: 'Montagem',
  pos_venda: 'Pós-venda',
};

// ─── Generic CRUD Dialog ───
function CrudDialog({ open, onClose, title, children, onSave, saving }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; onSave: () => void; saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Settings Page ───
export default function Configuracoes() {
  const [tab, setTab] = useState('lojas');

  // Stores
  const [stores, setStores] = useState<StoreType[]>([]);
  const [storeForm, setStoreForm] = useState({ name: '', cnpj: '', email: '', phone: '', address: '' });
  const [storeOpen, setStoreOpen] = useState(false);
  const [editStore, setEditStore] = useState<StoreType | null>(null);
  const [storeSaving, setStoreSaving] = useState(false);

  // Profiles / Users
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [userOpen, setUserOpen] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'atendente', store_id: '' });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  // Role edit
  const [roleEditUserId, setRoleEditUserId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState('');
  const [roleEditSaving, setRoleEditSaving] = useState(false);

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accForm, setAccForm] = useState({ name: '', bank: '', agency: '', account_number: '', balance: '' });
  const [accOpen, setAccOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<BankAccount | null>(null);
  const [accSaving, setAccSaving] = useState(false);

  // Categories
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [catForm, setCatForm] = useState({ name: '', type: 'despesa', parent_id: '' });
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<FinancialCategory | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  // Tags & Origins
  const [tags, setTags] = useState<any[]>([]);
  const [tagForm, setTagForm] = useState({ name: '', type: 'orcamento', color: '#6b7280' });
  const [tagOpen, setTagOpen] = useState(false);
  const [editTag, setEditTag] = useState<any>(null);
  const [tagSaving, setTagSaving] = useState(false);

  const [origins, setOrigins] = useState<any[]>([]);
  const [originForm, setOriginForm] = useState({ name: '' });
  const [originOpen, setOriginOpen] = useState(false);
  const [editOrigin, setEditOrigin] = useState<any>(null);
  const [originSaving, setOriginSaving] = useState(false);

  // Payment methods
  const [payments, setPayments] = useState<any[]>([]);
  const [payForm, setPayForm] = useState({ name: '' });
  const [payOpen, setPayOpen] = useState(false);
  const [editPay, setEditPay] = useState<any>(null);
  const [paySaving, setPaySaving] = useState(false);

  // Contract templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplForm, setTplForm] = useState({ name: '', content: '', store_id: '' });
  const [tplOpen, setTplOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<any>(null);
  const [tplSaving, setTplSaving] = useState(false);

  // Approval rules
  const [rules, setRules] = useState<any[]>([]);
  const [ruleForm, setRuleForm] = useState({ rule_type: 'desconto', max_percent: '', approver_role: 'gerente_loja', description: '', affected_roles: [] as string[] });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editRule, setEditRule] = useState<any>(null);
  const [ruleSaving, setRuleSaving] = useState(false);

  // Pipeline stages
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [pipeForm, setPipeForm] = useState({ pipeline_type: 'contrato', name: '', display_order: '', color: '#6b7280', is_initial: false, is_final: false });
  const [pipeOpen, setPipeOpen] = useState(false);
  const [editPipe, setEditPipe] = useState<any>(null);
  const [pipeSaving, setPipeSaving] = useState(false);

  // Fetch functions
  const fetchStores = async () => { const { data } = await supabase.from('stores').select('*').order('name'); setStores(data ?? []); };
  const fetchProfiles = async () => { const { data } = await supabase.from('profiles').select('*').order('full_name'); setProfiles(data ?? []); };
  const fetchUserRoles = async () => {
    const { data } = await supabase.from('user_roles').select('user_id, role');
    const map: Record<string, string> = {};
    (data ?? []).forEach(r => { map[r.user_id] = r.role; });
    setUserRoles(map);
  };
  const fetchAccounts = async () => { const { data } = await supabase.from('bank_accounts').select('*').order('name'); setAccounts(data ?? []); };
  const fetchCategories = async () => { const { data } = await supabase.from('financial_categories').select('*').order('name'); setCategories(data ?? []); };
  const fetchTags = async () => { const { data } = await supabase.from('tags_config').select('*').order('name'); setTags(data ?? []); };
  const fetchOrigins = async () => { const { data } = await supabase.from('origins_config').select('*').order('name'); setOrigins(data ?? []); };
  const fetchPayments = async () => { const { data } = await supabase.from('payment_methods').select('*').order('name'); setPayments(data ?? []); };
  const fetchTemplates = async () => { const { data } = await supabase.from('contract_templates').select('*').order('name'); setTemplates(data ?? []); };
  const fetchRules = async () => { const { data } = await supabase.from('approval_rules').select('*').order('created_at'); setRules(data ?? []); };
  const fetchPipelines = async () => { const { data } = await supabase.from('pipeline_stages').select('*').order('pipeline_type').order('display_order'); setPipelineStages(data ?? []); };

  useEffect(() => {
    fetchStores(); fetchProfiles(); fetchUserRoles(); fetchAccounts(); fetchCategories();
    fetchTags(); fetchOrigins(); fetchPayments(); fetchTemplates(); fetchRules(); fetchPipelines();
  }, []);

  const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  // ─── Store handlers ───
  const openStoreForm = (store?: StoreType) => {
    if (store) {
      setEditStore(store);
      setStoreForm({ name: store.name, cnpj: store.cnpj ?? '', email: store.email ?? '', phone: store.phone ?? '', address: store.address ?? '' });
    } else {
      setEditStore(null);
      setStoreForm({ name: '', cnpj: '', email: '', phone: '', address: '' });
    }
    setStoreOpen(true);
  };
  const saveStore = async () => {
    if (!storeForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setStoreSaving(true);
    const payload = { name: storeForm.name, cnpj: storeForm.cnpj || null, email: storeForm.email || null, phone: storeForm.phone || null, address: storeForm.address || null };
    const { error } = editStore
      ? await supabase.from('stores').update(payload).eq('id', editStore.id)
      : await supabase.from('stores').insert(payload);
    setStoreSaving(false);
    if (error) { toast.error('Erro ao salvar loja'); return; }
    toast.success(editStore ? 'Loja atualizada' : 'Loja criada');
    setStoreOpen(false); fetchStores();
  };

  // ─── User creation / editing ───
  const openUserForm = (profile?: Profile) => {
    if (profile) {
      setEditUserId(profile.user_id);
      setUserForm({
        email: '', // Can't retrieve email from profile, user fills if changing
        password: '',
        full_name: profile.full_name ?? '',
        role: userRoles[profile.user_id] ?? 'atendente',
        store_id: profile.store_id ?? '',
      });
    } else {
      setEditUserId(null);
      setUserForm({ email: '', password: '', full_name: '', role: 'atendente', store_id: '' });
    }
    setUserOpen(true);
  };

  const saveUser = async () => {
    setUserSaving(true);
    try {
      if (editUserId) {
        // Update existing user via edge function
        const body: Record<string, unknown> = { user_id: editUserId };
        if (userForm.full_name) body.full_name = userForm.full_name;
        if (userForm.email) body.email = userForm.email;
        if (userForm.password) body.password = userForm.password;
        if (userForm.role) body.role = userForm.role;
        body.store_id = userForm.store_id || null;

        const resp = await supabase.functions.invoke('update-user', { body });
        if (resp.error || resp.data?.error) {
          toast.error(resp.data?.error || 'Erro ao atualizar usuário');
          setUserSaving(false);
          return;
        }
        toast.success('Usuário atualizado com sucesso');
      } else {
        // Create new user
        if (!userForm.email || !userForm.password || !userForm.full_name) {
          toast.error('Preencha todos os campos obrigatórios');
          setUserSaving(false);
          return;
        }
        if (userForm.password.length < 6) {
          toast.error('Senha deve ter no mínimo 6 caracteres');
          setUserSaving(false);
          return;
        }
        const resp = await supabase.functions.invoke('create-user', {
          body: {
            email: userForm.email,
            password: userForm.password,
            full_name: userForm.full_name,
            role: userForm.role,
            store_id: userForm.store_id || null,
          },
        });
        if (resp.error || resp.data?.error) {
          toast.error(resp.data?.error || 'Erro ao criar usuário');
          setUserSaving(false);
          return;
        }
        toast.success('Usuário criado com sucesso');
      }
      setUserOpen(false);
      setEditUserId(null);
      setUserForm({ email: '', password: '', full_name: '', role: 'atendente', store_id: '' });
      fetchProfiles(); fetchUserRoles();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar usuário');
    }
    setUserSaving(false);
  };

  // ─── Role edit ───
  const saveRoleEdit = async () => {
    if (!roleEditUserId || !roleEditValue) return;
    setRoleEditSaving(true);
    const existing = userRoles[roleEditUserId];
    if (existing) {
      await supabase.from('user_roles').update({ role: roleEditValue as any }).eq('user_id', roleEditUserId);
    } else {
      await supabase.from('user_roles').insert({ user_id: roleEditUserId, role: roleEditValue as any });
    }
    toast.success('Cargo atualizado');
    setRoleEditUserId(null);
    setRoleEditSaving(false);
    fetchUserRoles();
  };

  // ─── Bank Account handlers ───
  const openAccForm = (acc?: BankAccount) => {
    if (acc) {
      setEditAcc(acc);
      setAccForm({ name: acc.name, bank: acc.bank ?? '', agency: acc.agency ?? '', account_number: acc.account_number ?? '', balance: String(acc.balance ?? 0) });
    } else {
      setEditAcc(null);
      setAccForm({ name: '', bank: '', agency: '', account_number: '', balance: '0' });
    }
    setAccOpen(true);
  };
  const saveAcc = async () => {
    if (!accForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setAccSaving(true);
    const payload: any = { name: accForm.name, bank: accForm.bank || null, agency: accForm.agency || null, account_number: accForm.account_number || null, balance: parseFloat(accForm.balance) || 0 };
    if (!editAcc) payload.last_check_date = new Date().toISOString();
    const { error } = editAcc
      ? await supabase.from('bank_accounts').update(payload).eq('id', editAcc.id)
      : await supabase.from('bank_accounts').insert(payload);
    setAccSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(editAcc ? 'Conta atualizada' : 'Conta criada');
    setAccOpen(false); fetchAccounts();
  };
  const markCheckDate = async (acc: BankAccount) => {
    await supabase.from('bank_accounts').update({ last_check_date: new Date().toISOString() } as any).eq('id', acc.id);
    toast.success('Data de checagem atualizada');
    fetchAccounts();
  };

  // ─── Category handlers ───
  const openCatForm = (cat?: FinancialCategory) => {
    if (cat) {
      setEditCat(cat);
      setCatForm({ name: cat.name, type: cat.type, parent_id: cat.parent_id ?? '' });
    } else {
      setEditCat(null);
      setCatForm({ name: '', type: 'despesa', parent_id: '' });
    }
    setCatOpen(true);
  };
  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setCatSaving(true);
    const payload = { name: catForm.name, type: catForm.type, parent_id: catForm.parent_id || null };
    const { error } = editCat
      ? await supabase.from('financial_categories').update(payload).eq('id', editCat.id)
      : await supabase.from('financial_categories').insert(payload);
    setCatSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(editCat ? 'Categoria atualizada' : 'Categoria criada');
    setCatOpen(false); fetchCategories();
  };

  // ─── Tag handlers ───
  const openTagForm = (t?: any) => {
    if (t) { setEditTag(t); setTagForm({ name: t.name, type: t.type, color: t.color ?? '#6b7280' }); }
    else { setEditTag(null); setTagForm({ name: '', type: 'orcamento', color: '#6b7280' }); }
    setTagOpen(true);
  };
  const saveTag = async () => {
    if (!tagForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setTagSaving(true);
    const payload = { name: tagForm.name, type: tagForm.type, color: tagForm.color };
    const { error } = editTag
      ? await supabase.from('tags_config').update(payload).eq('id', editTag.id)
      : await supabase.from('tags_config').insert(payload);
    setTagSaving(false);
    if (error) { toast.error('Erro ao salvar tag'); return; }
    toast.success(editTag ? 'Tag atualizada' : 'Tag criada');
    setTagOpen(false); fetchTags();
  };

  // ─── Origin handlers ───
  const openOriginForm = (o?: any) => {
    if (o) { setEditOrigin(o); setOriginForm({ name: o.name }); }
    else { setEditOrigin(null); setOriginForm({ name: '' }); }
    setOriginOpen(true);
  };
  const saveOrigin = async () => {
    if (!originForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setOriginSaving(true);
    const payload = { name: originForm.name };
    const { error } = editOrigin
      ? await supabase.from('origins_config').update(payload).eq('id', editOrigin.id)
      : await supabase.from('origins_config').insert(payload);
    setOriginSaving(false);
    if (error) { toast.error('Erro ao salvar origem'); return; }
    toast.success(editOrigin ? 'Origem atualizada' : 'Origem criada');
    setOriginOpen(false); fetchOrigins();
  };

  // ─── Payment handlers ───
  const openPayForm = (p?: any) => {
    if (p) { setEditPay(p); setPayForm({ name: p.name }); }
    else { setEditPay(null); setPayForm({ name: '' }); }
    setPayOpen(true);
  };
  const savePay = async () => {
    if (!payForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setPaySaving(true);
    const payload = { name: payForm.name };
    const { error } = editPay
      ? await supabase.from('payment_methods').update(payload).eq('id', editPay.id)
      : await supabase.from('payment_methods').insert(payload);
    setPaySaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(editPay ? 'Forma atualizada' : 'Forma criada');
    setPayOpen(false); fetchPayments();
  };

  // ─── Template handlers ───
  const openTplForm = (t?: any) => {
    if (t) { setEditTpl(t); setTplForm({ name: t.name, content: t.content ?? '', store_id: t.store_id ?? '' }); }
    else { setEditTpl(null); setTplForm({ name: '', content: '', store_id: '' }); }
    setTplOpen(true);
  };
  const saveTpl = async () => {
    if (!tplForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setTplSaving(true);
    const payload = { name: tplForm.name, content: tplForm.content || null, store_id: tplForm.store_id || null };
    const { error } = editTpl
      ? await supabase.from('contract_templates').update(payload).eq('id', editTpl.id)
      : await supabase.from('contract_templates').insert(payload);
    setTplSaving(false);
    if (error) { toast.error('Erro ao salvar template'); return; }
    toast.success(editTpl ? 'Template atualizado' : 'Template criado');
    setTplOpen(false); fetchTemplates();
  };

  // ─── Rule handlers ───
  const openRuleForm = (r?: any) => {
    if (r) { setEditRule(r); setRuleForm({ rule_type: r.rule_type, max_percent: String(r.max_percent ?? ''), approver_role: r.approver_role, description: r.description ?? '', affected_roles: r.affected_roles ?? [] }); }
    else { setEditRule(null); setRuleForm({ rule_type: 'desconto', max_percent: '', approver_role: 'gerente_loja', description: '', affected_roles: [] }); }
    setRuleOpen(true);
  };
  const saveRule = async () => {
    setRuleSaving(true);
    const payload = { rule_type: ruleForm.rule_type, max_percent: parseFloat(ruleForm.max_percent) || 0, approver_role: ruleForm.approver_role, description: ruleForm.description || null, affected_roles: ruleForm.affected_roles };
    const { error } = editRule
      ? await supabase.from('approval_rules').update(payload).eq('id', editRule.id)
      : await supabase.from('approval_rules').insert(payload);
    setRuleSaving(false);
    if (error) { toast.error('Erro ao salvar regra'); return; }
    toast.success(editRule ? 'Regra atualizada' : 'Regra criada');
    setRuleOpen(false); fetchRules();
  };

  // ─── Pipeline handlers ───
  const PIPELINE_TYPES = [
    { value: 'contrato', label: 'Contrato' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'montagem', label: 'Montagem' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'pos_montagem', label: 'Pós-montagem' },
  ];
  const openPipeForm = (p?: any) => {
    if (p) { setEditPipe(p); setPipeForm({ pipeline_type: p.pipeline_type, name: p.name, display_order: String(p.display_order), color: p.color ?? '#6b7280', is_initial: p.is_initial ?? false, is_final: p.is_final ?? false }); }
    else { setEditPipe(null); setPipeForm({ pipeline_type: 'contrato', name: '', display_order: String(pipelineStages.length), color: '#6b7280', is_initial: false, is_final: false }); }
    setPipeOpen(true);
  };
  const savePipe = async () => {
    if (!pipeForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setPipeSaving(true);
    const payload = { pipeline_type: pipeForm.pipeline_type, name: pipeForm.name, display_order: parseInt(pipeForm.display_order) || 0, color: pipeForm.color, is_initial: pipeForm.is_initial, is_final: pipeForm.is_final } as any;
    const { error } = editPipe
      ? await supabase.from('pipeline_stages').update(payload).eq('id', editPipe.id)
      : await supabase.from('pipeline_stages').insert(payload);
    setPipeSaving(false);
    if (error) { toast.error('Erro ao salvar estágio'); return; }
    toast.success(editPipe ? 'Estágio atualizado' : 'Estágio criado');
    setPipeOpen(false); fetchPipelines();
  };
  const deletePipe = async (id: string) => {
    await supabase.from('pipeline_stages').update({ active: false } as any).eq('id', id);
    toast.success('Estágio desativado');
    fetchPipelines();
  };

  const rootCats = categories.filter(c => !c.parent_id);
  const getChildren = (pid: string) => categories.filter(c => c.parent_id === pid);
  const parentCats = (type: string) => categories.filter(c => !c.parent_id && c.type === type && (!editCat || c.id !== editCat.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerenciamento completo do sistema</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lojas"><Store className="h-3.5 w-3.5 mr-1.5" />Lojas</TabsTrigger>
          <TabsTrigger value="usuarios"><Users className="h-3.5 w-3.5 mr-1.5" />Usuários</TabsTrigger>
          <TabsTrigger value="contas"><Landmark className="h-3.5 w-3.5 mr-1.5" />Contas</TabsTrigger>
          <TabsTrigger value="categorias"><FolderTree className="h-3.5 w-3.5 mr-1.5" />Categorias</TabsTrigger>
          <TabsTrigger value="tags"><Tags className="h-3.5 w-3.5 mr-1.5" />Tags/Origens</TabsTrigger>
          <TabsTrigger value="pagamentos"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Pagamentos</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3.5 w-3.5 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="aprovacoes"><Shield className="h-3.5 w-3.5 mr-1.5" />Aprovações</TabsTrigger>
          <TabsTrigger value="pipelines"><GitBranch className="h-3.5 w-3.5 mr-1.5" />Pipelines</TabsTrigger>
          <TabsTrigger value="financeiro"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Financeiro</TabsTrigger>
        </TabsList>

        {/* ─── Lojas ─── */}
        <TabsContent value="lojas">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Lojas</h2>
              <Button onClick={() => openStoreForm()}><Plus className="h-4 w-4 mr-2" />Nova Loja</Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>E-mail</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {stores.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma loja</TableCell></TableRow>}
                  {stores.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.cnpj ? maskCnpj(s.cnpj) : '—'}</TableCell>
                      <TableCell>{s.email ?? '—'}</TableCell>
                      <TableCell>{s.phone ? maskPhone(s.phone) : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={s.active ? 'bg-emerald-500/10 text-emerald-600' : ''}>{s.active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openStoreForm(s)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─── Usuários ─── */}
        <TabsContent value="usuarios">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Usuários e Perfis</h2>
              <Button onClick={() => openUserForm()}><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead><TableHead>Loja</TableHead><TableHead>Cargo</TableHead><TableHead>Criado em</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {profiles.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário</TableCell></TableRow>}
                  {profiles.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name ?? '—'}</TableCell>
                      <TableCell>{stores.find(s => s.id === p.store_id)?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABELS[userRoles[p.user_id]] ?? userRoles[p.user_id] ?? 'Sem cargo'}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(p.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openUserForm(p)}>
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

        {/* ─── Contas Bancárias ─── */}
        <TabsContent value="contas">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Contas Bancárias</h2>
              <Button onClick={() => openAccForm()}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead><TableHead>Banco</TableHead><TableHead>Agência</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Criação</TableHead><TableHead>Última Checagem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {accounts.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma conta</TableCell></TableRow>}
                  {accounts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.bank ?? '—'}</TableCell>
                      <TableCell>{a.agency ?? '—'}</TableCell>
                      <TableCell>{a.account_number ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(a.balance)}</TableCell>
                      <TableCell>{fmtDate(a.created_at)}</TableCell>
                      <TableCell>{fmtDate((a as any).last_check_date)}</TableCell>
                      <TableCell><Badge variant="outline" className={a.active ? 'bg-emerald-500/10 text-emerald-600' : ''}>{a.active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markCheckDate(a)}>Checar</Button>
                          <Button size="sm" variant="ghost" onClick={() => openAccForm(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─── Categorias ─── */}
        <TabsContent value="categorias">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Categorias Financeiras</h2>
              <Button onClick={() => openCatForm()}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
            </div>
            <p className="text-xs text-muted-foreground">As categorias serão usadas para classificar lançamentos financeiros e gerar o DRE. Caso precise de categorias específicas, envie a lista que configuramos para você.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['receita', 'despesa'].map(type => (
                <Card key={type} className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${type === 'receita' ? 'bg-emerald-500' : 'bg-destructive'}`} />
                      {type === 'receita' ? 'Receitas' : 'Despesas'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {rootCats.filter(c => c.type === type).length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria</p>
                    )}
                    {rootCats.filter(c => c.type === type).map(cat => (
                      <div key={cat.id}>
                        <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
                          <div className="flex items-center gap-2 text-sm font-medium"><FolderTree className="h-3.5 w-3.5 text-muted-foreground" />{cat.name}</div>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => openCatForm(cat)}><Pencil className="h-3 w-3" /></Button>
                        </div>
                        {getChildren(cat.id).map(sub => (
                          <div key={sub.id} className="flex items-center justify-between py-1 px-2 pl-8 rounded hover:bg-muted/50 group">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><ChevronRight className="h-3 w-3" />{sub.name}</div>
                            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => openCatForm(sub)}><Pencil className="h-3 w-3" /></Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ─── Tags & Origens ─── */}
        <TabsContent value="tags">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Tags</h2>
                <Button onClick={() => openTagForm()}><Plus className="h-4 w-4 mr-2" />Nova Tag</Button>
              </div>
              <div className="space-y-2">
                {tags.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag</p>}
                {tags.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 group">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openTagForm(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Origens de Lead</h2>
                <Button onClick={() => openOriginForm()}><Plus className="h-4 w-4 mr-2" />Nova Origem</Button>
              </div>
              <div className="space-y-2">
                {origins.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma origem</p>}
                {origins.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 group">
                    <span className="text-sm font-medium">{o.name}</span>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openOriginForm(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Formas de Pagamento ─── */}
        <TabsContent value="pagamentos">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Formas de Pagamento</h2>
              <Button onClick={() => openPayForm()}><Plus className="h-4 w-4 mr-2" />Nova Forma</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {payments.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma forma de pagamento</p>}
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/30 group">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openPayForm(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ─── Templates de Contrato ─── */}
        <TabsContent value="templates">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Templates de Contrato</h2>
              <Button onClick={() => openTplForm()}><Plus className="h-4 w-4 mr-2" />Novo Template</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {templates.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum template</p>}
              {templates.map(t => (
                <Card key={t.id} className="border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTplForm(t)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />{t.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.content ? t.content.slice(0, 120) + '…' : 'Sem conteúdo'}</p>
                    {t.store_id && <Badge variant="outline" className="mt-2 text-[10px]">{stores.find(s => s.id === t.store_id)?.name ?? 'Loja'}</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ─── Regras de Aprovação ─── */}
        <TabsContent value="aprovacoes">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Regras de Aprovação</h2>
              <Button onClick={() => openRuleForm()}><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Tipo</TableHead><TableHead>Limite %</TableHead><TableHead>Aprovador</TableHead><TableHead>Cargos afetados</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma regra</TableCell></TableRow>}
                  {rules.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium capitalize">{r.rule_type}</TableCell>
                      <TableCell>{r.max_percent}%</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABELS[r.approver_role] ?? r.approver_role}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-1">{(r.affected_roles?.length > 0) ? r.affected_roles.map((ar: string) => <Badge key={ar} variant="secondary" className="text-[10px]">{ROLE_LABELS[ar] ?? ar}</Badge>) : <span className="text-muted-foreground text-xs">Todos</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.description ?? '—'}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openRuleForm(r)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─── Pipelines ─── */}
        <TabsContent value="pipelines">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Estágios dos Pipelines</h2>
              <Button onClick={() => openPipeForm()}><Plus className="h-4 w-4 mr-2" />Novo Estágio</Button>
            </div>
            <p className="text-xs text-muted-foreground">Configure os estágios de cada pipeline/departamento. Eles serão usados nos Kanbans e na Visão 360° dos pedidos.</p>
            {PIPELINE_TYPES.map(pt => {
              const ptStages = pipelineStages.filter(s => s.pipeline_type === pt.value && s.active !== false);
              return (
                <Card key={pt.value} className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-primary" />{pt.label}
                      <Badge variant="secondary" className="text-[10px]">{ptStages.length} estágios</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {ptStages.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">Nenhum estágio</p>}
                    {ptStages.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="font-medium">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground">#{s.display_order}</span>
                          {s.is_initial && <Badge variant="outline" className="text-[9px] h-4">Inicial</Badge>}
                          {s.is_final && <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600">Final</Badge>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openPipeForm(s)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deletePipe(s.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Financeiro ─── */}
        <TabsContent value="financeiro">
          <Financeiro />
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}
      <CrudDialog open={storeOpen} onClose={() => setStoreOpen(false)} title={editStore ? 'Editar Loja' : 'Nova Loja'} onSave={saveStore} saving={storeSaving}>
        <div><Label>Nome *</Label><Input value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>CNPJ</Label><Input value={storeForm.cnpj} onChange={e => setStoreForm(f => ({ ...f, cnpj: maskCnpj(e.target.value) }))} placeholder="00.000.000/0000-00" /></div>
          <div><Label>E-mail</Label><Input value={storeForm.email} onChange={e => setStoreForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone</Label><Input value={storeForm.phone} onChange={e => setStoreForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} /></div>
          <div><Label>Endereço</Label><Input value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))} /></div>
        </div>
      </CrudDialog>

      {/* User creation/editing dialog */}
      <CrudDialog open={userOpen} onClose={() => { setUserOpen(false); setEditUserId(null); }} title={editUserId ? 'Editar Usuário' : 'Novo Usuário'} onSave={saveUser} saving={userSaving}>
        <div><Label>Nome completo {!editUserId && '*'}</Label><Input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} /></div>
        <div><Label>E-mail {!editUserId && '*'}</Label><Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder={editUserId ? 'Deixe em branco para manter o atual' : ''} /></div>
        <div><Label>Senha {!editUserId && '*'}</Label><Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder={editUserId ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cargo</Label>
            <Select value={userForm.role} onValueChange={v => setUserForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Loja</Label>
            <Select value={userForm.store_id || NONE} onValueChange={v => setUserForm(f => ({ ...f, store_id: v === NONE ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CrudDialog>

      <CrudDialog open={accOpen} onClose={() => setAccOpen(false)} title={editAcc ? 'Editar Conta' : 'Nova Conta'} onSave={saveAcc} saving={accSaving}>
        <div><Label>Nome *</Label><Input value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Banco</Label><Input value={accForm.bank} onChange={e => setAccForm(f => ({ ...f, bank: e.target.value }))} /></div>
          <div><Label>Agência</Label><Input value={accForm.agency} onChange={e => setAccForm(f => ({ ...f, agency: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Conta</Label><Input value={accForm.account_number} onChange={e => setAccForm(f => ({ ...f, account_number: e.target.value }))} /></div>
          <div><Label>Saldo (R$)</Label><Input type="number" step="0.01" value={accForm.balance} onChange={e => setAccForm(f => ({ ...f, balance: e.target.value }))} /></div>
        </div>
      </CrudDialog>

      <CrudDialog open={catOpen} onClose={() => setCatOpen(false)} title={editCat ? 'Editar Categoria' : 'Nova Categoria'} onSave={saveCat} saving={catSaving}>
        <div><Label>Nome *</Label><Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={catForm.type} onValueChange={v => setCatForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria Pai</Label>
            <Select value={catForm.parent_id || NONE} onValueChange={v => setCatForm(f => ({ ...f, parent_id: v === NONE ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma (raiz)</SelectItem>
                {parentCats(catForm.type).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CrudDialog>

      <CrudDialog open={tagOpen} onClose={() => setTagOpen(false)} title={editTag ? 'Editar Tag' : 'Nova Tag'} onSave={saveTag} saving={tagSaving}>
        <div><Label>Nome *</Label><Input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tagForm.type} onValueChange={v => setTagForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="orcamento">Orçamento</SelectItem>
                <SelectItem value="pedido">Pedido</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Cor</Label><Input type="color" value={tagForm.color} onChange={e => setTagForm(f => ({ ...f, color: e.target.value }))} className="h-9" /></div>
        </div>
      </CrudDialog>

      <CrudDialog open={originOpen} onClose={() => setOriginOpen(false)} title={editOrigin ? 'Editar Origem' : 'Nova Origem'} onSave={saveOrigin} saving={originSaving}>
        <div><Label>Nome *</Label><Input value={originForm.name} onChange={e => setOriginForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Instagram, Indicação, Showroom" /></div>
      </CrudDialog>

      <CrudDialog open={payOpen} onClose={() => setPayOpen(false)} title={editPay ? 'Editar Forma' : 'Nova Forma de Pagamento'} onSave={savePay} saving={paySaving}>
        <div><Label>Nome *</Label><Input value={payForm.name} onChange={e => setPayForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: PIX, Boleto, Cartão 3x" /></div>
      </CrudDialog>

      <CrudDialog open={tplOpen} onClose={() => setTplOpen(false)} title={editTpl ? 'Editar Template' : 'Novo Template'} onSave={saveTpl} saving={tplSaving}>
        <div><Label>Nome *</Label><Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div>
          <Label>Loja (opcional)</Label>
          <Select value={tplForm.store_id || NONE} onValueChange={v => setTplForm(f => ({ ...f, store_id: v === NONE ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todas as lojas</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conteúdo do contrato</Label>
          <Textarea value={tplForm.content} onChange={e => setTplForm(f => ({ ...f, content: e.target.value }))} rows={12} placeholder="Use variáveis como {{cliente}}, {{valor}}, {{data}}..." className="font-mono text-xs" />
        </div>
      </CrudDialog>

      <CrudDialog open={ruleOpen} onClose={() => setRuleOpen(false)} title={editRule ? 'Editar Regra' : 'Nova Regra'} onSave={saveRule} saving={ruleSaving}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={ruleForm.rule_type} onValueChange={v => setRuleForm(f => ({ ...f, rule_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desconto">Desconto</SelectItem>
                <SelectItem value="prazo">Prazo de pagamento</SelectItem>
                <SelectItem value="valor">Valor mínimo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Limite máximo (%)</Label><Input type="number" step="0.5" value={ruleForm.max_percent} onChange={e => setRuleForm(f => ({ ...f, max_percent: e.target.value }))} /></div>
        </div>
        <div>
          <Label>Cargo aprovador</Label>
          <Select value={ruleForm.approver_role} onValueChange={v => setRuleForm(f => ({ ...f, approver_role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Cargos afetados (vazio = todos)</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={ruleForm.affected_roles.includes(k)}
                  onCheckedChange={(checked) => {
                    setRuleForm(f => ({
                      ...f,
                      affected_roles: checked
                        ? [...f.affected_roles, k]
                        : f.affected_roles.filter(r => r !== k)
                    }));
                  }}
                />
                {v}
              </label>
            ))}
          </div>
        </div>
        <div><Label>Descrição</Label><Input value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Desconto acima de 10% precisa de aprovação" /></div>
      </CrudDialog>

      <CrudDialog open={pipeOpen} onClose={() => setPipeOpen(false)} title={editPipe ? 'Editar Estágio' : 'Novo Estágio'} onSave={savePipe} saving={pipeSaving}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Pipeline *</Label>
            <Select value={pipeForm.pipeline_type} onValueChange={v => setPipeForm(f => ({ ...f, pipeline_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nome *</Label><Input value={pipeForm.name} onChange={e => setPipeForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Em andamento" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Ordem</Label><Input type="number" value={pipeForm.display_order} onChange={e => setPipeForm(f => ({ ...f, display_order: e.target.value }))} /></div>
          <div><Label>Cor</Label><Input type="color" value={pipeForm.color} onChange={e => setPipeForm(f => ({ ...f, color: e.target.value }))} className="h-9" /></div>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={pipeForm.is_initial} onChange={e => setPipeForm(f => ({ ...f, is_initial: e.target.checked }))} /> Inicial</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={pipeForm.is_final} onChange={e => setPipeForm(f => ({ ...f, is_final: e.target.checked }))} /> Final</label>
          </div>
        </div>
      </CrudDialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Save, UserCog } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "diretor", label: "Diretor" },
  { value: "gerente", label: "Gerente de Loja" },
  { value: "vendedor", label: "Vendedor / Consultor" },
  { value: "projetista", label: "Projetista" },
  { value: "financeiro", label: "Financeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "montador", label: "Montador" },
  { value: "assistencia", label: "Assistência / Pós-venda" },
];

type Cat = { modulo: string; acao: string; descricao: string | null };

function MatrixEditor({
  catalog, granted, onToggle, readOnly,
}: {
  catalog: Cat[];
  granted: Set<string>;
  onToggle: (modulo: string, acao: string, value: boolean) => void;
  readOnly?: boolean;
}) {
  const grouped = useMemo(() => {
    const m: Record<string, Cat[]> = {};
    for (const c of catalog) (m[c.modulo] ||= []).push(c);
    return m;
  }, [catalog]);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([modulo, items]) => (
        <div key={modulo} className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-[13px] font-semibold uppercase tracking-wide">{modulo}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
            {items.map((it) => {
              const key = `${it.modulo}:${it.acao}`;
              return (
                <label key={key} className="flex items-start gap-2 text-[13px] cursor-pointer">
                  <Checkbox
                    checked={granted.has(key)}
                    disabled={readOnly}
                    onCheckedChange={(v) => onToggle(it.modulo, it.acao, !!v)}
                  />
                  <span>
                    <span className="font-medium">{it.acao}</span>
                    {it.descricao && <span className="text-muted-foreground"> — {it.descricao}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PermissoesAdmin() {
  const [catalog, setCatalog] = useState<Cat[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("permissoes_modulos_catalogo" as any)
        .select("modulo,acao,descricao")
        .order("modulo").order("acao");
      setCatalog(((data as unknown) as Cat[]) || []);
    })();
  }, []);

  return (
    <div className="surface-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-[#2D6BE5]" />
        <h2 className="text-[18px] font-semibold">Permissões</h2>
      </div>
      <p className="text-[13px] text-muted-foreground mb-4">
        Configure as permissões padrão por cargo e ajustes individuais por usuário.
      </p>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Por Cargo</TabsTrigger>
          <TabsTrigger value="users"><UserCog className="w-3.5 h-3.5 mr-1.5" />Por Usuário</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4"><RolePermissionsEditor catalog={catalog} /></TabsContent>
        <TabsContent value="users" className="mt-4"><UserPermissionsEditor catalog={catalog} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RolePermissionsEditor({ catalog }: { catalog: Cat[] }) {
  const [role, setRole] = useState<string>("vendedor");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = async (r: string) => {
    const { data } = await supabase.from("role_permissoes" as any).select("modulo,acao").eq("role", r);
    setGranted(new Set(((data as any) || []).map((x: any) => `${x.modulo}:${x.acao}`)));
  };
  useEffect(() => { load(role); }, [role]);

  const toggle = (modulo: string, acao: string, value: boolean) => {
    const key = `${modulo}:${acao}`;
    const next = new Set(granted);
    value ? next.add(key) : next.delete(key);
    setGranted(next);
  };

  const salvar = async () => {
    setSaving(true);
    try {
      await supabase.from("role_permissoes" as any).delete().eq("role", role);
      const rows = Array.from(granted).map((k) => {
        const [modulo, acao] = k.split(":");
        return { role, modulo, acao };
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("role_permissoes" as any).insert(rows);
        if (error) throw error;
      }
      toast.success("Permissões do cargo salvas");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="w-64">
          <label className="text-[12px] text-muted-foreground">Cargo</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={salvar} disabled={saving || role === "admin"}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </Button>
        {role === "admin" && (
          <span className="text-[12px] text-muted-foreground">Administrador tem acesso total e não pode ser editado.</span>
        )}
      </div>
      <MatrixEditor catalog={catalog} granted={granted} onToggle={toggle} readOnly={role === "admin"} />
    </div>
  );
}

function UserPermissionsEditor({ catalog }: { catalog: Cat[] }) {
  const [profiles, setProfiles] = useState<{ user_id: string; nome_completo: string | null }[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id,nome_completo").order("nome_completo");
      setProfiles((data as any) || []);
    })();
  }, []);

  const load = async (uid: string) => {
    if (!uid) { setGranted(new Set()); return; }
    const { data } = await supabase.from("permissoes" as any).select("modulo,acao").eq("user_id", uid);
    setGranted(new Set(((data as any) || []).map((x: any) => `${x.modulo}:${x.acao}`)));
  };
  useEffect(() => { load(userId); }, [userId]);

  const toggle = (modulo: string, acao: string, value: boolean) => {
    const key = `${modulo}:${acao}`;
    const next = new Set(granted);
    value ? next.add(key) : next.delete(key);
    setGranted(next);
  };

  const salvar = async () => {
    if (!userId) return toast.error("Selecione um usuário");
    setSaving(true);
    try {
      await supabase.from("permissoes" as any).delete().eq("user_id", userId);
      const rows = Array.from(granted).map((k) => {
        const [modulo, acao] = k.split(":");
        return { user_id: userId, modulo, acao };
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("permissoes" as any).insert(rows);
        if (error) throw error;
      }
      toast.success("Permissões individuais salvas");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="w-80">
          <label className="text-[12px] text-muted-foreground">Usuário</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || p.user_id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={salvar} disabled={saving || !userId}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Estas permissões são <b>adicionais</b> às já concedidas pelo cargo do usuário.
      </p>
      {userId && <MatrixEditor catalog={catalog} granted={granted} onToggle={toggle} />}
    </div>
  );
}

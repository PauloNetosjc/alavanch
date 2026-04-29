import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, Percent, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Regra = {
  id: string;
  role: string;
  desconto_max_perc: number;
  ativo: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  montador: "Montador",
};

export default function Administracao() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles")
        .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  useEffect(() => {
    if (isAdmin !== true) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("regras_aprovacao").select("*").order("role");
      if (error) toast.error(error.message);
      setRegras((data ?? []) as Regra[]);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (isAdmin === false) return <Navigate to="/dashboard" replace />;
  if (isAdmin === null) return <div className="text-center py-20 text-muted-foreground text-[13px]">Verificando permissões…</div>;

  const update = (id: string, patch: Partial<Regra>) =>
    setRegras((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));

  const salvar = async () => {
    setSaving(true);
    for (const r of regras) {
      const { error } = await supabase.from("regras_aprovacao")
        .update({ desconto_max_perc: r.desconto_max_perc, ativo: r.ativo })
        .eq("id", r.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success("Regras de desconto atualizadas");
  };

  return (
    <div>
      <PageHeader
        icon={Settings} iconVariant="purple"
        title="Administração"
        subtitle="Gerenciamento completo do sistema"
      />

      <div className="surface-card p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <Percent className="w-5 h-5 text-[#2D6BE5]" />
          <h2 className="text-[18px] font-semibold">Regras de Desconto</h2>
        </div>
        <p className="text-[13px] text-muted-foreground mb-5">
          Defina o limite de desconto que cada cargo pode conceder sem precisar da senha do gestor.
          Descontos acima do limite exigirão autorização de um administrador.
        </p>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-[13px]">Carregando…</div>
        ) : (
          <div className="space-y-3">
            {regras.map((r) => (
              <div key={r.id} className="flex items-center gap-4 border border-border rounded-lg px-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold">{ROLE_LABEL[r.role] || r.role}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {r.role === "admin"
                      ? "Pode autorizar descontos sem limite"
                      : "Limite máximo de desconto sem senha do gestor"}
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type="number" min={0} max={100} step={0.01}
                    value={r.desconto_max_perc}
                    onChange={(e) => update(r.id, { desconto_max_perc: Number(e.target.value) || 0 })}
                    className="w-28 pr-8 text-right"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.ativo} onCheckedChange={(v) => update(r.id, { ativo: v })} />
                  <span className="text-[12px] text-muted-foreground w-12">{r.ativo ? "Ativo" : "Inativo"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={salvar} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Loader2 } from "lucide-react";

type Modulo = {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  essencial: boolean;
  ordem: number;
};

type ModuloLoja = {
  modulo_chave: string;
  ativo: boolean;
  contratado: boolean;
  data_ativacao: string | null;
  data_desativacao: string | null;
};

export default function GestaoModulos() {
  const { user, role } = useAuth();
  const { selectedLojaId, lojas } = useLoja();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [ativacoes, setAtivacoes] = useState<Record<string, ModuloLoja>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const isAdmin = role === "admin";
  const lojaNome = lojas.find((l) => l.id === selectedLojaId)?.nome || "—";

  const load = async () => {
    if (!selectedLojaId) return;
    setLoading(true);
    const [{ data: cat }, { data: ml }] = await Promise.all([
      supabase.from("modulos_sistema" as any).select("*").order("ordem"),
      supabase.from("modulos_loja" as any).select("*").eq("loja_id", selectedLojaId),
    ]);
    setModulos((cat || []) as any);
    const map: Record<string, ModuloLoja> = {};
    ((ml || []) as any[]).forEach((r) => { map[r.modulo_chave] = r; });
    setAtivacoes(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedLojaId]);

  const isAtivo = (m: Modulo) => {
    const row = ativacoes[m.chave];
    if (row) return row.ativo;
    return m.essencial;
  };

  const toggleModulo = async (m: Modulo, novoAtivo: boolean) => {
    if (!selectedLojaId || !isAdmin) return;
    setSaving(m.chave);
    try {
      const existing = ativacoes[m.chave];
      const payload: any = {
        loja_id: selectedLojaId,
        modulo_chave: m.chave,
        ativo: novoAtivo,
        contratado: existing?.contratado ?? true,
        data_ativacao: novoAtivo ? new Date().toISOString() : existing?.data_ativacao ?? null,
        data_desativacao: novoAtivo ? null : new Date().toISOString(),
        atualizado_por: user?.id ?? null,
      };
      const { error } = await supabase
        .from("modulos_loja" as any)
        .upsert(payload, { onConflict: "loja_id,modulo_chave" });
      if (error) throw error;
      toast.success(`${m.nome} ${novoAtivo ? "ativado" : "desativado"}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(null);
    }
  };

  if (!selectedLojaId) {
    return <div className="p-6 text-sm text-muted-foreground">Selecione uma loja para gerenciar módulos.</div>;
  }

  const grupos = modulos.reduce<Record<string, Modulo[]>>((acc, m) => {
    const k = m.categoria || "outros";
    (acc[k] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display flex items-center gap-2">
          <Package className="w-5 h-5" /> Gestão de Módulos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Loja: <strong>{lojaNome}</strong> · Ative ou desative módulos contratados nesta base.
          {!isAdmin && <span className="ml-2 text-amber-600">(somente leitura — apenas administradores podem alterar)</span>}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        Object.entries(grupos).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{cat}</div>
            <div className="grid gap-2">
              {items.map((m) => {
                const ativo = isAtivo(m);
                const row = ativacoes[m.chave];
                return (
                  <Card key={m.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.nome}</span>
                        {m.essencial && <Badge variant="secondary" className="text-[10px]">Essencial</Badge>}
                        {!m.essencial && <Badge variant="outline" className="text-[10px]">Opcional</Badge>}
                      </div>
                      {m.descricao && <p className="text-xs text-muted-foreground mt-0.5">{m.descricao}</p>}
                      {row?.data_ativacao && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Ativo desde {new Date(row.data_ativacao).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {saving === m.chave && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={ativo}
                        disabled={!isAdmin || saving === m.chave}
                        onCheckedChange={(v) => toggleModulo(m, v)}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {isAdmin && (
        <div className="text-xs text-muted-foreground border-t pt-4">
          Alterações são registradas com seu usuário. Dados existentes não são apagados ao desativar um módulo.
        </div>
      )}

      <div>
        <Button variant="outline" onClick={load} disabled={loading}>Recarregar</Button>
      </div>
    </div>
  );
}

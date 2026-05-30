import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";

export type Comunicado = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  prioridade: string;
  status: string;
  exibir_popup: boolean;
  permitir_fechar: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  link_url: string | null;
  criado_por: string | null;
  created_at: string;
  anexo_tipo?: string | null;
  anexo_url?: string | null;
  anexo_nome?: string | null;
  anexo_mime?: string | null;
  anexo_tamanho_bytes?: number | null;
  anexo_texto_botao?: string | null;
};

export type Leitura = {
  id: string;
  comunicado_id: string;
  user_id: string;
  lido: boolean;
  fechado_em: string | null;
  lido_em: string | null;
};

const PRIO_ORDER: Record<string, number> = { critica: 0, alta: 1, normal: 2, baixa: 3 };

/** Carrega comunicados destinados ao usuário (base/loja atual) + leituras. */
export function useComunicadosSaaS() {
  const { user } = useAuth();
  const { selectedLojaId } = useLoja();
  const [baseClienteId, setBaseClienteId] = useState<string | null>(null);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve base_cliente_id da loja atual
  useEffect(() => {
    if (!selectedLojaId) { setBaseClienteId(null); return; }
    (async () => {
      const { data } = await supabase
        .from("lojas")
        .select("base_cliente_id" as any)
        .eq("id", selectedLojaId)
        .maybeSingle();
      setBaseClienteId((data as any)?.base_cliente_id ?? null);
    })();
  }, [selectedLojaId]);

  const reload = useCallback(async () => {
    if (!user) { setComunicados([]); setLeituras([]); setLoading(false); return; }
    setLoading(true);

    // 1) Destinatários aplicáveis
    const orParts: string[] = ["enviar_para_todas_bases.eq.true"];
    if (baseClienteId) orParts.push(`base_cliente_id.eq.${baseClienteId}`);
    if (selectedLojaId) orParts.push(`loja_id.eq.${selectedLojaId}`);
    const { data: dest } = await (supabase
      .from("comunicados_saas_destinatarios" as any) as any)
      .select("comunicado_id")
      .or(orParts.join(","));
    const ids = Array.from(new Set(((dest as any[]) || []).map((d) => d.comunicado_id))).filter(Boolean);

    if (ids.length === 0) {
      setComunicados([]); setLeituras([]); setLoading(false); return;
    }

    // 2) Comunicados publicados ativos (RLS já filtra)
    const { data: comList } = await (supabase
      .from("comunicados_saas" as any) as any)
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });

    // 3) Leituras do usuário
    const { data: leiList } = await (supabase
      .from("comunicados_saas_leituras" as any) as any)
      .select("*")
      .eq("user_id", user.id)
      .in("comunicado_id", ids);

    setComunicados((comList as any) || []);
    setLeituras((leiList as any) || []);
    setLoading(false);
  }, [user, baseClienteId, selectedLojaId]);

  useEffect(() => { reload(); }, [reload]);

  const naoLidos = comunicados.filter((c) => {
    const l = leituras.find((x) => x.comunicado_id === c.id);
    if (!l) return true;
    if (l.lido) return false;
    if (l.fechado_em && c.permitir_fechar) return false;
    return true;
  });

  const popupQueue = comunicados
    .filter((c) => c.exibir_popup)
    .filter((c) => {
      const l = leituras.find((x) => x.comunicado_id === c.id);
      if (!l) return true;
      if (l.lido) return false;
      if (l.fechado_em) return false;
      return true;
    })
    .sort((a, b) => {
      const p = (PRIO_ORDER[a.prioridade] ?? 9) - (PRIO_ORDER[b.prioridade] ?? 9);
      if (p !== 0) return p;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const registrarFechamento = async (comunicadoId: string, marcarLido: boolean) => {
    if (!user) return;
    const now = new Date().toISOString();
    const payload: any = {
      comunicado_id: comunicadoId,
      user_id: user.id,
      base_cliente_id: baseClienteId,
      loja_id: selectedLojaId,
      fechado_em: now,
    };
    if (marcarLido) { payload.lido = true; payload.lido_em = now; }
    await (supabase.from("comunicados_saas_leituras" as any) as any)
      .upsert(payload, { onConflict: "comunicado_id,user_id" });
    await reload();
  };

  return {
    comunicados,
    leituras,
    naoLidos,
    popupQueue,
    loading,
    reload,
    registrarFechamento,
    baseClienteId,
  };
}

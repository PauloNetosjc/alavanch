import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";

/**
 * Módulos opcionais: default INATIVO se não existir linha em modulos_loja.
 * Módulos essenciais (qualquer outro): default ATIVO.
 */
const MODULOS_OPCIONAIS = new Set(["fabrica", "rh", "bater_ponto", "notas_fiscais"]);

export type ModuloLojaRow = {
  modulo_chave: string;
  ativo: boolean;
  contratado: boolean;
};

export function useModulosLoja() {
  const { selectedLojaId } = useLoja();
  const [rows, setRows] = useState<ModuloLojaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedLojaId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("modulos_loja" as any)
      .select("modulo_chave, ativo, contratado")
      .eq("loja_id", selectedLojaId);
    setRows((data || []) as any);
    setLoading(false);
  }, [selectedLojaId]);

  useEffect(() => {
    load();
  }, [load]);

  const isModuloAtivo = useCallback(
    (chave: string): boolean => {
      const row = rows.find((r) => r.modulo_chave === chave);
      if (row) return !!row.ativo;
      // Default por essencialidade
      return !MODULOS_OPCIONAIS.has(chave);
    },
    [rows]
  );

  return { isModuloAtivo, rows, loading, reload: load };
}

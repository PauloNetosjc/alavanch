import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";

export type KanbanChave =
  | "crm_comercial"
  | "revisao"
  | "pos_venda"
  | "fabrica"
  | "montagem"
  | "entrega"
  | "tarefas";

export type KanbanDef = {
  chave: KanbanChave;
  nome: string;
  descricao: string;
  /** Rotas afetadas (para o guard) */
  rotas: string[];
};

/** Catálogo central dos kanbans configuráveis no sistema. */
export const KANBANS_CATALOGO: KanbanDef[] = [
  {
    chave: "crm_comercial",
    nome: "CRM Comercial",
    descricao: "Funil comercial com leads, propostas e fechamento.",
    rotas: ["/kanban-comercial", "/kanbans"],
  },
  {
    chave: "revisao",
    nome: "Kanban de Revisão",
    descricao: "Revisão técnica do projeto antes da liberação.",
    rotas: ["/kanban-revisao"],
  },
  {
    chave: "fabrica",
    nome: "Kanban de Fábrica",
    descricao: "Acompanhamento de produção na fábrica.",
    rotas: ["/kanban-fabrica"],
  },
  {
    chave: "montagem",
    nome: "Kanban de Montagem",
    descricao: "Acompanhamento da montagem em campo.",
    rotas: ["/kanban-montagem"],
  },
  {
    chave: "pos_venda",
    nome: "Kanban de Pós-Venda",
    descricao: "Fluxo de pós-venda e assistência.",
    rotas: ["/kanban-pos-venda"],
  },
  {
    chave: "entrega",
    nome: "Kanban de Entrega",
    descricao: "Programação e acompanhamento de entregas.",
    rotas: [],
  },
  {
    chave: "tarefas",
    nome: "Kanban de Tarefas",
    descricao: "Painel geral de tarefas operacionais.",
    rotas: [],
  },
];

/** Default — usado quando ainda não há registro para a loja. */
export const KANBAN_DEFAULT_ATIVO: Record<KanbanChave, boolean> = {
  crm_comercial: true,
  revisao: true,
  fabrica: true,
  montagem: true,
  pos_venda: true,
  entrega: true,
  tarefas: true,
};

type Row = {
  chave_kanban: string;
  ativo: boolean;
  loja_id: string | null;
};

export function useKanbansVisibilidade() {
  const { selectedLojaId } = useLoja();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["configuracoes_kanbans", selectedLojaId || "global"],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from("configuracoes_kanbans" as any).select("chave_kanban, ativo, loja_id");
      if (selectedLojaId) {
        q = q.or(`loja_id.eq.${selectedLojaId},loja_id.is.null`);
      } else {
        q = q.is("loja_id", null);
      }
      const { data } = await q;
      return ((data as unknown) as Row[]) || [];
    },
  });

  /** Mapa final: registro de loja > registro global > default. */
  const map = (() => {
    const m: Record<string, boolean> = { ...KANBAN_DEFAULT_ATIVO };
    // primeiro aplica globais (loja_id null), depois sobrescreve com da loja
    data
      .filter((r) => r.loja_id === null)
      .forEach((r) => { m[r.chave_kanban] = r.ativo; });
    if (selectedLojaId) {
      data
        .filter((r) => r.loja_id === selectedLojaId)
        .forEach((r) => { m[r.chave_kanban] = r.ativo; });
    }
    return m;
  })();

  function isAtivo(chave: KanbanChave | string): boolean {
    if (!(chave in map)) return true;
    return map[chave] !== false;
  }

  function isRotaAtiva(pathname: string): boolean {
    const def = KANBANS_CATALOGO.find((k) => k.rotas.some((r) => pathname.startsWith(r)));
    if (!def) return true;
    return isAtivo(def.chave);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["configuracoes_kanbans"] });
  }

  return { isAtivo, isRotaAtiva, map, loading: isLoading, invalidate };
}

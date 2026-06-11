import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Calendar, FileText, ListChecks } from "lucide-react";

type Item = {
  id: string;
  origem: "chamado" | "tarefa";
  titulo: string;
  subtitulo?: string | null;
  prazo: string; // YYYY-MM-DD
  status?: string | null;
  link?: string;
};

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay(); // 0=Dom..6=Sab
  const diff = dow === 0 ? -6 : 1 - dow; // segunda-feira
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function PlanejamentoSemanalChamados() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const out: Item[] = [];

      // Chamados/assistências
      let qC = supabase
        .from("assistencias")
        .select("id, codigo, status, data_limite, data_agendamento, tecnico_id, cliente:clientes(nome)")
        .neq("status", "concluida")
        .eq("arquivada", false);
      if (!isAdmin) qC = qC.eq("tecnico_id", user.id);
      const { data: chams } = await qC;
      (chams || []).forEach((c: any) => {
        const prazo = c.data_limite || c.data_agendamento;
        if (!prazo) return;
        out.push({
          id: c.id,
          origem: "chamado",
          titulo: `Chamado ${c.codigo || ""}`.trim(),
          subtitulo: c.cliente?.nome || null,
          prazo,
          status: c.status,
          link: `/meus-chamados/${c.id}`,
        });
      });

      // Tarefas (nativas e manuais)
      try {
        let qT = supabase
          .from("tarefas_pedido" as any)
          .select("id, titulo, prazo, status, responsavel_id, pedido_id, pedidos:pedidos(codigo)")
          .neq("status", "concluida");
        if (!isAdmin) qT = qT.eq("responsavel_id", user.id);
        const { data: tars } = await qT;
        (tars || []).forEach((t: any) => {
          if (!t.prazo) return;
          out.push({
            id: t.id,
            origem: "tarefa",
            titulo: t.titulo || "Tarefa",
            subtitulo: t.pedidos?.codigo ? `Pedido ${t.pedidos.codigo}` : null,
            prazo: String(t.prazo).slice(0, 10),
            status: t.status,
            link: t.pedido_id ? `/pedidos/${t.pedido_id}` : undefined,
          });
        });
      } catch {
        /* tabela pode não existir em todas as instâncias */
      }

      setItens(out);
      setLoading(false);
    })();
  }, [user, isAdmin]);

  const colunas = useMemo(() => {
    const hoje = new Date();
    const hojeStr = isoDate(hoje);
    const inicio = startOfWeek(hoje);
    const dias = Array.from({ length: 6 }, (_, i) => addDays(inicio, i));
    const cols: { key: string; label: string; data: string | null; items: Item[] }[] = [
      { key: "atrasados", label: "ATRASADOS", data: null, items: [] },
      ...dias.map((d, i) => ({
        key: `d${i}`,
        label: `${DIAS[i]} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        data: isoDate(d),
        items: [] as Item[],
      })),
    ];
    itens.forEach((it) => {
      if (it.prazo < hojeStr) {
        cols[0].items.push(it);
        return;
      }
      const idx = cols.findIndex((c) => c.data === it.prazo);
      if (idx > 0) cols[idx].items.push(it);
    });
    return cols;
  }, [itens]);

  const card = (it: Item) => (
    <button
      key={`${it.origem}-${it.id}`}
      onClick={() => it.link && navigate(it.link)}
      className="w-full text-left border border-border rounded-md p-2.5 bg-card hover:shadow-sm hover:bg-muted/30 transition"
    >
      <div className="flex items-center gap-1.5 mb-1">
        {it.origem === "chamado" ? (
          <FileText className="w-3 h-3 text-purple-600" />
        ) : (
          <ListChecks className="w-3 h-3 text-emerald-600" />
        )}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {it.origem}
        </span>
      </div>
      <div className="text-[12px] font-semibold leading-tight">{it.titulo}</div>
      {it.subtitulo && (
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{it.subtitulo}</div>
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="surface-card p-8 text-center text-[12px] text-muted-foreground">
        Carregando planejamento…
      </div>
    );
  }

  return (
    <div>
      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-7 gap-3">
        {colunas.map((col) => (
          <div key={col.key} className="surface-card p-3 min-h-[400px]">
            <div className="flex items-center gap-1.5 mb-3">
              {col.key === "atrasados" ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              ) : (
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <div
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  col.key === "atrasados" ? "text-red-600" : ""
                }`}
              >
                {col.label}
              </div>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {col.items.length}
              </span>
            </div>
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/60 text-center py-4">—</div>
              ) : (
                col.items.map(card)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">
        <Tabs defaultValue="atrasados">
          <TabsList className="w-full overflow-x-auto justify-start">
            {colunas.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="text-[11px]">
                {c.label} ({c.items.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {colunas.map((col) => (
            <TabsContent key={col.key} value={col.key} className="space-y-2">
              {col.items.length === 0 ? (
                <div className="text-[12px] text-muted-foreground text-center py-6">
                  Nenhum item.
                </div>
              ) : (
                col.items.map(card)
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

export default PlanejamentoSemanalChamados;

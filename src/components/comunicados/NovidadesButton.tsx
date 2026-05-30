import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useComunicadosSaaS, type Comunicado } from "@/hooks/useComunicadosSaaS";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { AnexoView, anexoIcon } from "./AnexoView";

const tipoLabel: Record<string, string> = {
  novidade: "Novidade", aviso: "Aviso", manutencao: "Manutenção", financeiro: "Financeiro",
  treinamento: "Treinamento", sistema: "Sistema", urgente: "Urgente", outro: "Outro",
};
const prioColor: Record<string, string> = {
  critica: "bg-red-100 text-red-800",
  alta: "bg-amber-100 text-amber-800",
  normal: "bg-blue-100 text-blue-800",
  baixa: "bg-zinc-100 text-zinc-700",
};

export function NovidadesButton() {
  const { comunicados, leituras, naoLidos, registrarFechamento, loading } = useComunicadosSaaS();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"todos" | "nao_lidos" | "lidos" | "urgentes">("todos");
  const [selected, setSelected] = useState<Comunicado | null>(null);

  const list = comunicados.filter((c) => {
    const l = leituras.find((x) => x.comunicado_id === c.id);
    const lido = l?.lido || (l?.fechado_em && c.permitir_fechar);
    if (filter === "nao_lidos") return !lido;
    if (filter === "lidos") return !!lido;
    if (filter === "urgentes") return c.prioridade === "critica" || c.prioridade === "alta" || c.tipo === "urgente";
    return true;
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Novidades"
        aria-label="Novidades"
        className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <Megaphone className="w-[18px] h-[18px]" />
        {naoLidos.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-medium flex items-center justify-center">
            {naoLidos.length > 99 ? "99+" : naoLidos.length}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="font-display flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Novidades e Comunicados
            </SheetTitle>
          </SheetHeader>

          <div className="px-5 pt-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="w-full grid grid-cols-4 h-8">
                <TabsTrigger value="todos" className="text-[11px]">Todos</TabsTrigger>
                <TabsTrigger value="nao_lidos" className="text-[11px]">Não lidos</TabsTrigger>
                <TabsTrigger value="lidos" className="text-[11px]">Lidos</TabsTrigger>
                <TabsTrigger value="urgentes" className="text-[11px]">Urgentes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
            {loading && <div className="text-center text-[12px] text-muted-foreground py-8">Carregando…</div>}
            {!loading && list.length === 0 && (
              <div className="text-center text-[12px] text-muted-foreground py-8">Nenhum comunicado.</div>
            )}
            {list.map((c) => {
              const l = leituras.find((x) => x.comunicado_id === c.id);
              const lido = !!(l?.lido || (l?.fechado_em && c.permitir_fechar));
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full text-left rounded-md border p-3 hover:bg-secondary/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-medium truncate">{c.titulo}</div>
                    {!lido && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[9px] py-0">{tipoLabel[c.tipo] || c.tipo}</Badge>
                    <Badge className={`${prioColor[c.prioridade] || ""} border-0 text-[9px] py-0 capitalize`}>
                      {c.prioridade}
                    </Badge>
                    {c.anexo_tipo && c.anexo_tipo !== "nenhum" && (
                      <span className="inline-flex items-center text-muted-foreground" title={c.anexo_tipo}>
                        {anexoIcon(c.anexo_tipo)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground line-clamp-2 mt-1">{c.mensagem}</div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="border-t bg-card p-5 max-h-[55%] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px]">{tipoLabel[selected.tipo] || selected.tipo}</Badge>
                <Badge className={`${prioColor[selected.prioridade] || ""} border-0 capitalize text-[10px]`}>
                  {selected.prioridade}
                </Badge>
                <button className="ml-auto text-[11px] text-muted-foreground" onClick={() => setSelected(null)}>fechar</button>
              </div>
              <h3 className="text-[15px] font-display mb-1">{selected.titulo}</h3>
              <div className="text-[11px] text-muted-foreground mb-2">
                {new Date(selected.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">{selected.mensagem}</div>
              <AnexoView c={selected} />
              {selected.link_url && (
                <a href={selected.link_url} target="_blank" rel="noreferrer" className="block mt-2 text-[12px] text-primary underline">
                  Saiba mais →
                </a>
              )}
              <div className="flex justify-end pt-3">
                <Button
                  size="sm"
                  onClick={async () => { await registrarFechamento(selected.id, true); setSelected(null); }}
                >
                  Marcar como lido
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

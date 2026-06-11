import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Split, Clock, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Ambiente = { id: string; nome: string };
type Props = {
  pedidoId: string;
  codigoPedido: string;
  lojaId: string | null;
  ambientes: Ambiente[];
};

type Desm = {
  id: string;
  pedido_id_original: string;
  codigo_parcial: string;
  status_operacional: string;
  etapa_atual: string | null;
  observacao: string | null;
  created_at: string;
};

type Aut = {
  id: string;
  status: string;
  titulo: string;
  contexto: any;
  motivo_solicitacao: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  decidido_em: string | null;
};

export default function DesmembramentosPanel({ pedidoId, codigoPedido, lojaId, ambientes }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const desmAberto = searchParams.get("desmembramento");

  const [desms, setDesms] = useState<Desm[]>([]);
  const [pendentes, setPendentes] = useState<Aut[]>([]);
  const [open, setOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Mapa ambiente_id -> desmembramento_id (já desmembrado e aprovado)
  const [ambJaDesm, setAmbJaDesm] = useState<Record<string, string>>({});

  const carregar = async () => {
    const [d, p, itens] = await Promise.all([
      supabase
        .from("pedido_desmembramentos" as any)
        .select("*")
        .eq("pedido_id_original", pedidoId)
        .order("created_at", { ascending: true }),
      supabase
        .from("autorizacoes" as any)
        .select("*")
        .eq("origem_modulo", "desmembramento")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pedido_desmembramento_itens" as any)
        .select("desmembramento_id, ambiente_id")
        .eq("pedido_id_original", pedidoId),
    ]);
    setDesms(((d.data as any) || []) as Desm[]);
    setPendentes(((p.data as any) || []) as Aut[]);
    const map: Record<string, string> = {};
    (itens.data as any[] | null)?.forEach((it) => {
      if (it.ambiente_id) map[it.ambiente_id] = it.desmembramento_id;
    });
    setAmbJaDesm(map);
  };

  useEffect(() => {
    carregar();
  }, [pedidoId]);

  const ambientesPendentes = pendentes
    .filter((p) => p.status === "pendente")
    .flatMap((p) => (p.contexto?.ambiente_ids || []) as string[]);

  const disponiveis = ambientes.filter(
    (a) => !ambJaDesm[a.id] && !ambientesPendentes.includes(a.id)
  );

  const abrirSolicitacao = () => {
    if (disponiveis.length === 0) {
      toast.error("Nenhum ambiente disponível para desmembramento");
      return;
    }
    setSelecionados({});
    setMotivo("");
    setOpen(true);
  };

  const enviar = async () => {
    const ids = Object.keys(selecionados).filter((k) => selecionados[k]);
    if (ids.length === 0) {
      toast.error("Selecione ao menos um ambiente");
      return;
    }
    setSalvando(true);
    try {
      const nomes = ambientes.filter((a) => ids.includes(a.id)).map((a) => a.nome);
      const { error } = await supabase.from("autorizacoes" as any).insert({
        tipo: "outro",
        categoria: "outro",
        status: "pendente",
        titulo: `Desmembramento operacional — ${codigoPedido}`,
        descricao: `Solicitação para desmembrar ${ids.length} ambiente(s) em PARC.`,
        contexto: {
          ambiente_ids: ids,
          ambiente_nomes: nomes,
          codigo_pedido: codigoPedido,
        },
        loja_id: lojaId,
        pedido_id: pedidoId,
        origem_modulo: "desmembramento",
        motivo_solicitacao: motivo || null,
        solicitante_id: user?.id || null,
        solicitante_email: user?.email || null,
      });
      if (error) throw error;
      toast.success("Solicitação enviada para Autorizações");
      setOpen(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Erro ao solicitar desmembramento");
    } finally {
      setSalvando(false);
    }
  };

  const abrirParc = (id: string) => {
    navigate(`/pedidos/${pedidoId}?desmembramento=${id}`);
  };

  const pendentesList = pendentes.filter((p) => p.status === "pendente");

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-purple-600" />
          <h3 className="text-[15px] font-bold">Desmembramentos operacionais (PARC)</h3>
        </div>
        <Button size="sm" onClick={abrirSolicitacao}>
          <Split className="w-3.5 h-3.5 mr-1.5" />
          Solicitar desmembramento de ambiente
        </Button>
      </div>

      <div className="text-[12px] text-muted-foreground">
        O PARC é uma separação <strong>operacional</strong> (arquivos, tarefas, agenda, fábrica, montagem).
        Não altera contrato, parcelas, comissões nem o financeiro do pedido original.
      </div>

      {pendentesList.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">
            Aguardando aprovação
          </div>
          {pendentesList.map((p) => (
            <div
              key={p.id}
              className="border border-amber-300 bg-amber-50 rounded-md p-3 text-[12px] flex items-start gap-2"
            >
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900">{p.titulo}</div>
                <div className="text-amber-800 mt-0.5">
                  Ambientes: {(p.contexto?.ambiente_nomes || []).join(", ") || "—"}
                </div>
                {p.motivo_solicitacao && (
                  <div className="italic text-amber-800 mt-0.5">Motivo: {p.motivo_solicitacao}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {desms.length === 0 ? (
        <div className="text-[12px] text-muted-foreground text-center py-4 border border-dashed rounded-md">
          Nenhum PARC criado para este pedido.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            PARCs criados ({desms.length})
          </div>
          {desms.map((d) => {
            const ambs = Object.entries(ambJaDesm)
              .filter(([_, dId]) => dId === d.id)
              .map(([ambId]) => ambientes.find((a) => a.id === ambId)?.nome)
              .filter(Boolean);
            const ativo = desmAberto === d.id;
            return (
              <div
                key={d.id}
                className={`border rounded-md p-3 flex items-center gap-3 ${
                  ativo ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold">{d.codigo_parcial}</span>
                    <Badge variant="outline" className="text-[10px]">PARC</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {d.etapa_atual || d.status_operacional || "venda_futura"}
                    </Badge>
                    {ativo && <Badge className="text-[10px]">aberto</Badge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1">
                    {ambs.length > 0 ? ambs.join(", ") : "Sem ambientes vinculados"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrirParc(d.id)}>
                  Abrir PARC
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar desmembramento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-[12px] text-muted-foreground">
              Selecione os ambientes que devem virar um PARC. A criação só ocorre após aprovação em
              Autorizações.
            </div>
            <div className="border rounded-md divide-y max-h-[300px] overflow-auto">
              {disponiveis.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Nenhum ambiente disponível.
                </div>
              ) : (
                disponiveis.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/40 text-[13px]"
                  >
                    <Checkbox
                      checked={!!selecionados[a.id]}
                      onCheckedChange={(v) =>
                        setSelecionados((prev) => ({ ...prev, [a.id]: !!v }))
                      }
                    />
                    <span>{a.nome}</span>
                  </label>
                ))
              )}
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground">Motivo / observação</label>
              <Textarea
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: cliente solicitou separar a cozinha para entrega futura."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={salvando}>
              {salvando ? "Enviando…" : "Enviar para aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

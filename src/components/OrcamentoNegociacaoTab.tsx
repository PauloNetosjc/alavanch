import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calculator, History, FilePlus2, ArrowRight, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

type Negociacao = {
  id: string;
  orcamento_id: string;
  versao: number;
  status: string;
  valor_bruto: number;
  percentual_desconto_manual: number;
  valor_desconto_manual: number;
  percentual_desconto_forma_pagamento: number;
  valor_desconto_forma_pagamento: number;
  valor_apos_desconto_forma_pagamento: number;
  valor_entrada: number;
  percentual_desconto_entrada: number;
  valor_desconto_entrada: number;
  valor_final_negociado: number;
  saldo_a_parcelar: number;
  quantidade_parcelas: number;
  valor_parcela: number;
  observacoes: string | null;
  criado_por: string | null;
  forma_pagamento_id: string | null;
  forma_pagamento_entrada_id: string | null;
  created_at: string;
  updated_at: string;
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

const STATUS_COLOR: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-800 border-emerald-200",
  aprovada: "bg-blue-100 text-blue-800 border-blue-200",
  substituida: "bg-muted text-muted-foreground border-border",
  rejeitada: "bg-rose-100 text-rose-800 border-rose-200",
  cancelada: "bg-rose-100 text-rose-800 border-rose-200",
  rascunho: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function OrcamentoNegociacaoTab({
  orcamentoId,
  onNovaVersao,
}: {
  orcamentoId: string;
  onNovaVersao?: () => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [versoes, setVersoes] = useState<Negociacao[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [openHistorico, setOpenHistorico] = useState(false);
  const [verVersaoId, setVerVersaoId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orcamento_negociacoes" as any)
      .select("*")
      .eq("orcamento_id", orcamentoId)
      .order("versao", { ascending: false });
    const list = (data || []) as unknown as Negociacao[];
    setVersoes(list);
    const ids = Array.from(new Set(list.map((v) => v.criado_por).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.user_id] = p.nome_completo || ""));
      setUsuariosMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orcamentoId]);

  if (loading) {
    return (
      <div className="surface-card p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando negociação…
      </div>
    );
  }

  const ativa = versoes.find((v) => v.status === "ativa") || versoes[0];

  if (!ativa) {
    return (
      <div className="surface-card p-10 text-center text-muted-foreground">
        Nenhuma negociação registrada ainda para este orçamento.
      </div>
    );
  }

  const criarNovaVersao = async (base: Negociacao, motivo: string) => {
    const { error: e1 } = await supabase
      .from("orcamento_negociacoes" as any)
      .update({ status: "substituida" })
      .eq("orcamento_id", orcamentoId)
      .eq("status", "ativa");
    if (e1) {
      toast.error(e1.message);
      return false;
    }

    const { data: u } = await supabase.auth.getUser();
    const proxVer = (versoes[0]?.versao || 0) + 1;
    const novo: any = { ...base };
    delete novo.id;
    delete novo.created_at;
    delete novo.updated_at;
    novo.versao = proxVer;
    novo.status = "ativa";
    novo.criado_por = u.user?.id || null;
    novo.observacoes = motivo;

    const { error: e2 } = await supabase.from("orcamento_negociacoes" as any).insert(novo);
    if (e2) {
      toast.error(e2.message);
      return false;
    }
    toast.success(`Versão ${proxVer} criada — ajuste os ambientes em 02 Ambientes`);
    return true;
  };

  const novaVersao = async () => {
    const ok = await criarNovaVersao(ativa, `Nova versão criada a partir da v${ativa.versao}`);
    if (ok) {
      setOpenHistorico(false);
      setVerVersaoId(null);
      if (onNovaVersao) onNovaVersao();
      else load();
    }
  };

  const usarComoBase = async (v: Negociacao) => {
    const ok = await criarNovaVersao(
      v,
      `Nova versão criada usando v${v.versao} como base`
    );
    if (ok) {
      setOpenHistorico(false);
      setVerVersaoId(null);
      if (onNovaVersao) onNovaVersao();
      else load();
    }
  };

  const renegociar = () => navigate(`/comercial/${orcamentoId}/negociacao`);

  const versaoVisualizada =
    (verVersaoId && versoes.find((v) => v.id === verVersaoId)) || ativa;
  const isHistorica = versaoVisualizada.id !== ativa.id;

  return (
    <div className="space-y-5">
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-semibold">
                {isHistorica ? "Versão histórica" : "Negociação atual"}
              </h2>
              <Badge variant="outline" className={STATUS_COLOR[versaoVisualizada.status] || ""}>
                {versaoVisualizada.status}
              </Badge>
              <Badge variant="outline">v{versaoVisualizada.versao}</Badge>
              {isHistorica && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                  somente leitura
                </Badge>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              {fmtDate(versaoVisualizada.created_at)}
              {versaoVisualizada.criado_por && usuariosMap[versaoVisualizada.criado_por] && (
                <> · por <b>{usuariosMap[versaoVisualizada.criado_por]}</b></>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOpenHistorico(true)}>
              <History className="w-4 h-4 mr-1.5" /> Ver histórico
            </Button>
            {isHistorica ? (
              <>
                <Button variant="outline" onClick={() => setVerVersaoId(null)}>
                  Voltar para versão ativa
                </Button>
                <Button onClick={() => usarComoBase(versaoVisualizada)} className="bg-emerald-600 hover:bg-emerald-700">
                  <FilePlus2 className="w-4 h-4 mr-1.5" /> Usar esta versão como base
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={novaVersao}>
                  <FilePlus2 className="w-4 h-4 mr-1.5" /> Gerar nova versão
                </Button>
                <Button onClick={renegociar} className="bg-emerald-600 hover:bg-emerald-700">
                  <Calculator className="w-4 h-4 mr-1.5" /> Abrir para renegociar
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[14px]">
          <Linha label="Valor bruto original" value={fmtBrl(versaoVisualizada.valor_bruto)} />
          <Linha
            label={`Desconto manual (${(versaoVisualizada.percentual_desconto_manual || 0).toFixed(2)}%)`}
            value={`- ${fmtBrl(versaoVisualizada.valor_desconto_manual)}`}
            color="text-rose-700"
          />
          <Linha
            label={`Desconto forma pagamento (${(versaoVisualizada.percentual_desconto_forma_pagamento || 0).toFixed(2)}%)`}
            value={`- ${fmtBrl(versaoVisualizada.valor_desconto_forma_pagamento)}`}
            color="text-rose-700"
          />
          <Linha
            label="Valor após desconto da forma pag."
            value={fmtBrl(versaoVisualizada.valor_apos_desconto_forma_pagamento)}
          />
          <Linha label="Entrada" value={fmtBrl(versaoVisualizada.valor_entrada)} />
          <Linha
            label={`Desconto da entrada (${(versaoVisualizada.percentual_desconto_entrada || 0).toFixed(2)}%)`}
            value={`- ${fmtBrl(versaoVisualizada.valor_desconto_entrada)}`}
            color="text-rose-700"
          />
          <Linha
            label="Valor final negociado"
            value={fmtBrl(versaoVisualizada.valor_final_negociado)}
            strong
          />
          <Linha label="Saldo a parcelar" value={fmtBrl(versaoVisualizada.saldo_a_parcelar)} strong />
          <Linha
            label="Parcelamento"
            value={`${versaoVisualizada.quantidade_parcelas}x de ${fmtBrl(versaoVisualizada.valor_parcela)}`}
          />
        </div>

        {versaoVisualizada.observacoes && (
          <div className="mt-5 text-[12px] text-muted-foreground border-t border-border pt-3">
            <b>Observações:</b> {versaoVisualizada.observacoes}
          </div>
        )}
      </div>

      <Dialog open={openHistorico} onOpenChange={setOpenHistorico}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de negociações</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Versão</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Usuário</th>
                  <th className="text-right py-2">Desconto total</th>
                  <th className="text-right py-2">Valor final</th>
                  <th className="text-right py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {versoes.map((v) => {
                  const descTotal =
                    (v.valor_desconto_manual || 0) +
                    (v.valor_desconto_forma_pagamento || 0) +
                    (v.valor_desconto_entrada || 0);
                  const ehAtiva = v.id === ativa.id;
                  return (
                    <tr key={v.id} className="border-b border-border">
                      <td className="py-2">v{v.versao}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={STATUS_COLOR[v.status] || ""}>
                          {v.status}
                        </Badge>
                      </td>
                      <td className="py-2">{fmtDate(v.created_at)}</td>
                      <td className="py-2">{(v.criado_por && usuariosMap[v.criado_por]) || "—"}</td>
                      <td className="py-2 text-right text-rose-700">- {fmtBrl(descTotal)}</td>
                      <td className="py-2 text-right font-semibold">
                        {fmtBrl(v.valor_final_negociado)}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setVerVersaoId(ehAtiva ? null : v.id);
                              setOpenHistorico(false);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> {ehAtiva ? "Abrir" : "Visualizar"}
                          </Button>
                          {!ehAtiva && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => usarComoBase(v)}
                              title="Usar esta versão como base para nova negociação"
                            >
                              <FilePlus2 className="w-3.5 h-3.5 mr-1" /> Usar como base
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Linha({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={[
          "text-mono",
          strong ? "font-semibold text-foreground" : "",
          color || "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

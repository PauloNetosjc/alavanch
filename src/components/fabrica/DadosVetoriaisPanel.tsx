import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cpu, Play, AlertTriangle } from "lucide-react";
import { processarPlanoCorteVetorial, ResultadoPlanoCorte } from "@/lib/fabrica/planoCorteParser";
import { toast } from "sonner";

interface Props {
  importacaoId: string | null;
  compact?: boolean;
}

interface Resumo {
  total: number;
  vinculadas: number;
  semPosicao: number;
  sobras: number;
  divergentes: number;
}

export function DadosVetoriaisPanel({ importacaoId, compact }: Props) {
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resumo, setResumo] = useState<Resumo>({ total: 0, vinculadas: 0, semPosicao: 0, sobras: 0, divergentes: 0 });
  const [alertas, setAlertas] = useState<string[]>([]);

  async function carregar() {
    if (!importacaoId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("fabrica_plano_corte_pecas")
      .select("id,status_item,tipo_item,posicao_x,posicao_y")
      .eq("importacao_id", importacaoId);
    const arr = (data as any[]) || [];
    setResumo({
      total: arr.length,
      vinculadas: arr.filter((p) => p.status_item === "vinculado").length,
      semPosicao: arr.filter((p) => p.posicao_x == null || p.posicao_y == null).length,
      sobras: arr.filter((p) => p.tipo_item === "sobra" || p.tipo_item === "retalho").length,
      divergentes: arr.filter((p) => p.status_item === "divergente").length,
    });
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [importacaoId]);

  async function processar() {
    if (!importacaoId) return;
    setProcessando(true);
    try {
      const r: ResultadoPlanoCorte = await processarPlanoCorteVetorial(importacaoId);
      setAlertas(r.alertas);
      if (r.totalPecasCriadas === 0) {
        toast.warning("Nenhuma peça vetorial extraída desta importação.");
      } else {
        toast.success(`${r.totalPecasCriadas} peças vetoriais processadas (${r.totalVinculadas} vinculadas).`);
      }
      await carregar();
    } catch (e: any) {
      toast.error("Falha no processamento: " + (e?.message || e));
    } finally {
      setProcessando(false);
    }
  }

  if (!importacaoId) {
    return <div className="text-xs text-muted-foreground">Selecione uma importação técnica.</div>;
  }

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">Dados vetoriais do plano de corte</div>
        </div>
        <Button size="sm" onClick={processar} disabled={processando}>
          {processando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
          Processar dados vetoriais
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <div className={`grid ${compact ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-5"} gap-2`}>
          <Stat label="Peças vetoriais" value={resumo.total} />
          <Stat label="Vinculadas a etiquetas" value={resumo.vinculadas} accent="green" />
          <Stat label="Sem posição" value={resumo.semPosicao} accent="amber" />
          <Stat label="Sobras/retalhos" value={resumo.sobras} />
          <Stat label="Divergências" value={resumo.divergentes} accent={resumo.divergentes > 0 ? "red" : undefined} />
        </div>
      )}

      {alertas.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-md p-2 text-xs text-amber-800 space-y-1 max-h-32 overflow-y-auto">
          <div className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3 w-3" /> Alertas do processamento</div>
          {alertas.slice(0, 20).map((a, i) => <div key={i}>• {a}</div>)}
          {alertas.length > 20 && <div className="text-muted-foreground">... +{alertas.length - 20} alertas</div>}
        </div>
      )}

      {resumo.total === 0 && !loading && (
        <div className="text-xs text-muted-foreground">
          Nenhum dado vetorial ainda. Clique em <strong>Processar dados vetoriais</strong> para extrair posições das peças a partir dos arquivos técnicos (.cyc) e etiquetas catalogadas.
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "green" | "amber" | "red" }) {
  const cls =
    accent === "green" ? "text-green-700" :
    accent === "amber" ? "text-amber-700" :
    accent === "red" ? "text-red-700" : "";
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

/** Renders the vector table for a given importacao / optional chapa filter. */
export function DadosVetoriaisTabela({ importacaoId, chapaId }: { importacaoId: string | null; chapaId?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [chapasMap, setChapasMap] = useState<Record<string, string>>({});
  const [etiqMap, setEtiqMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!importacaoId) { setRows([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      let q = (supabase as any)
        .from("fabrica_plano_corte_pecas")
        .select("*")
        .eq("importacao_id", importacaoId)
        .order("chapa_id")
        .order("indice_peca", { nullsFirst: false });
      if (chapaId) q = q.eq("chapa_id", chapaId);
      const { data } = await q;
      setRows((data as any[]) || []);

      const [{ data: chapas }, { data: etiqs }] = await Promise.all([
        (supabase as any).from("fabrica_chapas_lote").select("id, numero_chapa").eq("importacao_id", importacaoId),
        (supabase as any).from("fabrica_etiquetas").select("id, codigo_etiqueta_completo").eq("importacao_id", importacaoId),
      ]);
      const cm: Record<string, string> = {};
      (chapas as any[] || []).forEach((c) => { cm[c.id] = c.numero_chapa || c.id.slice(0, 6); });
      const em: Record<string, string> = {};
      (etiqs as any[] || []).forEach((e) => { em[e.id] = e.codigo_etiqueta_completo || ""; });
      setChapasMap(cm);
      setEtiqMap(em);
      setLoading(false);
    })();
  }, [importacaoId, chapaId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (rows.length === 0) {
    return (
      <Card className="p-4 text-xs text-muted-foreground text-center">
        Nenhum dado vetorial processado. Use <strong>Processar dados vetoriais</strong> na aba Técnico.
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 sticky top-0 text-left">
            <tr>
              <th className="p-2">Chapa</th>
              <th className="p-2">Idx</th>
              <th className="p-2">Código</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Medida</th>
              <th className="p-2">Posição X/Y</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Etiqueta</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const semPos = r.posicao_x == null || r.posicao_y == null;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{chapasMap[r.chapa_id] || "—"}</td>
                  <td className="p-2">{r.indice_peca ?? "—"}</td>
                  <td className="p-2 font-mono">{r.codigo_peca || "—"}</td>
                  <td className="p-2 truncate max-w-[200px]">{r.descricao || "—"}</td>
                  <td className="p-2">{r.largura && r.altura ? `${r.largura}×${r.altura}` : "—"}</td>
                  <td className="p-2">
                    {semPos ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Sem coordenada</Badge>
                    ) : (
                      <span className="font-mono">{Number(r.posicao_x).toFixed(0)}, {Number(r.posicao_y).toFixed(0)}</span>
                    )}
                  </td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.tipo_item}</Badge></td>
                  <td className="p-2 font-mono text-[10px] truncate max-w-[120px]">{r.etiqueta_id ? etiqMap[r.etiqueta_id] || "—" : "—"}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={`text-[10px] ${
                      r.status_item === "vinculado" ? "bg-green-50 text-green-700 border-green-200" :
                      r.status_item === "divergente" ? "bg-red-50 text-red-700 border-red-200" :
                      r.status_item === "ignorado" ? "bg-slate-50 text-slate-600 border-slate-200" : ""
                    }`}>{r.status_item}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

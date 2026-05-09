import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Calendar, Save, FileText, Printer, X, Star, AlertTriangle,
  Clock, Factory, Truck, Wrench, CheckCircle2, MoreVertical, Plus, Upload,
  Folder, Send, Copy, Trash2, ChevronDown, ChevronUp, FileUp, Sparkles, PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { parsePromobTxt } from "@/lib/promobParser";
import { diffPromobItems, type DiffResult } from "@/lib/promobDiff";
import { ItensAvulsosManager } from "@/components/ItensAvulsosManager";
import { AgendaEventoDialog } from "@/components/agenda/AgendaEventoDialog";

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/* ============================================================== */
/*                       WORKFLOW STAGES                          */
/* ============================================================== */
const WF_STAGES = [
  { key: "medicao", label: "MEDIÇÃO", icon: Calendar, color: "#7C3AED" },
  { key: "revisao", label: "REVISÃO", icon: CheckCircle2, color: "#7C3AED" },
  { key: "fabrica", label: "FABRICAÇÃO", icon: Factory, color: "#7C3AED" },
  { key: "entrega", label: "ENTREGA", icon: Truck, color: "#94a3b8" },
  { key: "montagem", label: "MONTAGEM", icon: Wrench, color: "#94a3b8" },
  { key: "concluido", label: "CONCLUÍDO", icon: CheckCircle2, color: "#94a3b8" },
] as const;

/* ============================================================== */
/*                      MAIN PAGE                                 */
/* ============================================================== */
export default function PedidoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState<any>(null);
  const [orcamento, setOrcamento] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [contrato, setContrato] = useState<any>(null);
  const [pastas, setPastas] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [chat, setChat] = useState<any[]>([]);
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [pedidoPai, setPedidoPai] = useState<any>(null);
  const [adendos, setAdendos] = useState<any[]>([]);
  const [criandoAdendo, setCriandoAdendo] = useState(false);

  const totalProjeto = useMemo(
    () => ambientes.reduce((s, a) => s + Number(a.preco_sugerido || 0), 0),
    [ambientes],
  );

  const carregar = async () => {
    if (!id) return;
    const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
    if (!ped) { setLoading(false); return; }
    setPedido(ped);
    if (ped.orcamento_id) {
      const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", ped.orcamento_id).maybeSingle();
      setOrcamento(orc);
      if (orc) {
        const { data: ambs } = await supabase.from("ambientes").select("*").eq("orcamento_id", orc.id).order("ordem");
        setAmbientes(ambs || []);
      }
    }
    if (ped.cliente_id) {
      const { data: cli } = await supabase.from("clientes").select("*").eq("id", ped.cliente_id).maybeSingle();
      setCliente(cli);
    }
    const { data: ct } = await supabase.from("contratos").select("*").eq("orcamento_id", ped.orcamento_id).maybeSingle();
    setContrato(ct);
    let { data: pst } = await supabase.from("pedido_pastas").select("*").eq("pedido_id", id).order("ordem");
    pst = pst || [];
    // Auto-cria as pastas padrão se não existirem
    const padroes = ["Projetos/PDF", "Documentos", "Check-in Obra", "Fotos/Entrega"];
    const faltando = padroes.filter((nome) => !pst!.some((p: any) => p.nome.toLowerCase() === nome.toLowerCase()));
    if (faltando.length) {
      const baseOrdem = pst.length;
      const novas = faltando.map((nome, i) => ({ pedido_id: id, nome, ordem: baseOrdem + i }));
      const { data: criadas } = await supabase.from("pedido_pastas").insert(novas).select("*");
      pst = [...pst, ...(criadas || [])];
    }
    // Pasta virtual para projetos importados (read-only)
    const PROJ_VIRTUAL_ID = "__virtual_projetos_importados__";
    setPastas([{ id: PROJ_VIRTUAL_ID, nome: "Projetos Importados", _virtual: true }, ...pst]);
    const { data: dcs } = await supabase.from("pedido_documentos").select("*").eq("pedido_id", id).order("created_at", { ascending: false });
    // Também traz documentos anexados na fase de orçamento (Promob, XML, Excel etc.)
    let docsCombinados: any[] = dcs || [];
    if (ped.orcamento_id) {
      const { data: orcDocs } = await supabase
        .from("orcamento_documentos" as any)
        .select("*")
        .eq("orcamento_id", ped.orcamento_id)
        .order("created_at", { ascending: false });
      const mapped = (orcDocs || []).map((d: any) => ({
        ...d,
        pasta_id: PROJ_VIRTUAL_ID,
        _bucket: "orcamento-docs",
        _readonly: true,
        nome: d.origem === "promob_import" ? `[Promob] ${d.nome}` : d.origem === "xml_import" ? `[XML] ${d.nome}` : d.origem === "excel_import" ? `[Excel] ${d.nome}` : d.nome,
      }));
      docsCombinados = [...mapped, ...docsCombinados];
    }
    setDocs(docsCombinados);
    const { data: ch } = await supabase.from("pedido_chat").select("*").eq("pedido_id", id).order("created_at");
    setChat(ch || []);
    const { data: rv } = await supabase.from("pedido_revisoes").select("*").eq("pedido_id", id).order("created_at");
    setRevisoes(rv || []);
    const { data: prof } = await supabase.from("profiles").select("user_id, nome_completo").eq("ativo", true);
    setUsuarios(prof || []);
    // Pedido pai (se este for adendo) e adendos filhos
    if (ped.pedido_pai_id) {
      const { data: pai } = await supabase.from("pedidos").select("id, codigo, valor_total").eq("id", ped.pedido_pai_id).maybeSingle();
      setPedidoPai(pai);
    } else { setPedidoPai(null); }
    const { data: filhos } = await supabase.from("pedidos").select("id, codigo, valor_total, status, created_at").eq("pedido_pai_id", id as string).order("created_at");
    setAdendos(filhos || []);
    setLoading(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`pedido_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_chat", filter: `pedido_id=eq.${id}` }, () => {
        supabase.from("pedido_chat").select("*").eq("pedido_id", id).order("created_at").then(({ data }) => setChat(data || []));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_documentos", filter: `pedido_id=eq.${id}` }, () => {
        supabase.from("pedido_documentos").select("*").eq("pedido_id", id).order("created_at", { ascending: false }).then(({ data }) => setDocs(data || []));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  /* ----- sincroniza estágio do workflow conforme datas preenchidas ----- */
  const computeWorkflowStage = (p: any): string => {
    // Se foi cancelado/concluído manualmente, mantém
    if (p.workflow_estagio === "concluido") return "concluido";
    // Sem nenhuma data e sem início → aguardando
    const hasAny = p.data_medicao_tecnica || p.data_envio_fabrica || p.data_chegada_material || p.data_montagem || p.data_limite_finalizacao;
    if (!hasAny && !p.workflow_iniciado_em) return "aguardando";
    // Avança progressivamente: cada data preenchida marca o estágio como concluído (passa pro próximo)
    if (p.data_limite_finalizacao) return "concluido";
    if (p.data_montagem) return "montagem";
    if (p.data_chegada_material) return "entrega";
    if (p.data_envio_fabrica) return "fabrica";
    if (p.data_medicao_tecnica) return "revisao";
    return "medicao";
  };

  /* ----- atualizar pedido (datas, flags) ----- */
  const salvarPedido = async (patch: any) => {
    if (!id) return;
    // Se a alteração envolve datas do cronograma, recalcula estágio do workflow
    const dateKeys = ["data_medicao_tecnica", "data_envio_fabrica", "data_chegada_material", "data_montagem", "data_limite_finalizacao"];
    const touchesDates = dateKeys.some((k) => k in patch);
    let finalPatch = { ...patch };
    if (touchesDates) {
      const merged = { ...pedido, ...patch };
      const novoEstagio = computeWorkflowStage(merged);
      finalPatch.workflow_estagio = novoEstagio;
      if (!pedido?.workflow_iniciado_em && novoEstagio !== "aguardando") {
        finalPatch.workflow_iniciado_em = new Date().toISOString();
      }
    }
    const { error } = await supabase.from("pedidos").update(finalPatch).eq("id", id);
    if (error) return toast.error(error.message);
    setPedido((p: any) => ({ ...p, ...finalPatch }));
  };

  /* ----- iniciar workflow / kanban ----- */
  const iniciarWorkflow = async (estagio: string) => {
    if (!id) return;
    await salvarPedido({
      workflow_estagio: estagio,
      workflow_iniciado_em: new Date().toISOString(),
    });
    toast.success(`Workflow iniciado em: ${estagio.toUpperCase()}`);
  };

  /* ----- criar adendo (novo orçamento atrelado a este pedido) ----- */
  const criarAdendo = async () => {
    if (!pedido || !pedido.orcamento_id) return;
    if (!confirm("Criar um novo Adendo a partir deste pedido?\n\nO adendo é um orçamento complementar vinculado ao pedido original. Ele gera um novo contrato e novos lançamentos financeiros independentes — sem alterar a venda já fechada.")) return;
    setCriandoAdendo(true);
    try {
      const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", pedido.orcamento_id).maybeSingle();
      if (!orc) throw new Error("Orçamento original não encontrado");
      const seq = (adendos.length + 1).toString().padStart(2, "0");
      const novoCodigo = `${orc.codigo}-ADD-${seq}`;
      const { data: novoOrc, error } = await supabase.from("orcamentos").insert({
        codigo: novoCodigo,
        cliente_id: orc.cliente_id,
        loja_id: orc.loja_id,
        nome_projeto: `[ADENDO ${seq} de ${pedido.codigo}] ${orc.nome_projeto || ""}`,
        status: "negociacao",
        subtotal: 0, total: 0,
        parceiro_id: orc.parceiro_id, parceiro_perc: orc.parceiro_perc,
        consultor_id: orc.consultor_id, vendedor_id: orc.vendedor_id, origem_id: orc.origem_id,
        is_adendo: true,
        pedido_origem_id: pedido.id,
        created_by: user?.id,
      } as any).select().maybeSingle();
      if (error || !novoOrc) throw error || new Error("Falha ao criar adendo");
      toast.success(`Adendo ${novoCodigo} criado`);
      navigate(`/comercial/${novoOrc.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar adendo");
    } finally {
      setCriandoAdendo(false);
    }
  };


  if (loading) return <div className="text-center py-20 text-muted-foreground text-[13px]">Carregando…</div>;
  if (!pedido) return <div className="text-center py-20 text-muted-foreground text-[13px]">Pedido não encontrado.</div>;

  const assinaturaPendente = contrato && contrato.status === "aguardando_assinatura";
  const stageIndex = WF_STAGES.findIndex(s => s.key === pedido.workflow_estagio);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/comercial" className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="font-playfair text-[42px] leading-tight font-semibold mt-1">{pedido.codigo}</h1>
          <div className="flex items-center gap-3 mt-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{cliente?.nome || "—"}</span>
            {assinaturaPendente && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="w-3.5 h-3.5" /> Assinatura pendente
              </span>
            )}
            {pedido.is_adendo && (
              <span className="inline-flex items-center gap-1 text-purple-600 font-medium px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200">
                <Sparkles className="w-3.5 h-3.5" /> Adendo
              </span>
            )}
          </div>
          {assinaturaPendente && contrato && (
            <ContratoEnvioBar contrato={contrato} cliente={cliente} pedido={pedido} onChange={carregar} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-[13px] cursor-pointer">
            <Checkbox checked={!!pedido.vip} onCheckedChange={(v) => salvarPedido({ vip: !!v })} />
            <Star className="w-4 h-4 text-amber-500" /> VIP
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-[13px] cursor-pointer">
            <Checkbox checked={!!pedido.critico} onCheckedChange={(v) => salvarPedido({ critico: !!v })} />
            <AlertTriangle className="w-4 h-4 text-red-500" /> Crítico
          </label>
          <Button variant="outline" className="text-red-600 border-red-300"
            onClick={async () => {
              if (!confirm("Cancelar este pedido?")) return;
              await salvarPedido({ status: "cancelado" });
              toast.success("Pedido cancelado");
            }}>
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          {contrato ? (
            <Button className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
              onClick={() => navigate(`/contratos/${contrato.id}`)}>
              <Printer className="w-4 h-4 mr-1.5" /> Contrato
            </Button>
          ) : null}
          <Button variant="outline" className="text-purple-700 border-purple-300 bg-purple-50 hover:bg-purple-100"
            disabled={criandoAdendo}
            onClick={criarAdendo}>
            <Sparkles className="w-4 h-4 mr-1.5" /> {criandoAdendo ? "Criando…" : "Criar Adendo"}
          </Button>
        </div>
      </div>

      {/* VÍNCULO DE ADENDO / PEDIDO PAI */}
      {(pedidoPai || adendos.length > 0) && (
        <section className="surface-card p-4 border-l-4 border-purple-400">
          <div className="flex items-start gap-4 flex-wrap">
            {pedidoPai && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pedido original</div>
                <Link to={`/pedidos/${pedidoPai.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-700 hover:underline">
                  <FileText className="w-4 h-4" /> {pedidoPai.codigo} · {fmtBrl(Number(pedidoPai.valor_total) || 0)}
                </Link>
              </div>
            )}
            {adendos.length > 0 && (
              <div className="flex-1 min-w-[280px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Adendos vinculados ({adendos.length})</div>
                <div className="flex flex-wrap gap-2">
                  {adendos.map((a) => (
                    <Link key={a.id} to={`/pedidos/${a.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-[12px] text-purple-700 hover:bg-purple-100">
                      <Sparkles className="w-3.5 h-3.5" /> {a.codigo} · {fmtBrl(Number(a.valor_total) || 0)} <span className="text-muted-foreground">· {a.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PIPELINES & ESTÁGIOS */}
      <PipelinesPanel pedido={pedido} />

      {/* CRONOGRAMA E DATAS */}
      <Cronograma pedido={pedido} salvarPedido={salvarPedido} onIniciar={iniciarWorkflow} />

      {/* WORKFLOW DE PRODUÇÃO */}
      <section className="surface-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-purple-600 text-white flex items-center justify-center"><Clock className="w-5 h-5" /></div>
          <div>
            <h2 className="font-playfair text-[22px] font-semibold">Workflow de Produção</h2>
            <p className="text-[12px] text-muted-foreground">Avança automaticamente conforme o Cronograma</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4">
          {WF_STAGES.map((s, i) => {
            const Icon = s.icon;
            const active = stageIndex >= 0 && i <= stageIndex;
            return (
              <div key={s.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition ${active ? "bg-purple-600 border-purple-600 text-white" : "bg-muted border-muted-foreground/20 text-muted-foreground/50"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${active ? "text-foreground" : "text-muted-foreground/50"}`}>{s.label}</div>
                </div>
                {i < WF_STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${stageIndex > i ? "bg-purple-600" : "bg-muted-foreground/20"}`} />
                )}
              </div>
            );
          })}
        </div>
        {!pedido.workflow_estagio || pedido.workflow_estagio === "aguardando" ? (
          <div className="mt-5 text-center">
            <Button onClick={() => iniciarWorkflow("medicao")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              ▶ Iniciar Workflow de Produção: Medição
            </Button>
          </div>
        ) : null}
      </section>

      {/* OBSERVAÇÕES + CHAT INTERNO + WHATSAPP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Observacoes pedido={pedido} salvarPedido={salvarPedido} />
        <ChatInterno pedidoId={pedido.id} userId={user?.id || ""} chat={chat} usuarios={usuarios} onSent={carregar} />
        <WhatsappCard cliente={cliente} />
      </div>

      {/* CENTRAL DE DOCUMENTOS */}
      <CentralDocs pedidoId={pedido.id} pastas={pastas} docs={docs} onChange={carregar} />

      {/* ITENS DO PROJETO */}
      <ItensProjeto ambientes={ambientes} total={totalProjeto} />

      {/* AVISO: edição de pedido fechado gera adendo */}
      <section className="rounded-lg border border-purple-300 bg-purple-50 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-[13px] text-purple-900">
          <div className="font-semibold mb-0.5">Pedido fechado — toda alteração vira Adendo</div>
          <div>
            Para preservar o financeiro, este pedido não pode ser editado diretamente. Adicionar itens avulsos
            ou importar revisões cria um <b>Adendo</b> (orçamento complementar vinculado), que gera um novo
            contrato e novos lançamentos sem alterar a venda original.
          </div>
        </div>
        <Button onClick={criarAdendo} disabled={criandoAdendo} className="bg-purple-600 hover:bg-purple-700 text-white">
          <Sparkles className="w-4 h-4 mr-1.5" /> {criandoAdendo ? "Criando…" : "Criar Adendo"}
        </Button>
      </section>

      {/* Itens avulsos do pedido (apenas leitura — adições devem ir para um adendo) */}
      <ItensAvulsosManager pedidoId={pedido.id} readOnly />

      {/* IMPORTAR REVISÃO PROMOB */}
      <RevisaoPromob pedido={pedido} ambientes={ambientes} revisoes={revisoes} cliente={cliente} onChange={carregar} />
    </div>
  );
}

/* ============================================================== */
/*                        CRONOGRAMA                              */
/* ============================================================== */
function Cronograma({ pedido, salvarPedido }: any) {
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [dataRevisao, setDataRevisao] = useState<string | null>(null);
  const [dataAssinaturaPdf, setDataAssinaturaPdf] = useState<string | null>(null);
  const [dataImplantacaoFabrica, setDataImplantacaoFabrica] = useState<string | null>(null);
  const [dataChegadaDeposito, setDataChegadaDeposito] = useState<string | null>(null);
  const [dataEntrega, setDataEntrega] = useState<string | null>(null);
  const [dataMontagemFinalizada, setDataMontagemFinalizada] = useState<string | null>(null);
  const [dataVistoria, setDataVistoria] = useState<string | null>(null);

  const carregar = async () => {
    // Revisão final: agendada junto com a medição técnica
    const { data: rev } = await supabase
      .from("agenda_eventos")
      .select("data")
      .eq("pedido_id", pedido.id)
      .eq("tipo", "revisao_final")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDataRevisao(rev?.data ? String(rev.data).slice(0, 10) : null);

    // Buscar todos os eventos kanban deste pedido
    const { data: evts } = await (supabase as any)
      .from("timeline_eventos")
      .select("created_at, tipo, metadata")
      .eq("entidade_tipo", "pedido")
      .eq("entidade_id", pedido.id)
      .in("tipo", ["kanban_movimento", "kanban_concluido"])
      .order("created_at", { ascending: true });
    const all: any[] = evts || [];

    const movFor = (pipeline: string, paraSubstr: string, asc = true) => {
      const arr = all.filter(
        (e) =>
          e.tipo === "kanban_movimento" &&
          e.metadata?.pipeline === pipeline &&
          String(e.metadata?.para || "").toLowerCase().includes(paraSubstr.toLowerCase())
      );
      return asc ? arr[0] : arr[arr.length - 1];
    };
    const saidaFor = (pipeline: string, deSubstr: string) => {
      const arr = all.filter(
        (e) =>
          e.tipo === "kanban_movimento" &&
          e.metadata?.pipeline === pipeline &&
          String(e.metadata?.de || "").toLowerCase().includes(deSubstr.toLowerCase())
      );
      return arr[arr.length - 1];
    };
    const concluidoFor = (pipeline: string, estagioSubstr?: string) => {
      const arr = all.filter(
        (e) =>
          e.tipo === "kanban_concluido" &&
          e.metadata?.pipeline === pipeline &&
          (!estagioSubstr ||
            String(e.metadata?.estagio || "").toLowerCase().includes(estagioSubstr.toLowerCase()))
      );
      return arr[arr.length - 1];
    };

    const evAssin = saidaFor("revisao", "assinatura pdf final");
    setDataAssinaturaPdf(evAssin?.created_at ? String(evAssin.created_at).slice(0, 10) : null);

    const evFab = concluidoFor("fabrica");
    setDataImplantacaoFabrica(evFab?.created_at ? String(evFab.created_at).slice(0, 10) : null);

    // Linha 2 — pipeline montagem
    const evChegada = movFor("montagem", "agendamento entrega") ?? movFor("montagem", "depósito");
    setDataChegadaDeposito(evChegada?.created_at ? String(evChegada.created_at).slice(0, 10) : null);

    const evEntrega = movFor("montagem", "entregue");
    setDataEntrega(evEntrega?.created_at ? String(evEntrega.created_at).slice(0, 10) : null);

    const evMontFim = movFor("montagem", "vistoria pendente");
    setDataMontagemFinalizada(evMontFim?.created_at ? String(evMontFim.created_at).slice(0, 10) : null);

    const evVistoria = concluidoFor("montagem", "vistoria agendada");
    setDataVistoria(evVistoria?.created_at ? String(evVistoria.created_at).slice(0, 10) : null);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [pedido.id]);

  const onAgendaCriada = async () => {
    const { data } = await supabase
      .from("agenda_eventos")
      .select("data")
      .eq("pedido_id", pedido.id)
      .eq("tipo", "medicao_tecnica")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.data) {
      const dataStr = String(data.data).slice(0, 10);
      await salvarPedido({ data_medicao_tecnica: dataStr });
      toast.success("Medição técnica agendada");
    }
    await carregar();
  };

  const fmt = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  const fields = [
    {
      key: "medicao",
      label: "Medição Técnica",
      icon: "📐",
      value: pedido.data_medicao_tecnica,
      action: () => setAgendaOpen(true),
      hint: "Agendar via agenda",
    },
    { key: "revisao", label: "Revisão", icon: "🧐", value: dataRevisao, hint: "Agendada junto à medição" },
    { key: "assin", label: "Assinatura PDF Final", icon: "📝", value: dataAssinaturaPdf, hint: "Saída da etapa no Kanban Revisão" },
    { key: "fabrica", label: "Implantação Fábrica", icon: "🏭", value: dataImplantacaoFabrica, hint: "Conclusão do card no Kanban Fábrica" },
  ];

  const fieldsLinha2 = [
    { key: "chegada", label: "Chegada Depósito", icon: "📦", value: dataChegadaDeposito, hint: "Entrada na etapa Agendamento Entrega-Depósito" },
    { key: "entrega", label: "Entrega", icon: "🚚", value: dataEntrega, hint: "Entrada na etapa Entregue (Kanban Montagem)" },
    { key: "mont_fim", label: "Montagem Finalizada", icon: "🛠️", value: dataMontagemFinalizada, hint: "Entrada na etapa Vistoria Pendente" },
    { key: "vistoria", label: "Vistoria", icon: "✅", value: dataVistoria, hint: "Conclusão na etapa Vistoria Agendada" },
  ];

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#2D6BE5] text-white flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
          <div>
            <h2 className="font-playfair text-[22px] font-semibold">Cronograma e Datas</h2>
            <p className="text-[12px] text-muted-foreground">Datas operacionais sincronizadas com Agenda e Kanbans</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <span>{f.icon}</span> {f.label}
            </Label>
            {f.action ? (
              <button
                type="button"
                onClick={f.action}
                className="w-full mt-1.5 h-9 px-3 rounded-md border bg-background text-left text-[13px] hover:border-[#2D6BE5] flex items-center justify-between"
              >
                <span className={f.value ? "" : "text-muted-foreground"}>
                  {f.value ? fmt(f.value) : "Agendar…"}
                </span>
                <Calendar className="w-4 h-4 text-[#2D6BE5]" />
              </button>
            ) : (
              <div className="w-full mt-1.5 h-9 px-3 rounded-md border bg-muted/40 text-[13px] flex items-center">
                <span className={f.value ? "" : "text-muted-foreground"}>{fmt(f.value)}</span>
              </div>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {fieldsLinha2.map((f) => (
          <div key={f.key}>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <span>{f.icon}</span> {f.label}
            </Label>
            <div className="w-full mt-1.5 h-9 px-3 rounded-md border bg-muted/40 text-[13px] flex items-center">
              <span className={f.value ? "" : "text-muted-foreground"}>{fmt(f.value)}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>

      <AgendaEventoDialog
        open={agendaOpen}
        onOpenChange={setAgendaOpen}
        pedidoId={pedido.id}
        defaultTipo="medicao_tecnica"
        onCreated={onAgendaCriada}
      />
    </section>
  );
}

/* ============================================================== */
/*                       OBSERVAÇÕES                              */
/* ============================================================== */
function Observacoes({ pedido, salvarPedido }: any) {
  const [text, setText] = useState(pedido.observacoes_venda || "");
  useEffect(() => setText(pedido.observacoes_venda || ""), [pedido.id]);
  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-amber-600" />
        <h3 className="font-playfair text-[18px] font-semibold">Observações</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{text ? "" : "Sem observações"}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite aqui…" className="flex-1 min-h-[160px] bg-amber-50/30 border-amber-200" />
      <Button onClick={async () => { await salvarPedido({ observacoes_venda: text }); toast.success("Observações salvas"); }} className="mt-3 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300">
        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Salvar
      </Button>
    </div>
  );
}

/* ============================================================== */
/*                       CHAT INTERNO                             */
/* ============================================================== */
function ChatInterno({ pedidoId, userId, chat, usuarios, onSent }: any) {
  const [msg, setMsg] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [filterMenu, setFilterMenu] = useState("");
  const userMap = useMemo(() => Object.fromEntries(usuarios.map((u: any) => [u.user_id, u.nome_completo || u.user_id.slice(0, 6)])), [usuarios]);

  const enviar = async () => {
    if (!msg.trim() || !userId) return;
    // extrair menções @nome
    const mentioned = usuarios.filter((u: any) => msg.toLowerCase().includes(`@${(u.nome_completo || "").toLowerCase().split(" ")[0]}`)).map((u: any) => u.user_id);

    const { error } = await supabase.from("pedido_chat").insert({
      pedido_id: pedidoId, user_id: userId, mensagem: msg.trim(), mencionados: mentioned,
    });
    if (error) return toast.error(error.message);

    // Identificar participantes anteriores da conversa
    const participantes = new Set<string>(chat.map((c: any) => c.user_id));
    const destinatarios = new Set<string>([...mentioned, ...participantes]);
    destinatarios.delete(userId);
    if (destinatarios.size > 0) {
      const notifs = Array.from(destinatarios).map((uid) => ({
        user_id: uid, tipo: "chat_pedido",
        titulo: "Nova mensagem no pedido",
        mensagem: msg.trim().slice(0, 120),
        link: `/pedidos/${pedidoId}`,
        metadata: { pedido_id: pedidoId, mencionado: mentioned.includes(uid) },
      }));
      await supabase.from("notificacoes").insert(notifs);
    }
    setMsg("");
    onSent?.();
  };

  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-[#2D6BE5]" />
        <h3 className="font-playfair text-[18px] font-semibold">Chat Interno do Contrato</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Colaboradores da mesma empresa</p>
      <div className="flex-1 min-h-[160px] max-h-[240px] overflow-y-auto space-y-2 mb-3 px-1">
        {chat.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-[12px]">
            💬<br />Nenhuma mensagem ainda
          </div>
        ) : chat.map((c: any) => (
          <div key={c.id} className={`p-2 rounded-lg text-[12px] ${c.user_id === userId ? "bg-[#2D6BE5]/10 ml-6" : "bg-muted mr-6"}`}>
            <div className="font-semibold text-[11px]">{userMap[c.user_id] || "Usuário"}</div>
            <div className="whitespace-pre-wrap">{c.mensagem}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(c.created_at)}</div>
          </div>
        ))}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={msg}
            onChange={(e) => {
              const v = e.target.value;
              setMsg(v);
              const lastAt = v.lastIndexOf("@");
              if (lastAt >= 0 && (lastAt === v.length - 1 || /^\w*$/.test(v.slice(lastAt + 1)))) {
                setShowMenu(true);
                setFilterMenu(v.slice(lastAt + 1).toLowerCase());
              } else setShowMenu(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Digite uma mensagem… (use @ para mencionar)"
          />
          <Button onClick={enviar} size="icon" className="bg-[#2D6BE5] hover:bg-[#2459C9]"><Send className="w-4 h-4" /></Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">💡 Digite @ para ver lista de colaboradores</p>
        {showMenu && (
          <div className="absolute bottom-full mb-1 left-0 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto w-64 z-20">
            {usuarios.filter((u: any) => (u.nome_completo || "").toLowerCase().includes(filterMenu)).slice(0, 6).map((u: any) => (
              <button key={u.user_id} className="block w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent"
                onClick={() => {
                  const lastAt = msg.lastIndexOf("@");
                  setMsg(msg.slice(0, lastAt) + "@" + (u.nome_completo || "").split(" ")[0] + " ");
                  setShowMenu(false);
                }}>
                @{(u.nome_completo || "Usuário").split(" ")[0]} <span className="text-muted-foreground">— {u.nome_completo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================== */
/*                       WHATSAPP (placeholder)                   */
/* ============================================================== */
function WhatsappCard({ cliente }: any) {
  return (
    <div className="surface-card p-5 flex flex-col bg-emerald-50/40 border-emerald-200/60">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-emerald-600" />
        <h3 className="font-playfair text-[18px] font-semibold">WhatsApp</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 uppercase tracking-wider">{cliente?.nome || "—"}</p>
      <div className="flex-1 flex items-center justify-center text-center text-[12px] text-muted-foreground">
        💬<br />Integração futura<br />(em breve)
      </div>
    </div>
  );
}

/* ============================================================== */
/*                  CENTRAL DE DOCUMENTOS                         */
/* ============================================================== */
function CentralDocs({ pedidoId, pastas, docs, onChange }: any) {
  const [pastaAtiva, setPastaAtiva] = useState<string | null>(pastas[0]?.id || null);
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);
  const [assinaturaOpen, setAssinaturaOpen] = useState<any>(null);
  const [renomearPasta, setRenomearPasta] = useState<any>(null);

  useEffect(() => { if (!pastaAtiva && pastas[0]) setPastaAtiva(pastas[0].id); }, [pastas]);

  const docsDaPasta = docs.filter((d: any) => d.pasta_id === pastaAtiva);

  const criarPasta = async () => {
    if (!novaPastaNome.trim()) return;
    const ordem = pastas.length;
    await supabase.from("pedido_pastas").insert({ pedido_id: pedidoId, nome: novaPastaNome.trim(), ordem });
    toast.success("Pasta criada");
    setNovaPastaOpen(false); setNovaPastaNome(""); onChange();
  };

  const uploadDoc = async () => {
    if (!arquivoFile) return toast.error("Selecione um arquivo");
    const path = `${pedidoId}/${Date.now()}_${arquivoFile.name}`;
    const { error: upErr } = await supabase.storage.from("pedido-docs").upload(path, arquivoFile);
    if (upErr) return toast.error(upErr.message);
    await supabase.from("pedido_documentos").insert({
      pedido_id: pedidoId, pasta_id: pastaAtiva, nome: arquivoNome || arquivoFile.name,
      storage_path: path, tamanho: arquivoFile.size, mime_type: arquivoFile.type,
    });
    toast.success("Arquivo enviado");
    setUploadOpen(false); setArquivoNome(""); setArquivoFile(null); onChange();
  };

  const enviarParaAssinatura = async (doc: any) => {
    const token = crypto.randomUUID().replace(/-/g, "");
    await supabase.from("pedido_documentos").update({ enviado_para_assinatura: true, signing_token: token }).eq("id", doc.id);
    setAssinaturaOpen({ ...doc, signing_token: token });
    onChange();
  };

  const removerDoc = async (id: string) => {
    if (!confirm("Remover este arquivo?")) return;
    await supabase.from("pedido_documentos").delete().eq("id", id);
    toast.success("Removido"); onChange();
  };

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full bg-purple-600 text-white flex items-center justify-center"><Folder className="w-5 h-5" /></div>
        <div>
          <h2 className="font-playfair text-[22px] font-semibold">Central de Documentos</h2>
          <p className="text-[12px] text-muted-foreground">Organize arquivos e documentações da venda</p>
        </div>
      </div>

      {/* Tabs de pastas */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {pastas.map((p: any) => (
          <div key={p.id} className="relative group">
            <button
              onClick={() => setPastaAtiva(p.id)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-wider ${pastaAtiva === p.id ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {p.nome}
            </button>
            {!p._virtual && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute -top-1 -right-1 p-0.5 rounded-full bg-white border opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setRenomearPasta(p)}>✏️ Renomear Pasta</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={async () => {
                    if (!confirm(`Deletar pasta "${p.nome}" e todos seus documentos?`)) return;
                    await supabase.from("pedido_documentos").delete().eq("pasta_id", p.id);
                    await supabase.from("pedido_pastas").delete().eq("id", p.id);
                    toast.success("Pasta removida"); onChange();
                  }}>🗑 Deletar Pasta</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
        <Button size="sm" variant="outline" className="rounded-full text-emerald-700 border-emerald-300 bg-emerald-50" onClick={() => setNovaPastaOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Pasta
        </Button>
      </div>

      {/* Lista de docs */}
      <div className="space-y-2">
        {docsDaPasta.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-[12px]">Nenhum documento nesta categoria</div>
        ) : docsDaPasta.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-[13px] font-medium">{d.nome}</div>
                <div className="text-[10px] text-muted-foreground">{fmtDateTime(d.created_at)}{d.assinado_em ? ` • ✓ Assinado por ${d.assinatura_nome}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!d.assinado_em && !d._readonly && (
                <Button size="sm" variant="ghost" onClick={() => enviarParaAssinatura(d)}>
                  <Send className="w-4 h-4 text-emerald-600" />
                </Button>
              )}
              <a href={supabase.storage.from(d._bucket || "pedido-docs").getPublicUrl(d.storage_path).data.publicUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost"><FileText className="w-4 h-4" /></Button>
              </a>
              {!d._readonly && (
                <Button size="sm" variant="ghost" onClick={() => removerDoc(d.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pastas.find((p: any) => p.id === pastaAtiva)?._virtual ? (
        <div className="mt-4 text-center text-[11px] text-muted-foreground italic">
          Documentos importados na fase de orçamento (somente leitura)
        </div>
      ) : (
        <button
          onClick={() => setUploadOpen(true)}
          className="w-full mt-4 py-4 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/30 hover:bg-purple-50 text-purple-700 font-semibold text-[13px] flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Adicionar Arquivo
        </button>
      )}

      {/* Nova pasta */}
      <Dialog open={novaPastaOpen} onOpenChange={setNovaPastaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Nova Pasta</DialogTitle></DialogHeader>
          <div>
            <Label className="text-[11px] uppercase">Nome da Pasta</Label>
            <Input value={novaPastaNome} onChange={(e) => setNovaPastaNome(e.target.value)} placeholder="Ex: Plantas Aprovadas" />
            <p className="text-[11px] text-muted-foreground mt-2">A pasta será criada com base no nome que você fornecer.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPastaOpen(false)}>Cancelar</Button>
            <Button onClick={criarPasta} disabled={!novaPastaNome.trim()} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-1.5" /> Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear pasta */}
      <Dialog open={!!renomearPasta} onOpenChange={(v) => !v && setRenomearPasta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Pasta</DialogTitle></DialogHeader>
          <Input value={renomearPasta?.nome || ""} onChange={(e) => setRenomearPasta({ ...renomearPasta, nome: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomearPasta(null)}>Cancelar</Button>
            <Button onClick={async () => {
              await supabase.from("pedido_pastas").update({ nome: renomearPasta.nome }).eq("id", renomearPasta.id);
              toast.success("Renomeada"); setRenomearPasta(null); onChange();
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase">Enviar para {pastas.find((p: any) => p.id === pastaAtiva)?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-[12px]">
              <Upload className="w-3.5 h-3.5 inline mr-1" /> Destino: <b>{pastas.find((p: any) => p.id === pastaAtiva)?.nome}</b>
            </div>
            <div>
              <Label className="text-[11px] uppercase">Nome do Arquivo</Label>
              <Input value={arquivoNome} onChange={(e) => setArquivoNome(e.target.value)} placeholder="Ex: Planta Técnica" />
            </div>
            <div>
              <Label className="text-[11px] uppercase">Selecione o Arquivo</Label>
              <label className="block mt-1 p-6 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/30 text-center cursor-pointer hover:bg-purple-50">
                <Upload className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                <div className="text-[13px] font-semibold text-purple-700">{arquivoFile ? arquivoFile.name : "Clique para selecionar"}</div>
                <div className="text-[10px] text-muted-foreground">Limite: 50 MB</div>
                <input type="file" className="hidden" onChange={(e) => setArquivoFile(e.target.files?.[0] || null)} />
              </label>
              <p className="text-[10px] text-muted-foreground mt-1">Tipos permitidos: jpg, png, pdf, docx, xlsx, pptx, zip, mp4, dwg, promob, cad (máx. 50 MB)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={uploadDoc} className="bg-purple-600 hover:bg-purple-700"><Upload className="w-4 h-4 mr-1.5" /> Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assinatura digital */}
      <Dialog open={!!assinaturaOpen} onOpenChange={(v) => !v && setAssinaturaOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar para Assinatura</DialogTitle></DialogHeader>
          {assinaturaOpen && (() => {
            const url = `${window.location.origin}/contrato/${assinaturaOpen.signing_token}`;
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
            return (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center text-[14px] font-semibold uppercase">{assinaturaOpen.nome}</div>
                <div className="flex justify-center"><img src={qrSrc} alt="QR" className="rounded-lg border" /></div>
                <div>
                  <Label className="text-[10px] uppercase">Link para Assinatura</Label>
                  <div className="flex gap-1 mt-1">
                    <Input readOnly value={url} className="text-[12px]" />
                    <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}><Copy className="w-4 h-4 mr-1.5" /> Copiar Link</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Por favor, assine o documento: ${url}`)}`)}>
                    💬 WhatsApp
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">O cliente pode escanear o QR Code ou acessar o link para assinar o documento digitalmente</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ============================================================== */
/*                       ITENS DO PROJETO                         */
/* ============================================================== */
function ItensProjeto({ ambientes, total }: any) {
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider">Itens do Projeto</h2>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Total</div>
          <div className="text-[22px] font-semibold text-emerald-700">{fmtBrl(total)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {ambientes.map((a: any) => {
          const original = Number(a.preco_sugerido || 0);
          const aberta = !!aberto[a.id];
          return (
            <div key={a.id} className="border rounded-lg overflow-hidden">
              <button onClick={() => setAberto({ ...aberto, [a.id]: !aberta })} className="w-full flex items-center justify-between p-4 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  {aberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span className="font-semibold uppercase">{a.nome}</span>
                </div>
                <div className="text-right text-[12px]">
                  <div className="text-muted-foreground">de <span className="line-through">{fmtBrl(original)}</span></div>
                  <div className="text-emerald-700 font-semibold">por {fmtBrl(original)}</div>
                </div>
              </button>
              {aberta && a.descricao && (
                <div className="p-4 border-t bg-muted/20 text-[12px] whitespace-pre-wrap">{a.descricao}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================== */
/*                   REVISÃO PROMOB                               */
/* ============================================================== */
function RevisaoPromob({ pedido, ambientes, revisoes, cliente, onChange }: any) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [verRevisao, setVerRevisao] = useState<any>(null);

  const enviarRevisao = async (ambiente: any, file: File) => {
    setEnviando(ambiente.id);
    try {
      const text = await file.text();
      const parsed = parsePromobTxt(text);
      // Pega itens originais do ambiente
      const { data: subs } = await supabase.from("sub_itens_ambiente").select("*").eq("ambiente_id", ambiente.id);
      const env = parsed.environments[0] || { items: [] };
      const diff = diffPromobItems(subs || [], env.items, "clientPrice");
      const versaoAtual = revisoes.filter((r: any) => r.ambiente_id === ambiente.id).length + 1;
      await supabase.from("pedido_revisoes").insert({
        pedido_id: pedido.id, ambiente_id: ambiente.id, versao: versaoAtual,
        raw_content: text, parsed_data: env as any, diff: diff as any,
        valor_original: diff.totals.valorOriginal,
        valor_revisado: diff.totals.valorRevisado,
        variacao_perc: diff.totals.variacaoPerc,
        created_by: user?.id,
      });
      toast.success(`Revisão v${versaoAtual} enviada`);
      onChange();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setEnviando(null); }
  };

  const aprovar = async (rev: any) => {
    const novoValor = Number(rev.valor_revisado || 0);
    await supabase.from("ambientes").update({ preco_sugerido: novoValor }).eq("id", rev.ambiente_id);
    await supabase.from("pedido_revisoes").update({ aprovada: true, aprovada_em: new Date().toISOString() }).eq("id", rev.id);
    toast.success("Revisão aprovada — valor do ambiente atualizado");
    onChange();
  };

  const negociarAdendo = async (rev: any) => {
    // Cria novo orçamento de adendo baseado no original, com a DIFERENÇA de valor
    if (!pedido.orcamento_id) return;
    const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", pedido.orcamento_id).maybeSingle();
    if (!orc) return;
    const codigoBase = orc.codigo;
    const newCodigo = `${codigoBase}-ADD-${Date.now().toString().slice(-4)}`;
    const valorOriginal = Number(rev.valor_original || 0);
    const valorRevisado = Number(rev.valor_revisado || 0);
    const valorAdendo = Math.max(0, valorRevisado - valorOriginal);
    // Busca nome do ambiente original p/ referência
    const ambOrig = ambientes.find((a: any) => a.id === rev.ambiente_id);
    const nomeAmbOrig = ambOrig?.nome || "Ambiente";

    const { data: novo, error } = await supabase.from("orcamentos").insert({
      codigo: newCodigo, cliente_id: orc.cliente_id, loja_id: orc.loja_id,
      nome_projeto: `[ADENDO de ${pedido.codigo}] ${orc.nome_projeto || ""}`,
      status: "negociacao", subtotal: valorAdendo, total: valorAdendo,
      created_by: user?.id,
    }).select().maybeSingle();
    if (error || !novo) return toast.error(error?.message || "Erro");

    // Cria um ambiente no novo orçamento já com o valor da DIFERENÇA, justificando o acréscimo
    await supabase.from("ambientes").insert({
      orcamento_id: novo.id,
      nome: `Acréscimo: ${nomeAmbOrig} (revisão v${rev.versao})`,
      descricao: `Diferença gerada pela revisão do projeto.\nValor original: ${fmtBrl(valorOriginal)}\nValor revisado: ${fmtBrl(valorRevisado)}\nAcréscimo: ${fmtBrl(valorAdendo)}`,
      preco_sugerido: valorAdendo,
      custo_aquisicao: 0,
      ordem: 0,
    });

    toast.success(`Adendo criado com diferença de ${fmtBrl(valorAdendo)}`);
    navigate(`/comercial/${novo.id}/negociacao`);
  };

  return (
    <section className="surface-card p-6">
      <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider mb-4">Importar Revisão do Projeto</h2>

      <div className="space-y-3">
        {ambientes.map((amb: any) => {
          const revs = revisoes.filter((r: any) => r.ambiente_id === amb.id);
          return (
            <div key={amb.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{amb.nome}</div>
                  <div className="text-[11px] text-muted-foreground">Original: <b>{fmtBrl(Number(amb.preco_sugerido || 0))}</b></div>
                </div>
                <label>
                  <input type="file" accept=".txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarRevisao(amb, f); }} />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2D6BE5] hover:bg-[#2459C9] text-white text-[12px] font-semibold cursor-pointer">
                    <FileUp className="w-4 h-4" /> {enviando === amb.id ? "Enviando…" : "Enviar"}
                  </span>
                </label>
              </div>

              {/* Tabs de revisões */}
              {revs.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {revs.map((r: any) => (
                      <button key={r.id} onClick={() => setVerRevisao(r)} className="px-3 py-1 rounded-md bg-purple-50 border border-purple-200 text-[11px] text-purple-700 hover:bg-purple-100">
                        v{r.versao} · {fmtDateTime(r.created_at)} {r.aprovada && "✓"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal diff */}
      <Dialog open={!!verRevisao} onOpenChange={(v) => !v && setVerRevisao(null)}>
        <DialogContent className="max-w-4xl">
          {verRevisao && (() => {
            const amb = ambientes.find((a: any) => a.id === verRevisao.ambiente_id);
            return (
              <RevisaoDiffView
                rev={verRevisao}
                ambienteNome={amb?.nome}
                onAprovar={() => { aprovar(verRevisao); setVerRevisao(null); }}
                onNegociarAdendo={() => { negociarAdendo(verRevisao); setVerRevisao(null); }}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RevisaoDiffView({ rev, ambienteNome, onAprovar, onNegociarAdendo }: any) {
  const [tab, setTab] = useState<"resumo" | "mantidos" | "alterados" | "adicionados" | "removidos">("resumo");
  const diff = rev.diff as DiffResult;
  const totals = diff?.totals || { mantidos: 0, alterados: 0, adicionados: 0, removidos: 0, valorOriginal: 0, valorRevisado: 0, variacao: 0, variacaoPerc: 0 };
  const itensTab = (diff?.itens || []).filter((i: any) => i.status === tab.slice(0, -1) || (tab === "mantidos" && i.status === "mantido") || (tab === "alterados" && i.status === "alterado") || (tab === "adicionados" && i.status === "adicionado") || (tab === "removidos" && i.status === "removido"));
  const aumento = totals.variacao > 0;

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span>{ambienteNome} · Revisão v{rev.versao}</span>
          <span className="text-[11px] text-muted-foreground">{fmtDateTime(rev.created_at)}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex gap-4 border-b mt-3">
        {[
          { k: "resumo", label: "Resumo" },
          { k: "mantidos", label: `Mantidos (${totals.mantidos})` },
          { k: "alterados", label: `Alterados (${totals.alterados})` },
          { k: "adicionados", label: `Adicionados (${totals.adicionados})` },
          { k: "removidos", label: `Removidos (${totals.removidos})` },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)} className={`pb-2 text-[12px] font-semibold ${tab === t.k ? "border-b-2 border-[#2D6BE5] text-[#2D6BE5]" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" ? (
        <div className="mt-4">
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <div className="text-[10px] uppercase tracking-wider text-blue-700">Original</div>
              <div className="text-[16px] font-bold text-blue-900">{fmtBrl(totals.valorOriginal)}</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
              <div className="text-[10px] uppercase tracking-wider text-purple-700">Revisado</div>
              <div className="text-[16px] font-bold text-purple-900">{fmtBrl(totals.valorRevisado)}</div>
            </div>
            <div className={`p-3 rounded-lg border text-center ${aumento ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className={`text-[10px] uppercase tracking-wider ${aumento ? "text-red-700" : "text-emerald-700"}`}>{aumento ? "Aumento" : "Desconto"}</div>
              <div className={`text-[16px] font-bold ${aumento ? "text-red-900" : "text-emerald-900"}`}>{fmtBrl(Math.abs(totals.variacao))}</div>
            </div>
            <div className="p-3 rounded-lg bg-card border text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Variação</div>
              <div className={`text-[16px] font-bold ${aumento ? "text-red-700" : "text-emerald-700"}`}>{totals.variacaoPerc.toFixed(1)}%</div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {totals.mantidos} mantidos · {totals.alterados} alterados · {totals.adicionados} adicionados · {totals.removidos} removidos
          </div>
        </div>
      ) : (
        <div className="mt-3 max-h-[360px] overflow-y-auto">
          {itensTab.length === 0 ? <div className="text-center text-[12px] text-muted-foreground py-6">Nenhum item</div> :
            itensTab.map((it: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 border-b text-[12px]">
                <span>{it.descricao}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>x{it.qtd_revisada ?? it.qtd_original}</span>
                  <span className="font-semibold">{fmtBrl(it.valor_revisado ?? it.valor_original ?? 0)}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      <DialogFooter className="mt-4">
        {!rev.aprovada && (
          <>
            {aumento && (
              <Button onClick={onNegociarAdendo} className="bg-purple-600 hover:bg-purple-700">
                <Sparkles className="w-4 h-4 mr-1.5" /> Negociar Adendo ({fmtBrl(totals.variacao)})
              </Button>
            )}
            <Button onClick={onAprovar} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprovar Revisão
            </Button>
          </>
        )}
        {rev.aprovada && <span className="text-emerald-700 text-[12px] font-semibold">✓ Aprovada em {fmtDateTime(rev.aprovada_em)}</span>}
      </DialogFooter>
    </div>
  );
}

/* ============================================================== */
/*                       PIPELINES PANEL                          */
/* ============================================================== */
function PipelinesPanel({ pedido }: { pedido: any }) {
  const [crmEstagios, setCrmEstagios] = useState<any[]>([]);
  const [crmEstagioAtual, setCrmEstagioAtual] = useState<any>(null);
  const [opEstagios, setOpEstagios] = useState<any[]>([]);
  const [opAtual, setOpAtual] = useState<any>(null);

  useEffect(() => {
    if (!pedido) return;
    (async () => {
      const [{ data: orc }, { data: crm }, { data: ops }] = await Promise.all([
        pedido.orcamento_id
          ? supabase.from("orcamentos").select("estagio_id").eq("id", pedido.orcamento_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("crm_estagios").select("id, nome, cor, ordem").eq("ativo", true).order("ordem"),
        supabase.from("pipeline_estagios").select("id, nome, cor, ordem").eq("pipeline", "operacional").eq("ativo", true).order("ordem"),
      ]);
      setCrmEstagios(crm ?? []);
      setOpEstagios(ops ?? []);
      if (orc?.estagio_id) setCrmEstagioAtual((crm ?? []).find((e: any) => e.id === orc.estagio_id) ?? null);
      if (pedido.estagio_operacional_id) setOpAtual((ops ?? []).find((e: any) => e.id === pedido.estagio_operacional_id) ?? null);
    })();
  }, [pedido?.id, pedido?.estagio_operacional_id, pedido?.orcamento_id]);

  const moverOp = async (novoId: string) => {
    const { error } = await supabase.from("pedidos").update({ estagio_operacional_id: novoId }).eq("id", pedido.id);
    if (error) return toast.error(error.message);
    toast.success("Estágio operacional atualizado");
    setOpAtual(opEstagios.find((e: any) => e.id === novoId) ?? null);
  };

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[12px] font-semibold">P</div>
        <div>
          <h3 className="font-playfair text-[18px] font-semibold leading-none">Pipelines & Estágios</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Posição deste pedido nos kanbans ativos</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-lg p-3 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Kanban Comercial (CRM)</div>
          <div className="flex items-center gap-2">
            {crmEstagioAtual ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: crmEstagioAtual.cor || "#888" }} />
                <span className="font-semibold text-[14px]">{crmEstagioAtual.nome}</span>
              </>
            ) : (
              <span className="text-[12px] text-muted-foreground">Não vinculado</span>
            )}
            {crmEstagios.length > 0 && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {crmEstagioAtual ? `${(crmEstagios.findIndex((e: any) => e.id === crmEstagioAtual.id) + 1)}/${crmEstagios.length}` : `0/${crmEstagios.length}`}
              </span>
            )}
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Kanban Operacional (Produção)</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: opAtual?.cor || "#94a3b8" }} />
            <span className="font-semibold text-[14px] truncate">{opAtual?.nome || "Não iniciado"}</span>
            {opEstagios.length > 0 && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {opAtual ? `${opAtual.ordem}/${opEstagios.length}` : `0/${opEstagios.length}`}
              </span>
            )}
          </div>
          {opEstagios.length > 0 && (
            <select
              value={opAtual?.id || ""}
              onChange={(e) => moverOp(e.target.value)}
              className="mt-2 w-full text-[12px] border border-border rounded px-2 py-1 bg-background"
            >
              <option value="" disabled>Selecione um estágio…</option>
              {opEstagios.map((e: any) => (
                <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================== */
/*           CONTRATO — barra de envio e confirmação              */
/* ============================================================== */
function ContratoEnvioBar({ contrato, cliente, pedido, onChange }: any) {
  const [uploading, setUploading] = useState(false);
  const signingUrl = `${window.location.origin}/contrato/${contrato.signing_token}`;

  const marcarEnviado = async (via: "email" | "whatsapp" | "link") => {
    await supabase.from("contratos").update({ enviado_em: new Date().toISOString(), enviado_via: via }).eq("id", contrato.id);
    onChange();
  };

  const copiarLink = async () => {
    await navigator.clipboard.writeText(signingUrl);
    toast.success("Link copiado");
    marcarEnviado("link");
  };

  const enviarEmail = () => {
    if (!cliente?.email) return toast.error("Cliente sem e-mail cadastrado");
    const assunto = encodeURIComponent(`Contrato ${contrato.numero} - assinatura`);
    const corpo = encodeURIComponent(
      `Olá ${cliente?.nome || ""},\n\nSegue o link para assinatura digital do seu contrato:\n${signingUrl}\n\nObrigado!`
    );
    window.open(`mailto:${cliente.email}?subject=${assunto}&body=${corpo}`, "_blank");
    marcarEnviado("email");
  };

  const enviarWhatsapp = () => {
    if (!cliente?.telefone) return toast.error("Cliente sem telefone cadastrado");
    const fone = String(cliente.telefone).replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${cliente?.nome || ""}, segue o link para assinatura do contrato ${contrato.numero}: ${signingUrl}`
    );
    window.open(`https://wa.me/55${fone}?text=${msg}`, "_blank");
    marcarEnviado("whatsapp");
  };

  const anexarPdfAssinado = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${contrato.id}/assinado-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("contratos-assinatura").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("contratos-assinatura").getPublicUrl(path);
      const { error: e2 } = await supabase.from("contratos").update({
        status: "assinado",
        assinado_em: new Date().toISOString(),
        assinatura_nome: cliente?.nome || "Assinatura manual (impressa)",
        metodo_assinatura: "manual",
        pdf_assinado_url: pub.publicUrl,
      }).eq("id", contrato.id);
      if (e2) throw e2;
      toast.success("Contrato impresso assinado anexado e confirmado");
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao anexar PDF assinado");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
      <div className="text-[12px] text-amber-900 font-medium">
        Contrato <b>{contrato.numero}</b> aguardando assinatura — workflow operacional bloqueado.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copiarLink}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
        </Button>
        <Button size="sm" variant="outline" onClick={enviarEmail}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar por e-mail
        </Button>
        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" onClick={enviarWhatsapp}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar por WhatsApp
        </Button>
        <label className="inline-flex">
          <input type="file" accept="application/pdf,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) anexarPdfAssinado(f); }} />
          <Button asChild size="sm" variant="outline" className="text-amber-800 border-amber-400 cursor-pointer" disabled={uploading}>
            <span><FileUp className="w-3.5 h-3.5 mr-1.5" /> {uploading ? "Anexando…" : "Anexar contrato impresso assinado"}</span>
          </Button>
        </label>
      </div>
      {contrato.enviado_em && (
        <div className="text-[11px] text-amber-800">
          Enviado via {contrato.enviado_via} em {new Date(contrato.enviado_em).toLocaleString("pt-BR")}.
        </div>
      )}
    </div>
  );
}

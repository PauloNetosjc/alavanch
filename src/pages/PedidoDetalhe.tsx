import { useEffect, useMemo, useRef, useState } from "react";
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
  Folder, Send, Copy, Trash2, ChevronDown, ChevronUp, FileUp, Sparkles, PenLine, ExternalLink, Eye, PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { parsePromobTxt } from "@/lib/promobParser";
import { diffPromobItems, type DiffResult } from "@/lib/promobDiff";
import { ItensAvulsosManager } from "@/components/ItensAvulsosManager";
import { AgendaEventoDialog } from "@/components/agenda/AgendaEventoDialog";
import { TarefasPanel } from "@/components/tarefas/TarefasPanel";
import { NovaSolicitacaoAssinaturaDialog } from "@/components/assinaturas/NovaSolicitacaoAssinaturaDialog";
import { EvidenciasDialog } from "@/components/assinaturas/EvidenciasDialog";
import { AssinarPelaLojaDialog } from "@/components/assinaturas/AssinarPelaLojaDialog";
import { VisualizarAssinaturasDialog } from "@/components/assinaturas/VisualizarAssinaturasDialog";
import { Badge } from "@/components/ui/badge";
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { PedidoEtiquetas } from "@/components/PedidoEtiquetas";
import { prepararContratoParaAssinatura } from "@/lib/contratoAssinaturaDoc";
import { baixarPdfFinalAssinatura } from "@/lib/assinaturaPdfDownload";

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

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
  const [gerandoContrato, setGerandoContrato] = useState(false);
  const [contratoRecemGerado, setContratoRecemGerado] = useState(false);
  const [orcamento, setOrcamento] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [contrato, setContrato] = useState<any>(null);
  const [solicAssin, setSolicAssin] = useState<any>(null);
  const [pastas, setPastas] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [chat, setChat] = useState<any[]>([]);
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [pedidoPai, setPedidoPai] = useState<any>(null);
  const [adendos, setAdendos] = useState<any[]>([]);
  const [complementos, setComplementos] = useState<any[]>([]);
  const [criandoAdendo, setCriandoAdendo] = useState(false);
  const [criandoComplemento, setCriandoComplemento] = useState(false);
  const [pedidoOrigemComplemento, setPedidoOrigemComplemento] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [vendedor, setVendedor] = useState<any>(null);
  const [responsavel, setResponsavel] = useState<any>(null);
  const [itensAvulsos, setItensAvulsos] = useState<any[]>([]);
  const [subItens, setSubItens] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);

  const totalProjeto = useMemo(() => {
    // Valor final negociado do pedido (com descontos aplicados); fallback à soma original.
    const negociado = Number(pedido?.valor_total || 0);
    if (negociado > 0) return negociado;
    return (
      ambientes.reduce((s, a) => s + Number(a.preco_sugerido || 0), 0) +
      itensAvulsos.reduce((s, i) => s + Number(i.valor_venda || 0), 0)
    );
  }, [pedido, ambientes, itensAvulsos]);

  const carregar = async () => {
    if (!id) return;
    const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
    if (!ped) { setLoading(false); return; }
    setPedido(ped);

    const orcId = ped.orcamento_id;
    const raizId = ped.pedido_pai_id || ped.pedido_origem_complemento_id || (id as string);
    const PROJ_VIRTUAL_ID = "__virtual_projetos_importados__";

    // === DISPARA TODAS AS CONSULTAS EM PARALELO ===
    const [
      orcRes, cliRes, ctRes, iasRes, pstRes, dcsRes, orcDocsRes,
      chRes, rvRes, profRes, paiRes, origemRes, filhosAdRes, filhosCompRes,
      ljRes, solsRes,
    ] = await Promise.all([
      orcId ? supabase.from("orcamentos").select("*").eq("id", orcId).maybeSingle() : Promise.resolve({ data: null } as any),
      ped.cliente_id ? supabase.from("clientes").select("*").eq("id", ped.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
      orcId ? supabase.from("contratos").select("*").eq("orcamento_id", orcId).neq("status", "cancelado").order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null } as any),
      supabase.from("pedido_itens_avulsos").select("*").eq("pedido_id", id).order("ordem"),
      supabase.from("pedido_pastas").select("*").eq("pedido_id", id).order("ordem"),
      supabase.from("pedido_documentos").select("*").eq("pedido_id", id).order("created_at", { ascending: false }),
      orcId ? supabase.from("orcamento_documentos" as any).select("*").eq("orcamento_id", orcId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] } as any),
      supabase.from("pedido_chat").select("*").eq("pedido_id", id).order("created_at"),
      supabase.from("pedido_revisoes").select("*").eq("pedido_id", id).order("created_at"),
      supabase.from("profiles").select("user_id, nome_completo").eq("ativo", true),
      ped.pedido_pai_id ? supabase.from("pedidos").select("id, codigo, valor_total").eq("id", ped.pedido_pai_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ped.pedido_origem_complemento_id ? supabase.from("pedidos").select("id, codigo").eq("id", ped.pedido_origem_complemento_id).maybeSingle() : Promise.resolve({ data: null } as any),
      supabase.from("pedidos").select("id, codigo, valor_total, status, created_at").eq("pedido_pai_id", raizId).order("created_at"),
      supabase.from("pedidos").select("id, codigo, valor_total, status, created_at").eq("pedido_origem_complemento_id", raizId).order("created_at"),
      ped.loja_id ? supabase.from("lojas").select("*").eq("id", ped.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
      supabase.from("solicitacoes_assinatura").select("*, tipos_documento(nome,slug,requer_assinatura_loja)").eq("pedido_id", id).order("created_at", { ascending: false }),
    ]);

    const orc = orcRes.data;
    setOrcamento(orc);
    setCliente(cliRes.data);
    setContrato(ctRes.data);
    setItensAvulsos(iasRes.data || []);
    setChat(chRes.data || []);
    setRevisoes(rvRes.data || []);
    setUsuarios(profRes.data || []);
    setPedidoPai(paiRes.data);
    setPedidoOrigemComplemento(origemRes.data);
    setAdendos(filhosAdRes.data || []);
    setComplementos(filhosCompRes.data || []);
    setLoja(ljRes.data);
    setSolicitacoes(solsRes.data || []);

    // === SEGUNDO NÍVEL (depende dos primeiros resultados) — também em paralelo ===
    const ambsP = orc
      ? supabase.from("ambientes").select("*").eq("orcamento_id", orc.id).order("ordem")
      : Promise.resolve({ data: [] } as any);
    const pagsP = orc
      ? supabase.from("pagamentos_orcamento").select("*").eq("orcamento_id", orc.id)
      : Promise.resolve({ data: [] } as any);
    const ct = ctRes.data;
    const saP = ct
      ? supabase.from("solicitacoes_assinatura").select("*").eq("pedido_id", id).eq("contrato_id", ct.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null } as any);

    const [ambsRes, pagsRes, saRes] = await Promise.all([ambsP, pagsP, saP]);
    const ambs = ambsRes.data || [];
    setAmbientes(ambs);
    setPagamentos(pagsRes.data || []);

    // Sub-itens dos ambientes
    const ambIds = ambs.map((a: any) => a.id);
    if (ambIds.length) {
      supabase.from("sub_itens_ambiente").select("*").in("ambiente_id", ambIds)
        .then(({ data }) => setSubItens(data || []));
    } else {
      setSubItens([]);
    }

    // Pastas padrão — cria as faltantes
    let pst = pstRes.data || [];
    const padroes = ["Projetos/PDF", "Documentos", "Check-in Obra", "Fotos/Entrega"];
    const faltando = padroes.filter((nome) => !pst!.some((p: any) => p.nome.toLowerCase() === nome.toLowerCase()));
    if (faltando.length) {
      const baseOrdem = pst.length;
      const novas = faltando.map((nome, i) => ({ pedido_id: id, nome, ordem: baseOrdem + i }));
      const { data: criadas } = await supabase.from("pedido_pastas").insert(novas).select("*");
      pst = [...pst, ...(criadas || [])];
    }
    setPastas([{ id: PROJ_VIRTUAL_ID, nome: "Projetos Importados", _virtual: true }, ...pst]);

    // Documentos (combina orcamento + pedido)
    const orcDocsMapped = (orcDocsRes.data || []).map((d: any) => ({
      ...d,
      pasta_id: PROJ_VIRTUAL_ID,
      _bucket: "orcamento-docs",
      _readonly: true,
      nome: d.origem === "promob_import" ? `[Promob] ${d.nome}` : d.origem === "xml_import" ? `[XML] ${d.nome}` : d.origem === "excel_import" ? `[Excel] ${d.nome}` : d.nome,
    }));
    setDocs([...orcDocsMapped, ...(dcsRes.data || [])]);

    // Solicitação de assinatura mais recente — prepara contrato se necessário (não bloqueia render)
    const sa = saRes.data;
    if (sa && (!sa.pedido_documento_id || !sa.loja_assinado_em)) {
      setGerandoContrato(true);
      prepararContratoParaAssinatura(sa.id)
        .then(() => { setContratoRecemGerado(true); })
        .catch((e) => { console.warn("[contrato] auto-preparar falhou:", e?.message || e); })
        .finally(async () => {
          // Revalida solicitação, documentos, contrato e pedido SEM depender de realtime
          await recarregarAssinatura();
          setGerandoContrato(false);
        });
    }
    setSolicAssin(sa);

    // Vendedor / Responsável
    const vendedorId = orc?.vendedor_id;
    const responsavelId = ped.projetista_id || ped.estagio_responsavel_id;
    const userIds = [vendedorId, responsavelId].filter(Boolean) as string[];
    if (userIds.length) {
      supabase.from("profiles").select("user_id, nome_completo, cargo").in("user_id", userIds)
        .then(({ data }) => {
          const profs = data || [];
          setVendedor(profs.find((p: any) => p.user_id === vendedorId) || null);
          setResponsavel(profs.find((p: any) => p.user_id === responsavelId) || null);
        });
    } else { setVendedor(null); setResponsavel(null); }

    setLoading(false);
  };

  // Reload focado em assinatura/documentos — usado após prepararContratoParaAssinatura,
  // sem depender de realtime que pode atrasar ou falhar.
  const recarregarAssinatura = async () => {
    if (!id) return;
    const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
    if (ped) setPedido((prev: any) => ({ ...(prev || {}), ...ped }));
    const orcId = ped?.orcamento_id;
    const [ctRes, dcsRes, solsRes, saRes] = await Promise.all([
      orcId ? supabase.from("contratos").select("*").eq("orcamento_id", orcId).neq("status", "cancelado").order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null } as any),
      supabase.from("pedido_documentos").select("*").eq("pedido_id", id).order("created_at", { ascending: false }),
      supabase.from("solicitacoes_assinatura").select("*, tipos_documento(nome,slug,requer_assinatura_loja)").eq("pedido_id", id).order("created_at", { ascending: false }),
      supabase.from("solicitacoes_assinatura").select("*").eq("pedido_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setContrato(ctRes.data);
    // Preserva docs virtuais (orçamento) e substitui docs do pedido
    setDocs((prev) => {
      const virtuais = (prev || []).filter((d: any) => d._readonly);
      return [...virtuais, ...((dcsRes.data as any[]) || [])];
    });
    setSolicitacoes(solsRes.data || []);
    setSolicAssin(saRes.data || null);
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` }, (payload) => {
        // Sincroniza alterações vindas dos kanbans (estagio_*) ou outros pontos
        if (payload.new) setPedido((prev: any) => ({ ...(prev || {}), ...(payload.new as any) }));
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

  /* ----- criar adendo (novo orçamento atrelado ao pedido RAIZ) ----- */
  const criarAdendo = async () => {
    if (!pedido || !pedido.orcamento_id) return;
    // adendos sempre nascem a partir do pedido raiz (pai), nunca de outro adendo
    const raizId = pedido.pedido_pai_id || pedido.id;
    const raiz = pedido.pedido_pai_id ? (pedidoPai || { id: raizId, codigo: "" }) : pedido;
    if (!confirm("Criar um novo Adendo deste pedido?\n\nO adendo é uma atualização vinculada ao pedido original. Ele gera um novo contrato e novos lançamentos financeiros, mas continua acessível dentro do mesmo pedido (em uma aba).")) return;
    setCriandoAdendo(true);
    try {
      const { data: orcRaiz } = await supabase.from("orcamentos").select("*").eq("id", pedido.orcamento_id).maybeSingle();
      if (!orcRaiz) throw new Error("Orçamento original não encontrado");
      // numeração do adendo é por pedido raiz
      const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("pedido_pai_id", raizId);
      const seq = ((count || 0) + 1).toString().padStart(2, "0");
      const novoCodigo = `${orcRaiz.codigo}-ADD-${seq}`;
      const { data: novoOrc, error } = await supabase.from("orcamentos").insert({
        codigo: novoCodigo,
        cliente_id: orcRaiz.cliente_id,
        loja_id: orcRaiz.loja_id,
        nome_projeto: `[ADENDO ${seq} de ${raiz.codigo || ""}] ${orcRaiz.nome_projeto || ""}`,
        status: "negociacao",
        subtotal: 0, total: 0,
        parceiro_id: orcRaiz.parceiro_id, parceiro_perc: orcRaiz.parceiro_perc,
        consultor_id: orcRaiz.consultor_id, vendedor_id: orcRaiz.vendedor_id, origem_id: orcRaiz.origem_id,
        is_adendo: true,
        pedido_origem_id: raizId,
        created_by: user?.id,
      } as any).select().maybeSingle();
      if (error || !novoOrc) throw error || new Error("Falha ao criar adendo");
      toast.success(`Adendo ${novoCodigo} criado — finalize-o e ele aparecerá como aba dentro do pedido ${raiz.codigo || ""}`);
      navigate(`/comercial/${novoOrc.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar adendo");
    } finally {
      setCriandoAdendo(false);
    }
  };

  /* ----- criar complemento (novo orçamento/pedido autônomo, apenas referencia o original) ----- */
  const criarComplemento = async () => {
    if (!pedido || !pedido.orcamento_id) return;
    if (!confirm("Criar um Complemento deste pedido?\n\nO complemento é uma NOVA venda do mesmo ambiente — gera um pedido próprio (CP-…), com contrato e financeiro independentes. O pedido original fica apenas como referência nas observações.")) return;
    setCriandoComplemento(true);
    try {
      const { data: orcOriginal } = await supabase.from("orcamentos").select("*").eq("id", pedido.orcamento_id).maybeSingle();
      if (!orcOriginal) throw new Error("Orçamento original não encontrado");

      // Sequência por pedido_origem_complemento_id (apenas para o nome do projeto / código do orçamento)
      const { count } = await supabase.from("orcamentos")
        .select("id", { count: "exact", head: true })
        .eq("pedido_origem_complemento_id", pedido.id);
      const seq = ((count || 0) + 1).toString().padStart(2, "0");
      const year = new Date().getFullYear();
      const { count: yearCount } = await supabase.from("orcamentos").select("id", { count: "exact", head: true })
        .gte("created_at", `${year}-01-01`).lt("created_at", `${year + 1}-01-01`);
      const novoCodigoOrc = `ORC-${year}-${String((yearCount || 0) + 1).padStart(4, "0")}`;

      const { data: novoOrc, error } = await supabase.from("orcamentos").insert({
        codigo: novoCodigoOrc,
        cliente_id: orcOriginal.cliente_id,
        loja_id: orcOriginal.loja_id,
        nome_projeto: `[COMPLEMENTO ${seq} de ${pedido.codigo}] ${orcOriginal.nome_projeto || ""}`,
        status: "negociacao",
        subtotal: 0, total: 0,
        parceiro_id: orcOriginal.parceiro_id, parceiro_perc: orcOriginal.parceiro_perc,
        consultor_id: orcOriginal.consultor_id, vendedor_id: orcOriginal.vendedor_id, origem_id: orcOriginal.origem_id,
        is_complemento: true,
        pedido_origem_complemento_id: pedido.id,
        
        created_by: user?.id,
      } as any).select().maybeSingle();
      if (error || !novoOrc) throw error || new Error("Falha ao criar complemento");
      toast.success(`Complemento criado — finalize o orçamento para gerar o pedido CP-…`);
      navigate(`/comercial/${novoOrc.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar complemento");
    } finally {
      setCriandoComplemento(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground text-[13px]">Carregando…</div>;
  if (!pedido) return <div className="text-center py-20 text-muted-foreground text-[13px]">Pedido não encontrado.</div>;

  const assinaturaPendente = contrato && contrato.status === "aguardando_assinatura" && solicAssin?.status !== "concluido";
  const stageIndex = WF_STAGES.findIndex(s => s.key === pedido.workflow_estagio);

  const ehAdendo = !!pedido.pedido_pai_id;
  const ehComplemento = !!pedido.pedido_origem_complemento_id;
  const temAdendos = adendos.length > 0;
  const temComplementos = complementos.length > 0;

  // ---- Status global da Revisão do Projeto (crítico antes de avançar pipelines) ----
  const revisaoStatus: { kind: "none" | "sem_revisao" | "diferenca" | "aguardando" | "aprovado"; message: string } = (() => {
    if (!ambientes.length) return { kind: "none", message: "" };
    const latestPerAmb = ambientes.map((a: any) => {
      const revs = revisoes.filter((r: any) => r.ambiente_id === a.id)
        .sort((x: any, y: any) => (y.versao ?? 0) - (x.versao ?? 0));
      return { amb: a, latest: revs[0] || null };
    });
    if (latestPerAmb.some((x: any) => !x.latest))
      return { kind: "sem_revisao", message: "Falta revisar o projeto — envie a revisão do Promob de cada ambiente antes de avançar." };
    const comDif = latestPerAmb.find((x: any) => !x.latest.aprovada && Math.abs(Number(x.latest.variacao_perc || 0)) > 0);
    if (comDif) return { kind: "diferenca", message: "Houve diferença na revisão — negocie o complemento ou aprove a revisão para seguir o processo." };
    const naoAprov = latestPerAmb.find((x: any) => !x.latest.aprovada);
    if (naoAprov) return { kind: "aguardando", message: "Revisão sem diferenças — aguardando aprovação para liberar os pipelines." };
    return { kind: "aprovado", message: "" };
  })();
  const revisaoPendente = revisaoStatus.kind !== "aprovado" && revisaoStatus.kind !== "none";
  const raizParaTabs = pedidoPai
    ? { id: pedidoPai.id, codigo: pedidoPai.codigo }
    : pedidoOrigemComplemento
    ? { id: pedidoOrigemComplemento.id, codigo: pedidoOrigemComplemento.codigo }
    : { id: pedido.id, codigo: pedido.codigo };
  // abas: pedido raiz + adendos + complementos (todos vinculados)
  const abas = [
    { ...raizParaTabs, tipo: "raiz" as const },
    ...adendos.map((a: any) => ({ id: a.id, codigo: a.codigo, tipo: "adendo" as const })),
    ...complementos.map((c: any) => ({ id: c.id, codigo: c.codigo, tipo: "complemento" as const })),
  ];

  return (
    <div className="space-y-5">
      {/* Banner de geração/assinatura automática do contrato */}
      {gerandoContrato && (
        <div className="rounded-md border border-indigo-300 bg-indigo-50 text-indigo-900 px-4 py-2.5 flex items-center gap-2 text-[13px] font-medium shadow-sm">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          Gerando contrato e assinando pela loja…
        </div>
      )}
      {!gerandoContrato && contratoRecemGerado && solicAssin?.status === "assinado_loja" && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-2.5 flex items-center gap-2 text-[13px] font-medium shadow-sm">
          ✅ Contrato gerado • Loja assinada automaticamente • Aguardando assinatura do cliente
        </div>
      )}
      {/* TARJA VERMELHA — adendos vinculados */}
      {(temAdendos || ehAdendo) && (
        <div className="rounded-md bg-red-600 text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {ehAdendo ? (
            <span>
              Você está visualizando um <b>ADENDO</b> ({pedido.codigo}) do pedido{" "}
              {pedidoPai && (
                <Link to={`/pedidos/${pedidoPai.id}`} className="underline font-semibold hover:text-white/90">
                  {pedidoPai.codigo}
                </Link>
              )}.
            </span>
          ) : (
            <span>
              Este pedido possui <b>{adendos.length}</b> adendo{adendos.length > 1 ? "s" : ""} vinculado{adendos.length > 1 ? "s" : ""} — acesse{" "}
              {adendos.map((a: any, i: number) => (
                <span key={a.id}>
                  <Link to={`/pedidos/${a.id}`} className="underline font-semibold hover:text-white/90">{a.codigo}</Link>
                  {i < adendos.length - 1 ? ", " : ""}
                </span>
              ))}{" "}pelas abas abaixo.
            </span>
          )}
        </div>
      )}

      {/* TARJA — REVISÃO DO PROJETO PENDENTE (bloqueia avanço) */}
      {revisaoPendente && (
        <div className={`rounded-md text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-medium shadow-sm ${
          revisaoStatus.kind === "aguardando" ? "bg-amber-600" : "bg-red-600"
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{revisaoStatus.message}</span>
        </div>
      )}

      {/* HEADER COMPACTO */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/comercial" className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h1 className="font-playfair text-[42px] leading-tight font-semibold">{pedido.codigo}</h1>
            <PedidoEtiquetas pedidoId={pedido.id} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{cliente?.nome || "—"}</span>
            {assinaturaPendente && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="w-3.5 h-3.5" /> Assinatura pendente
              </span>
            )}
            {ehAdendo && (
              <span className="inline-flex items-center gap-1 text-red-700 font-semibold px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                <Sparkles className="w-3.5 h-3.5" /> Adendo {pedidoPai ? `de ${pedidoPai.codigo}` : ""}
              </span>
            )}
            {ehComplemento && pedidoOrigemComplemento && (
              <Link to={`/pedidos/${pedidoOrigemComplemento.id}`}
                className="inline-flex items-center gap-1 text-emerald-700 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
                <FileText className="w-3.5 h-3.5" /> Complemento de {pedidoOrigemComplemento.codigo}
              </Link>
            )}
          </div>
          {assinaturaPendente && contrato && (
            <ContratoEnvioBar contrato={contrato} cliente={cliente} pedido={pedido} solic={solicAssin} pastas={pastas} onChange={recarregarAssinatura} setGerando={setGerandoContrato} setRecemGerado={setContratoRecemGerado} />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-[13px]">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Urgência</span>
            <select
              value={pedido.urgencia || "baixa"}
              onChange={(e) => salvarPedido({ urgencia: e.target.value })}
              className={`bg-transparent text-[13px] font-medium outline-none cursor-pointer ${
                pedido.urgencia === "alta" ? "text-red-600" :
                pedido.urgencia === "media" ? "text-amber-600" : "text-emerald-700"
              }`}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <PedidoAcoesMenu
            pedido={pedido}
            orcamento={orcamento}
            ambientes={ambientes}
            pagamentos={pagamentos}
            contrato={contrato}
            ehAdendo={ehAdendo}
            criandoAdendo={criandoAdendo}
            criandoComplemento={criandoComplemento}
            criarAdendo={criarAdendo}
            criarComplemento={criarComplemento}
            salvarPedido={salvarPedido}
            navigate={navigate}
          />
        </div>
      </div>

      {/* ABAS — pedido raiz + adendos + complementos */}
      {abas.length > 1 && (
        <div className="flex items-center gap-1 border-b overflow-x-auto">
          {abas.map((a: any) => {
            const ativo = a.id === pedido.id;
            const isRaiz = a.tipo === "raiz";
            const isComp = a.tipo === "complemento";
            const sufixo = isRaiz ? " · Original" : isComp ? " · Complemento" : " · Adendo";
            return (
              <Link
                key={a.id}
                to={`/pedidos/${a.id}`}
                className={`px-4 py-2 text-[13px] font-medium uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap ${
                  ativo
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {isRaiz ? <FileText className="w-3.5 h-3.5 inline mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />}
                {a.codigo}{sufixo}
              </Link>
            );
          })}
        </div>
      )}

      {/* PAINEL PRINCIPAL — DADOS DO PEDIDO + CLIENTE/LOJA */}
      <PedidoHeaderPanel
        pedido={pedido}
        orcamento={orcamento}
        cliente={cliente}
        loja={loja}
        contrato={contrato}
        vendedor={vendedor}
        responsavel={responsavel}
        adendos={adendos}
        usuarios={usuarios}
        salvarPedido={salvarPedido}
      />

      {/* (vínculo entre pedido raiz e adendos foi movido para a tarja vermelha + abas no topo) */}

      {/* PIPELINES & ESTÁGIOS */}
      {/* REVISÃO PRECEDE OS PIPELINES enquanto não estiver aprovada */}
      {revisaoPendente && (
        <RevisaoPromob pedido={pedido} ambientes={ambientes} revisoes={revisoes} cliente={cliente} onChange={carregar} />
      )}

      <PipelinesPanel pedido={pedido} />

      {/* CRONOGRAMA E DATAS */}
      <Cronograma pedido={pedido} salvarPedido={salvarPedido} onIniciar={iniciarWorkflow} />


      {/* TAREFAS ASSOCIADAS AO PEDIDO */}
      <TarefasPanel pedidoId={pedido.id} scope="pedido" title="Tarefas do Pedido" />

      {/* NOTAS + CHAT INTERNO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Observacoes pedido={pedido} />
        <ChatInterno pedidoId={pedido.id} userId={user?.id || ""} chat={chat} usuarios={usuarios} onSent={carregar} />
      </div>

      {/* CENTRAL DE DOCUMENTOS (com assinaturas integradas por documento) */}
      <CentralDocs
        pedidoId={pedido.id}
        pastas={pastas}
        docs={docs}
        solicitacoes={solicitacoes}
        cliente={cliente}
        onChange={carregar}
      />


      {/* PRODUTOS — lista detalhada (ambientes + itens avulsos) com sub-itens importados */}
      <ProdutosTabela ambientes={ambientes} subItens={subItens} itensAvulsos={itensAvulsos} total={totalProjeto} />

      {/* PARCELAS — fluxo financeiro */}
      <ParcelasTabela pagamentos={pagamentos} total={totalProjeto} />

      {/* Resumo Financeiro removido — toda gestão financeira do pedido vive no módulo Financeiro */}

      {/* AVISO: edição de pedido fechado gera Adendo ou Complemento */}
      <section className="rounded-lg border border-purple-300 bg-purple-50 p-4 flex items-start gap-3 flex-wrap">
        <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[300px] text-[13px] text-purple-900">
          <div className="font-semibold mb-0.5">Pedido fechado — use Adendo ou Complemento</div>
          <div>
            Este pedido não pode ser editado diretamente. Use <b>Adendo (AD-…)</b> para um aditivo no mesmo
            contrato (diferença de valor, mesmo financeiro) ou <b>Complemento (CP-…)</b> para uma venda
            nova do mesmo ambiente com contrato e financeiro próprios — apenas referencia este pedido.
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={criarAdendo} disabled={criandoAdendo} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Sparkles className="w-4 h-4 mr-1.5" /> {criandoAdendo ? "Criando…" : "Criar Adendo"}
          </Button>
          {!ehAdendo && (
            <Button onClick={criarComplemento} disabled={criandoComplemento} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <FileText className="w-4 h-4 mr-1.5" /> {criandoComplemento ? "Criando…" : "Criar Complemento"}
            </Button>
          )}
        </div>
      </section>




      {/* IMPORTAR REVISÃO PROMOB */}
      {!revisaoPendente && (
        <RevisaoPromob pedido={pedido} ambientes={ambientes} revisoes={revisoes} cliente={cliente} onChange={carregar} />
      )}
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
function Observacoes({ pedido }: any) {
  const text = pedido.observacoes_venda || "";
  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-amber-600" />
        <h3 className="font-playfair text-[18px] font-semibold">Notas</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        {text ? "Notas definidas na geração do pedido — incluídas no contrato." : "Nenhuma nota foi adicionada na geração do pedido."}
      </p>
      <div className="flex-1 min-h-[160px] bg-amber-50/30 border border-amber-200 rounded-md p-3 text-[13px] whitespace-pre-wrap text-foreground/80">
        {text || <span className="text-muted-foreground italic">Sem notas.</span>}
      </div>
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
function CentralDocs({ pedidoId, pastas, docs, solicitacoes = [], cliente, onChange }: any) {
  const [pastaAtiva, setPastaAtiva] = useState<string | null>(pastas[0]?.id || null);
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);
  const [assinaturaOpen, setAssinaturaOpen] = useState<any>(null);
  const [renomearPasta, setRenomearPasta] = useState<any>(null);
  const [novaAssinDoc, setNovaAssinDoc] = useState<any>(null);
  const [evidId, setEvidId] = useState<string | null>(null);
  const [assinarLojaId, setAssinarLojaId] = useState<string | null>(null);
  const [verAssinaturasId, setVerAssinaturasId] = useState<string | null>(null);
  const [partsBySol, setPartsBySol] = useState<Record<string, any[]>>({});

  // Mapa: pedido_documento_id -> última solicitação
  const solicByDoc = useMemo(() => {
    const m: Record<string, any> = {};
    for (const s of solicitacoes) if (s.pedido_documento_id && !m[s.pedido_documento_id]) m[s.pedido_documento_id] = s;
    return m;
  }, [solicitacoes]);

  // Carrega participantes das solicitações visíveis
  useEffect(() => {
    const ids = Array.from(new Set((solicitacoes || []).map((s: any) => s.id))).filter(Boolean);
    if (!ids.length) { setPartsBySol({}); return; }
    (async () => {
      const { data } = await supabase
        .from("assinatura_participantes" as any)
        .select("id,solicitacao_id,tipo,status,assinado_em,nome,email,token")
        .in("solicitacao_id", ids);
      const map: Record<string, any[]> = {};
      for (const p of ((data as any[]) || [])) {
        (map[p.solicitacao_id] ||= []).push(p);
      }
      setPartsBySol(map);
    })();
  }, [solicitacoes]);


  // Contagem por pasta
  const countByPasta = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of docs) if (d.pasta_id) m[d.pasta_id] = (m[d.pasta_id] || 0) + 1;
    return m;
  }, [docs]);

  // Pasta "Documentos" (onde o contrato é salvo)
  const pastaDocumentosId = useMemo(
    () => pastas.find((p: any) => !p._virtual && /^documentos$/i.test(p.nome))?.id || null,
    [pastas]
  );

  // Existe contrato salvo?
  const temContrato = useMemo(
    () => docs.some((d: any) =>
      (pastaDocumentosId && d.pasta_id === pastaDocumentosId) &&
      (d.solicitacao_id || /contrato/i.test(d.nome || ""))
    ),
    [docs, pastaDocumentosId]
  );

  // Regra de pasta ativa: se há contrato, abre em Documentos; senão, primeira pasta
  useEffect(() => {
    if (pastaAtiva) return;
    if (temContrato && pastaDocumentosId) setPastaAtiva(pastaDocumentosId);
    else if (pastas[0]) setPastaAtiva(pastas[0].id);
  }, [pastas, pastaAtiva, temContrato, pastaDocumentosId]);

  // Quando um contrato chega via realtime, alterna para Documentos
  const prevContratoRef = useRef(false);
  useEffect(() => {
    if (temContrato && !prevContratoRef.current && pastaDocumentosId) {
      setPastaAtiva(pastaDocumentosId);
    }
    prevContratoRef.current = temContrato;
  }, [temContrato, pastaDocumentosId]);

  // Mapa: solicitacao_id -> doc final (bucket assinaturas-finais)
  const finalDocBySol = useMemo(() => {
    const m: Record<string, any> = {};
    for (const d of docs) {
      if (d.bucket_name === "assinaturas-finais" && d.solicitacao_id) {
        if (!m[d.solicitacao_id] || new Date(d.created_at) > new Date(m[d.solicitacao_id].created_at)) {
          m[d.solicitacao_id] = d;
        }
      }
    }
    return m;
  }, [docs]);

  // Sanitiza .pdf.pdf duplicado em qualquer nome exibido
  const sanitizeNome = (nome: string) => (nome || "").replace(/\.pdf\.pdf$/i, ".pdf");

  // Esconde da listagem o doc final quando existir o original na mesma solicitação
  const docsDaPasta = docs.filter((d: any) => {
    if (d.pasta_id !== pastaAtiva) return false;
    if (d.bucket_name === "assinaturas-finais" && d.solicitacao_id) {
      const temOriginal = docs.some(
        (o: any) =>
          o.id !== d.id &&
          o.solicitacao_id === d.solicitacao_id &&
          o.bucket_name !== "assinaturas-finais",
      );
      if (temOriginal) return false;
    }
    return true;
  });

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
    const tipoSlug = (doc.tipo_documento_slug as string) || "projeto_inicial";
    const { data, error } = await supabase.rpc("criar_solic_assinatura_documento", {
      p_pedido_id: pedidoId,
      p_pedido_documento_id: doc.id,
      p_tipo_slug: tipoSlug,
      p_dias_validade: 30,
    });
    if (error) { toast.error(error.message); return; }
    const solicId = data as string;
    // Garante participantes (trigger já dispara, redundância segura) e busca token do cliente
    await supabase.rpc("ensure_participants_for_solicitation" as any, { p_solic: solicId });
    const { data: partCliente } = await supabase
      .from("assinatura_participantes" as any)
      .select("token")
      .eq("solicitacao_id", solicId)
      .eq("tipo", "cliente")
      .maybeSingle();
    const tokenCliente = (partCliente as any)?.token as string | undefined;
    if (!tokenCliente) { toast.error("Não foi possível obter o link de assinatura."); return; }
    await supabase.from("pedido_documentos").update({ enviado_para_assinatura: true }).eq("id", doc.id);
    setAssinaturaOpen({ ...doc, signing_token: tokenCliente });
    toast.success("Solicitação de assinatura criada");
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
              {p.nome} <span className="opacity-70 ml-1">({p._virtual ? (docs.filter((d:any)=>d.pasta_id===p.id).length) : (countByPasta[p.id] || 0)})</span>
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
        ) : docsDaPasta.map((d: any) => {
          const sol = solicByDoc[d.id];
          const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
            rascunho: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
            aguardando_cliente: { label: "Aguardando cliente", tone: "bg-amber-100 text-amber-800" },
            assinado_cliente: { label: "Cliente assinou", tone: "bg-blue-100 text-blue-800" },
            aguardando_loja: { label: "Aguardando loja", tone: "bg-indigo-100 text-indigo-800" },
            assinado_loja: { label: "Loja assinou", tone: "bg-blue-100 text-blue-800" },
            concluido: { label: "Concluído", tone: "bg-emerald-100 text-emerald-800" },
            recusado: { label: "Recusado", tone: "bg-red-100 text-red-800" },
            cancelado: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
            expirado: { label: "Expirado", tone: "bg-muted text-muted-foreground" },
          };
          const st = sol ? (STATUS_LABEL[sol.status] || { label: sol.status, tone: "bg-muted" }) : null;
          const requerLoja = sol?.tipos_documento?.requer_assinatura_loja;
          const assinaturaCompleta = !!sol?.cliente_assinado_em && (!requerLoja || !!sol?.loja_assinado_em) && sol?.status === "concluido";
          const podeAssinarLoja = sol && requerLoja && !sol.loja_assinado_em && !["concluido", "cancelado", "recusado", "expirado"].includes(sol.status);
          // Token do participante (nunca solicitação) — buscado sob demanda
          const getTokenParticipante = async (tipo: "cliente" | "loja"): Promise<string | null> => {
            if (!sol) return null;
            await supabase.rpc("ensure_participants_for_solicitation" as any, { p_solic: sol.id });
            const { data: p } = await supabase
              .from("assinatura_participantes" as any)
              .select("token")
              .eq("solicitacao_id", sol.id)
              .eq("tipo", tipo)
              .maybeSingle();
            return (p as any)?.token || null;
          };
          const copiarLinkPart = async (tipo: "cliente" | "loja") => {
            const t = await getTokenParticipante(tipo);
            if (!t) return toast.error(`Sem participante ${tipo}.`);
            await navigator.clipboard.writeText(getPublicSignatureUrl(t));
            toast.success(`Link da ${tipo === "loja" ? "loja" : "cliente"} copiado`);
          };
          const abrirLinkPart = async (tipo: "cliente" | "loja") => {
            const t = await getTokenParticipante(tipo);
            if (!t) return toast.error(`Sem participante ${tipo}.`);
            window.open(getPublicSignatureUrl(t), "_blank");
          };
          const partes = (sol && partsBySol[sol.id]) || [];
          const partesReq = partes.filter((p: any) => p.tipo === "cliente" || (p.tipo === "loja" && requerLoja !== false));
          const assinadosCount = partesReq.filter((p: any) => !!p.assinado_em).length;
          const totalCount = partesReq.length;
          return (
            <div key={d.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg border bg-card">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium flex items-center gap-2 flex-wrap">
                    <span className="truncate">{d.nome}</span>
                    {st && <Badge className={`${st.tone} text-[10px] px-1.5 py-0 font-medium`}>{st.label}</Badge>}
                    {sol && totalCount > 0 && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${assinadosCount === totalCount ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300"}`}>
                        Assinaturas: {assinadosCount}/{totalCount}
                      </Badge>
                    )}
                    {requerLoja && <Badge variant="outline" className="text-[10px] px-1.5 py-0">requer loja</Badge>}
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    {fmtDateTime(d.created_at)}
                    {sol?.cliente_assinado_em && ` • Cliente: ${new Date(sol.cliente_assinado_em).toLocaleString("pt-BR")}`}
                    {sol?.loja_assinado_em && ` • Loja: ${new Date(sol.loja_assinado_em).toLocaleString("pt-BR")}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {!sol && !d._readonly && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => enviarParaAssinatura(d)} title="Gerar link rápido">
                      <Send className="w-3.5 h-3.5 mr-1" /> Gerar link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setNovaAssinDoc(d)} title="Solicitar assinatura (avançado)">
                      <PenLine className="w-3.5 h-3.5 mr-1" /> Solicitar
                    </Button>
                  </>
                )}
                {sol && (
                  <>
                    {requerLoja && (
                      <Button size="sm" variant="outline" onClick={() => copiarLinkPart("loja")} title="Copiar link da loja">
                        <Copy className="w-3.5 h-3.5 mr-1" /> Link loja
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copiarLinkPart("cliente")} title="Copiar link do cliente">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Link cliente
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrirLinkPart("cliente")} title="Abrir link do cliente">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setVerAssinaturasId(sol.id)} title="Ver assinaturas e links">
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver assinaturas
                    </Button>
                    {podeAssinarLoja && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAssinarLojaId(sol.id)}>
                        <PenLine className="w-3.5 h-3.5 mr-1" /> Assinar pela loja
                      </Button>
                    )}
                    {assinaturaCompleta && (
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => baixarPdfFinalAssinatura(sol.id, d.nome)}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Baixar completo
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="ghost" title="Baixar PDF" onClick={async () => {
                  try {
                    if (sol && assinaturaCompleta) {
                      await baixarPdfFinalAssinatura(sol.id, d.nome);
                      return;
                    }
                    const bucket = d._bucket || d.bucket_name || "pedido-docs";
                    const path = d.storage_path;
                    const baseName = (d.nome || (path?.split("/").pop() ?? "arquivo")).replace(/\.(html?|txt|pdf)$/i, "");
                    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
                    if (error || !blob) throw error || new Error("Falha ao baixar");

                    const isHtml = /\.html?$/i.test(path || "") || blob.type.includes("html") || blob.type.includes("text");
                    if (isHtml) {
                      const html = await blob.text();
                      const container = document.createElement("div");
                      container.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
                      // extrai apenas o body se possível
                      const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                      container.innerHTML = m ? m[1] : html;
                      // injeta estilos do <style> presentes no html
                      const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(s => s[1]).join("\n");
                      if (styles) {
                        const st = document.createElement("style");
                        st.textContent = styles;
                        container.prepend(st);
                      }
                      document.body.appendChild(container);
                      const html2pdf = (await import("html2pdf.js")).default;
                      await html2pdf().set({
                        margin: 10,
                        filename: `${baseName}.pdf`,
                        image: { type: "jpeg", quality: 0.95 },
                        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                      } as any).from(container).save();
                      container.remove();
                    } else {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = baseName;
                      document.body.appendChild(a); a.click(); a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                  } catch (e: any) {
                    toast.error("Erro ao baixar: " + (e?.message || "desconhecido"));
                  }
                }}><FileText className="w-4 h-4" /></Button>
                {!d._readonly && (
                  <Button size="sm" variant="ghost" onClick={() => removerDoc(d.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
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
            const url = getPublicSignatureUrl(assinaturaOpen.signing_token);
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

      <NovaSolicitacaoAssinaturaDialog
        open={!!novaAssinDoc}
        onOpenChange={(v) => !v && setNovaAssinDoc(null)}
        pedidoId={pedidoId}
        defaults={novaAssinDoc ? {
          pedido_documento_id: novaAssinDoc.id,
          file_name: novaAssinDoc.nome,
          storage_path: novaAssinDoc.storage_path,
        } : undefined}
        onCreated={() => { setNovaAssinDoc(null); onChange(); }}
      />

      {evidId && (
        <EvidenciasDialog open={!!evidId} onOpenChange={(v) => !v && setEvidId(null)} solicitacaoId={evidId} />
      )}
      <AssinarPelaLojaDialog
        open={!!assinarLojaId}
        onOpenChange={(v) => !v && setAssinarLojaId(null)}
        solicitacaoId={assinarLojaId}
        onDone={() => { setAssinarLojaId(null); onChange(); }}
      />
      <VisualizarAssinaturasDialog
        open={!!verAssinaturasId}
        onOpenChange={(v) => !v && setVerAssinaturasId(null)}
        solicitacaoId={verAssinaturasId}
        pedidoId={pedidoId}
        onAssinarLoja={(id) => { setVerAssinaturasId(null); setAssinarLojaId(id); }}
        onChange={onChange}
      />
    </section>
  );
}

/* ============================================================== */
/*                  PRODUTOS — TABELA (image style)               */
/* ============================================================== */
function ProdutosTabela({ ambientes, subItens, itensAvulsos, total }: any) {
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  type Linha = {
    id: string; tipo: "Ambiente" | "Avulso"; codigo?: string | null;
    descricao: string; quantidade: number; unitario: number; total: number;
    descLonga?: string | null; sub?: any[];
  };
  const somaOriginal =
    (ambientes || []).reduce((s: number, a: any) => s + Number(a.preco_sugerido || 0), 0) +
    (itensAvulsos || []).reduce((s: number, i: any) => s + Number(i.valor_venda || 0), 0);
  // Escala proporcional para refletir o valor final negociado (com desconto).
  const fator = somaOriginal > 0 && total > 0 ? total / somaOriginal : 1;
  const linhas: Linha[] = [
    ...ambientes.map((a: any) => {
      const subs = (subItens || []).filter((s: any) => s.ambiente_id === a.id);
      const v = Number(a.preco_sugerido || 0) * fator;
      return {
        id: a.id, tipo: "Ambiente" as const, codigo: null,
        descricao: a.nome, quantidade: 1, unitario: v, total: v,
        descLonga: a.descricao, sub: subs,
      };
    }),
    ...(itensAvulsos || []).map((i: any) => {
      const v = Number(i.valor_venda || 0) * fator;
      return {
        id: i.id, tipo: "Avulso" as const, codigo: null,
        descricao: i.nome, quantidade: 1,
        unitario: v, total: v,
        descLonga: i.descricao, sub: [],
      };
    }),
  ];

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider">Produtos</h2>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Total</div>
          <div className="text-[22px] font-semibold text-emerald-700">{fmtBrl(total)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 pr-2 w-10">#</th>
              <th className="text-left py-2 pr-2 w-24">Código</th>
              <th className="text-left py-2 pr-2 w-24">Tipo</th>
              <th className="text-left py-2 pr-2">Descrição</th>
              <th className="text-right py-2 pr-2 w-24">Quantidade</th>
              <th className="text-right py-2 pr-2 w-32">Preço unitário</th>
              <th className="text-right py-2 w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => {
              const exp = !!aberto[l.id];
              const podeExpandir = (l.sub && l.sub.length > 0) || !!l.descLonga;
              return (
                <>
                  <tr key={l.id} className="border-b hover:bg-muted/20">
                    <td className="py-3 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 pr-2 text-muted-foreground">{l.codigo || "—"}</td>
                    <td className="py-3 pr-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        l.tipo === "Avulso" ? "bg-red-500 text-white" : "bg-emerald-600 text-white"
                      }`}>{l.tipo}</span>
                    </td>
                    <td className="py-3 pr-2">
                      <button
                        onClick={() => podeExpandir && setAberto({ ...aberto, [l.id]: !exp })}
                        className={`text-left uppercase ${podeExpandir ? "hover:underline cursor-pointer" : "cursor-default"}`}
                      >
                        {l.descricao}
                        {podeExpandir && (exp
                          ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
                          : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />)}
                      </button>
                    </td>
                    <td className="py-3 pr-2 text-right">{l.quantidade} un</td>
                    <td className="py-3 pr-2 text-right">{fmtBrl(l.unitario)}</td>
                    <td className="py-3 text-right font-medium">{fmtBrl(l.total)}</td>
                  </tr>
                  {exp && (
                    <tr className="bg-muted/20 border-b">
                      <td colSpan={7} className="py-3 px-4">
                        {l.descLonga && (
                          <div className="text-[12px] text-muted-foreground whitespace-pre-wrap mb-2">{l.descLonga}</div>
                        )}
                        {l.sub && l.sub.length > 0 && (
                          <table className="w-full text-[12px]">
                            <thead className="text-[10px] uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left py-1 pr-2">Código</th>
                                <th className="text-left py-1 pr-2">Categoria</th>
                                <th className="text-left py-1 pr-2">Descrição</th>
                                <th className="text-right py-1 pr-2">Qtd</th>
                                <th className="text-right py-1">Custo cliente</th>
                              </tr>
                            </thead>
                            <tbody>
                              {l.sub.map((s: any) => (
                                <tr key={s.id} className="border-t border-border/50">
                                  <td className="py-1 pr-2">{s.codigo || "—"}</td>
                                  <td className="py-1 pr-2">{s.categoria || "—"}</td>
                                  <td className="py-1 pr-2">{s.descricao}</td>
                                  <td className="py-1 pr-2 text-right">{s.quantidade || 1}</td>
                                  <td className="py-1 text-right">{fmtBrl(Number(s.custo_cliente || 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {!linhas.length && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum item.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={6} className="py-3 text-right text-[12px] uppercase tracking-wider text-muted-foreground">Valor final</td>
              <td className="py-3 text-right font-semibold text-emerald-700">{fmtBrl(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ============================================================== */
/*                  PARCELAS — FLUXO FINANCEIRO                   */
/* ============================================================== */
function ParcelasTabela({ pagamentos, total }: any) {
  // expande pagamentos em parcelas individuais com data
  const linhas: { idx: number; data: string | null; metodo: string; valor: number; documento?: string | null }[] = [];
  (pagamentos || []).forEach((p: any) => {
    const n = p.parcelas || 1;
    const det: number[] = Array.isArray(p.parcelas_detalhe) && p.parcelas_detalhe.length === n
      ? p.parcelas_detalhe.map(Number)
      : (() => {
          const base = Number((Number(p.valor) / n).toFixed(2));
          const arr = Array(n).fill(base);
          arr[n - 1] = Number((Number(p.valor) - base * (n - 1)).toFixed(2));
          return arr;
        })();
    const vencsNeg: (string | null)[] = Array.isArray(p.parcelas_vencimentos) && p.parcelas_vencimentos.length === n
      ? p.parcelas_vencimentos.map((v: any) => (v ? String(v).slice(0, 10) : null))
      : [];
    const formasNeg: string[] = Array.isArray(p.parcelas_formas) && p.parcelas_formas.length === n
      ? p.parcelas_formas.map((f: any) => String(f || ""))
      : [];
    const venc = p.data_vencimento ? new Date(p.data_vencimento + "T00:00:00") : null;
    for (let i = 0; i < n; i++) {
      let dt: string | null = vencsNeg[i] || null;
      if (!dt && venc) {
        const d = new Date(venc);
        d.setMonth(d.getMonth() + i);
        dt = d.toISOString().slice(0, 10);
      }
      const metodoLinha = formasNeg[i] || p.metodo;
      linhas.push({ idx: linhas.length + 1, data: dt, metodo: metodoLinha, valor: det[i] || 0 });
    }
  });
  const somaParcelas = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider">Parcelas</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 pr-2 w-10">#</th>
              <th className="text-left py-2 pr-2 w-32">Data</th>
              <th className="text-left py-2 pr-2">Forma de pagamento</th>
              <th className="text-left py-2 pr-2 w-40">Documento</th>
              <th className="text-right py-2 w-32">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.idx} className="border-b hover:bg-muted/20">
                <td className="py-3 pr-2 text-muted-foreground">{l.idx}</td>
                <td className="py-3 pr-2">{l.data ? new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                <td className="py-3 pr-2">{String(l.metodo || "").replace(/\s*\d+x(\s*a\s*\d+x)?\s*$/i, "").trim() || "—"}</td>
                <td className="py-3 pr-2 text-muted-foreground">—</td>
                <td className="py-3 text-right font-medium">{fmtBrl(l.valor)}</td>
              </tr>
            ))}
            {!linhas.length && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma parcela cadastrada.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={4} className="py-3 text-right text-[12px] uppercase tracking-wider text-muted-foreground">Total</td>
              <td className="py-3 text-right font-semibold">{fmtBrl(somaParcelas || total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ============================================================== */
/*                RESUMO FINANCEIRO DO PEDIDO                     */
/* ============================================================== */
function ResumoFinanceiroPedido({ pedido, ambientes, salvarPedido }: any) {
  const [lancs, setLancs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataPag, setDataPag] = useState<string>(pedido.data_pagamento_fabrica || "");
  const [savingDate, setSavingDate] = useState(false);
  const [marcandoEnvio, setMarcandoEnvio] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, data_vencimento, data_pagamento, status, categoria_id")
      .eq("pedido_id", pedido.id)
      .order("data_vencimento", { ascending: true });
    setLancs(data || []);
    setLoading(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [pedido.id, pedido.workflow_estagio, pedido.data_envio_fabrica]);
  useEffect(() => { setDataPag(pedido.data_pagamento_fabrica || ""); }, [pedido.data_pagamento_fabrica]);

  const custoFabricaProjetado = (ambientes || []).reduce(
    (s: number, a: any) => s + (Number(a.custo_fabrica) || 0), 0
  );

  const entradas = lancs.filter((l) => l.tipo === "entrada");
  const saidas = lancs.filter((l) => l.tipo === "saida");
  const totalEntradas = entradas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const recebido = entradas.filter((l) => l.status === "pago" || l.status === "conciliado").reduce((s, l) => s + Number(l.valor || 0), 0);
  const pago = saidas.filter((l) => l.status === "pago" || l.status === "conciliado").reduce((s, l) => s + Number(l.valor || 0), 0);

  const fabricaJaGerada = saidas.some((l) => /custo fábrica/i.test(l.descricao || ""));

  const salvarDataPagamento = async () => {
    setSavingDate(true);
    await salvarPedido({ data_pagamento_fabrica: dataPag || null });
    setSavingDate(false);
    toast.success("Data de pagamento à fábrica salva");
  };

  const marcarEnvioFabrica = async () => {
    if (fabricaJaGerada) { toast.info("Cobrança já foi gerada"); return; }
    setMarcandoEnvio(true);
    await salvarPedido({
      data_envio_fabrica: new Date().toISOString().slice(0, 10),
      data_pagamento_fabrica: dataPag || null,
    });
    setMarcandoEnvio(false);
    toast.success("Envio à fábrica registrado — cobrança gerada");
    setTimeout(carregar, 600);
  };

  const statusBadge = (s: string) => {
    const map: any = {
      pendente: "bg-amber-50 text-amber-700 border-amber-200",
      pago: "bg-emerald-50 text-emerald-700 border-emerald-200",
      conciliado: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelado: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${map[s] || "bg-muted text-muted-foreground"}`}>{s || "—"}</span>;
  };

  return (
    <section className="surface-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider">Resumo Financeiro</h2>
          <p className="text-[12px] text-muted-foreground">Receitas e custos vinculados ao pedido — sincronizado com o Financeiro</p>
        </div>
        <Link to={`/pedidos/${pedido.id}/receita`} className="text-[12px] text-[#1F5235] hover:underline inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Ver receita
        </Link>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-emerald-50/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-700">A Receber (entradas)</div>
          <div className="text-[18px] font-semibold text-emerald-700">{fmtBrl(totalEntradas)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Recebido: {fmtBrl(recebido)}</div>
        </div>
        <div className="rounded-lg border bg-rose-50/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-rose-700">Custo Fábrica (gerado)</div>
          <div className="text-[18px] font-semibold text-rose-700">{fmtBrl(totalSaidas)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Pago: {fmtBrl(pago)}</div>
        </div>
        <div className="rounded-lg border bg-amber-50/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-700">Custo Fábrica (projetado)</div>
          <div className="text-[18px] font-semibold text-amber-700">{fmtBrl(custoFabricaProjetado)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Soma dos ambientes</div>
        </div>
        <div className="rounded-lg border bg-[#1F5235]/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#1F5235]">Margem Projetada</div>
          <div className="text-[18px] font-semibold text-[#1F5235]">{fmtBrl(totalEntradas - custoFabricaProjetado)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Receita − custo fábrica</div>
        </div>
      </div>

      {/* Pagamento à fábrica */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data de Pagamento à Fábrica</Label>
            <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className="mt-1.5 h-9" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Fica em aberto até você definir. Usada como vencimento da cobrança da fábrica.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={salvarDataPagamento} disabled={savingDate}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salvar data
          </Button>
          <Button
            size="sm"
            onClick={marcarEnvioFabrica}
            disabled={marcandoEnvio || fabricaJaGerada}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Factory className="w-3.5 h-3.5 mr-1" />
            {fabricaJaGerada ? "Cobrança gerada" : marcandoEnvio ? "Gerando…" : "Marcar envio à fábrica (gerar cobrança)"}
          </Button>
        </div>
        {pedido.data_envio_fabrica && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Envio à fábrica registrado em <b>{fmtDate(pedido.data_envio_fabrica)}</b>.
          </p>
        )}
      </div>

      {/* Lançamentos vinculados */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Lançamentos vinculados</h3>
          <Link to={`/financeiro?busca=${encodeURIComponent(pedido.codigo)}`} className="text-[11px] text-[#2D6BE5] hover:underline">
            Abrir no Financeiro →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 pr-2 w-24">Tipo</th>
                <th className="text-left py-2 pr-2">Descrição</th>
                <th className="text-left py-2 pr-2 w-28">Vencimento</th>
                <th className="text-left py-2 pr-2 w-24">Status</th>
                <th className="text-right py-2 w-28">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && lancs.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum lançamento ainda. Receitas são geradas ao confirmar o pedido; custo de fábrica ao marcar o envio.</td></tr>
              )}
              {lancs.map((l) => (
                <tr key={l.id} className="border-b hover:bg-muted/20">
                  <td className="py-2 pr-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${l.tipo === "entrada" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {l.tipo}
                    </span>
                  </td>
                  <td className="py-2 pr-2">{l.descricao}</td>
                  <td className="py-2 pr-2">{fmtDate(l.data_vencimento)}</td>
                  <td className="py-2 pr-2">{statusBadge(l.status)}</td>
                  <td className={`py-2 text-right font-medium ${l.tipo === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{fmtBrl(Number(l.valor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  const negociarComplemento = async (rev: any) => {
    // Cria um COMPLEMENTO (nova venda independente referenciando o pedido original) com a DIFERENÇA da revisão
    if (!pedido.orcamento_id) return;
    const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", pedido.orcamento_id).maybeSingle();
    if (!orc) return;
    const valorOriginal = Number(rev.valor_original || 0);
    const valorRevisado = Number(rev.valor_revisado || 0);
    const valorDif = Math.max(0, valorRevisado - valorOriginal);
    const ambOrig = ambientes.find((a: any) => a.id === rev.ambiente_id);
    const nomeAmbOrig = ambOrig?.nome || "Ambiente";

    const year = new Date().getFullYear();
    const { count: yearCount } = await supabase.from("orcamentos").select("id", { count: "exact", head: true })
      .gte("created_at", `${year}-01-01`).lt("created_at", `${year + 1}-01-01`);
    const novoCodigoOrc = `ORC-${year}-${String((yearCount || 0) + 1).padStart(4, "0")}`;

    const { data: novo, error } = await supabase.from("orcamentos").insert({
      codigo: novoCodigoOrc,
      cliente_id: orc.cliente_id, loja_id: orc.loja_id,
      nome_projeto: `[COMPLEMENTO REVISÃO de ${pedido.codigo}] ${orc.nome_projeto || ""}`,
      status: "negociacao", subtotal: valorDif, total: valorDif,
      parceiro_id: orc.parceiro_id, parceiro_perc: orc.parceiro_perc,
      consultor_id: orc.consultor_id, vendedor_id: orc.vendedor_id, origem_id: orc.origem_id,
      is_complemento: true,
      pedido_origem_complemento_id: pedido.id,
      created_by: user?.id,
    } as any).select().maybeSingle();
    if (error || !novo) return toast.error(error?.message || "Erro");

    await supabase.from("ambientes").insert({
      orcamento_id: novo.id,
      nome: `Acréscimo (revisão v${rev.versao}): ${nomeAmbOrig}`,
      descricao: `Diferença gerada pela revisão do projeto.\nValor original: ${fmtBrl(valorOriginal)}\nValor revisado: ${fmtBrl(valorRevisado)}\nAcréscimo: ${fmtBrl(valorDif)}`,
      preco_sugerido: valorDif,
      custo_aquisicao: 0,
      ordem: 0,
    });

    toast.success(`Complemento criado com diferença de ${fmtBrl(valorDif)}`);
    navigate(`/comercial/${novo.id}/negociacao`);
  };

  // Todas as revisões aprovadas? (impede novos uploads e mostra status verde)
  const todasAprovadas = ambientes.length > 0 && ambientes.every((a: any) => {
    const revs = revisoes.filter((r: any) => r.ambiente_id === a.id).sort((x: any, y: any) => (y.versao ?? 0) - (x.versao ?? 0));
    return revs[0]?.aprovada === true;
  });

  return (
    <section className={`surface-card p-6 ${todasAprovadas ? "border-2 border-emerald-300 bg-emerald-50/30" : ""}`}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-playfair text-[20px] font-semibold uppercase tracking-wider">
          {todasAprovadas ? "Revisão do Projeto" : "Importar Revisão do Projeto"}
        </h2>
        {todasAprovadas && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[12px] font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Revisão aprovada
          </span>
        )}
      </div>

      <div className="space-y-3">
        {ambientes.map((amb: any) => {
          const revs = revisoes.filter((r: any) => r.ambiente_id === amb.id);
          const latest = [...revs].sort((x: any, y: any) => (y.versao ?? 0) - (x.versao ?? 0))[0];
          const ambAprovado = latest?.aprovada === true;
          return (
            <div key={amb.id} className={`border rounded-lg p-4 ${ambAprovado ? "border-emerald-300 bg-emerald-50/50" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {amb.nome}
                    {ambAprovado && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Original: <b>{fmtBrl(Number(amb.preco_sugerido || 0))}</b></div>
                </div>
                {ambAprovado ? (
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                    ✓ Aprovada
                  </span>
                ) : (
                  <label>
                    <input type="file" accept=".txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarRevisao(amb, f); }} />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2D6BE5] hover:bg-[#2459C9] text-white text-[12px] font-semibold cursor-pointer">
                      <FileUp className="w-4 h-4" /> {enviando === amb.id ? "Enviando…" : "Enviar"}
                    </span>
                  </label>
                )}
              </div>

              {/* Tabs de revisões */}
              {revs.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {revs.map((r: any) => (
                      <button key={r.id} onClick={() => setVerRevisao(r)} className={`px-3 py-1 rounded-md border text-[11px] ${r.aprovada ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"}`}>
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
                onNegociarComplemento={() => { negociarComplemento(verRevisao); setVerRevisao(null); }}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RevisaoDiffView({ rev, ambienteNome, onAprovar, onNegociarComplemento }: any) {
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
              <Button onClick={onNegociarComplemento} className="bg-purple-600 hover:bg-purple-700">
                <Sparkles className="w-4 h-4 mr-1.5" /> Negociar Complemento ({fmtBrl(totals.variacao)})
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
const OP_PIPELINES: Array<{ key: string; label: string; pipeline: string; column: string }> = [
  { key: "pos_venda",   label: "Pós-Venda e Financeiro", pipeline: "pos_venda",   column: "estagio_pos_venda_id" },
  { key: "revisao",     label: "Revisão de Projeto",     pipeline: "revisao",     column: "estagio_revisao_id" },
  { key: "montagem",    label: "Montagem",               pipeline: "montagem",    column: "estagio_montagem_id" },
  { key: "fabrica",     label: "Fábrica",                pipeline: "fabrica",     column: "estagio_fabrica_id" },
];

function PipelinesPanel({ pedido }: { pedido: any }) {
  const [crmEstagios, setCrmEstagios] = useState<any[]>([]);
  const [crmEstagioAtual, setCrmEstagioAtual] = useState<any>(null);
  const [pipelines, setPipelines] = useState<Record<string, any[]>>({});
  const [atuais, setAtuais] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!pedido) return;
    (async () => {
      const [{ data: orc }, { data: crm }, { data: allEst }] = await Promise.all([
        pedido.orcamento_id
          ? supabase.from("orcamentos").select("estagio_id").eq("id", pedido.orcamento_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("crm_estagios").select("id, nome, cor, ordem").eq("ativo", true).order("ordem"),
        supabase.from("pipeline_estagios").select("id, nome, cor, ordem, pipeline").eq("ativo", true).order("ordem"),
      ]);
      setCrmEstagios(crm ?? []);
      if (orc?.estagio_id) setCrmEstagioAtual((crm ?? []).find((e: any) => e.id === orc.estagio_id) ?? null);

      const byPipeline: Record<string, any[]> = {};
      const ats: Record<string, any> = {};
      for (const p of OP_PIPELINES) {
        const list = (allEst ?? []).filter((e: any) => e.pipeline === p.pipeline);
        byPipeline[p.key] = list;
        const currentId = pedido[p.column];
        if (currentId) ats[p.key] = list.find((e: any) => e.id === currentId) ?? null;
      }
      setPipelines(byPipeline);
      setAtuais(ats);
    })();
  }, [pedido?.id, pedido?.orcamento_id, pedido?.estagio_operacional_id, pedido?.estagio_pos_venda_id, pedido?.estagio_revisao_id, pedido?.estagio_montagem_id, pedido?.estagio_fabrica_id]);

  const mover = async (col: string, novoId: string, key: string) => {
    const { error } = await supabase.from("pedidos").update({ [col]: novoId } as any).eq("id", pedido.id);
    if (error) return toast.error(error.message);
    toast.success("Estágio atualizado");
    setAtuais((a) => ({ ...a, [key]: pipelines[key].find((e: any) => e.id === novoId) ?? null }));
  };

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[12px] font-semibold">P</div>
        <div>
          <h3 className="font-playfair text-[18px] font-semibold leading-none">Pipelines & Estágios</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Posição deste pedido em cada kanban ativo</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link to="/kanban-comercial" className="border rounded-lg p-3 bg-muted/20 block hover:bg-muted/40 hover:border-foreground/30 transition-colors">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 underline-offset-2 hover:underline">Kanban Comercial (CRM)</div>
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
        </Link>
        {OP_PIPELINES.map((p) => {
          const list = pipelines[p.key] ?? [];
          const atual = atuais[p.key];
          return (
            <div key={p.key} className="border rounded-lg p-3 bg-muted/20">
              <Link to={`/kanban-${p.key.replace("_", "-")}`} className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 hover:underline underline-offset-2 hover:text-foreground">
                Kanban {p.label}
              </Link>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: atual?.cor || "#94a3b8" }} />
                <span className="font-semibold text-[14px] truncate">{atual?.nome || "Não iniciado"}</span>
                {list.length > 0 && (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {atual ? `${atual.ordem}/${list.length}` : `0/${list.length}`}
                  </span>
                )}
              </div>
              {list.length > 0 && (
                <select
                  value={atual?.id || ""}
                  onChange={(e) => mover(p.column, e.target.value, p.key)}
                  className="mt-2 w-full text-[12px] border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="" disabled>Selecione um estágio…</option>
                  {list.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================== */
/*           CONTRATO — barra de envio e confirmação              */
/* ============================================================== */
function ContratoEnvioBar({ contrato, cliente, pedido, solic, pastas, onChange, setGerando, setRecemGerado }: any) {
  const [criando, setCriando] = useState(false);
  const [tokens, setTokens] = useState<{ cliente?: string; loja?: string }>({});

  // Carrega tokens dos PARTICIPANTES (nunca solicitacao.token)
  useEffect(() => {
    (async () => {
      if (!solic?.id) { setTokens({}); return; }
      await supabase.rpc("ensure_participants_for_solicitation" as any, { p_solic: solic.id });
      const { data: parts } = await supabase
        .from("assinatura_participantes" as any)
        .select("tipo,token")
        .eq("solicitacao_id", solic.id);
      const map: any = {};
      for (const p of (parts as any[]) || []) map[p.tipo] = p.token;
      setTokens(map);
    })();
  }, [solic?.id]);

  const linkCliente = tokens.cliente ? getPublicSignatureUrl(tokens.cliente) : null;
  const linkLoja = tokens.loja ? getPublicSignatureUrl(tokens.loja) : null;

  const criarSolicitacao = async () => {
    setCriando(true);
    setGerando?.(true);
    try {
      const { data, error } = await supabase.rpc("auto_criar_solic_contrato", {
        p_pedido_id: pedido.id, p_contrato_id: contrato.id,
      });
      if (error) throw error;
      if (data) toast.success("Solicitação de assinatura criada");
      if (data) await prepararContratoParaAssinatura(data as string);
      setRecemGerado?.(true);
      await onChange();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar solicitação");
    } finally {
      setCriando(false);
      setGerando?.(false);
    }
  };

  const copiar = async (url: string | null, label: string) => {
    if (!url) return toast.error("Link indisponível.");
    await navigator.clipboard.writeText(url);
    toast.success(`Link da ${label} copiado`);
  };

  const enviarEmail = () => {
    if (!linkCliente) return toast.error("Link do cliente indisponível.");
    if (!cliente?.email) return toast.error("Cliente sem e-mail cadastrado");
    const assunto = encodeURIComponent(`Contrato ${contrato.numero} - assinatura`);
    const corpo = encodeURIComponent(
      `Olá ${cliente?.nome || ""},\n\nSegue o link para assinatura digital do seu contrato:\n${linkCliente}\n\nObrigado!`
    );
    window.open(`mailto:${cliente.email}?subject=${assunto}&body=${corpo}`, "_blank");
  };

  const enviarWhatsapp = () => {
    if (!linkCliente) return toast.error("Link do cliente indisponível.");
    if (!cliente?.telefone) return toast.error("Cliente sem telefone cadastrado");
    const fone = String(cliente.telefone).replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${cliente?.nome || ""}, segue o link para assinatura do contrato ${contrato.numero}: ${linkCliente}`
    );
    window.open(`https://wa.me/55${fone}?text=${msg}`, "_blank");
  };

  const statusLabel = solic?.status
    ? ({
        aguardando_cliente: "Aguardando cliente assinar",
        assinado_cliente: "Cliente assinou — aguardando loja",
        aguardando_loja: "Aguardando loja assinar",
        assinado_loja: "Loja assinou",
        concluido: "Concluído",
        recusado: "Recusado pelo cliente",
        cancelado: "Cancelado",
        expirado: "Link expirado",
        rascunho: "Rascunho",
      } as Record<string, string>)[solic.status]
    : "Sem solicitação no novo módulo";

  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
      <div className="text-[12px] text-amber-900 font-medium">
        Contrato <b>{contrato.numero}</b> aguardando assinatura — workflow operacional bloqueado.
      </div>
      <div className="text-[11px] text-amber-800">
        Status assinatura: <b>{statusLabel}</b>
      </div>
      {!solic && (
        <Button size="sm" variant="outline" onClick={criarSolicitacao} disabled={criando}>
          {criando ? "Criando…" : "Criar solicitação de assinatura"}
        </Button>
      )}
      {solic && (
        <div className="flex flex-wrap gap-2">
          {linkLoja && (
            <Button size="sm" variant="outline" onClick={() => copiar(linkLoja, "loja")}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link da loja
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => copiar(linkCliente, "cliente")}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link do cliente
          </Button>
          <Button size="sm" variant="outline" onClick={enviarEmail}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar por e-mail
          </Button>
          <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" onClick={enviarWhatsapp}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar por WhatsApp
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            setGerando?.(true);
            try {
              toast.loading("Regenerando PDF do contrato…", { id: "regen-ct" });
              await prepararContratoParaAssinatura(solic.id);
              toast.success("PDF do contrato regenerado", { id: "regen-ct" });
              setRecemGerado?.(true);
              await onChange();
            } catch (e: any) {
              toast.error(e?.message || "Erro ao regenerar contrato", { id: "regen-ct" });
            } finally {
              setGerando?.(false);
            }
          }}>
            🔄 Regenerar PDF
          </Button>
        </div>
      )}
      {solic?.created_at && (
        <div className="text-[11px] text-amber-800">
          Solicitação criada em {new Date(solic.created_at).toLocaleString("pt-BR")}.
        </div>
      )}
    </div>
  );
}

/* ============================================================== */
/*               PEDIDO HEADER PANEL (modelo imagem 2)            */
/* ============================================================== */
function PedidoHeaderPanel({ pedido, orcamento, cliente, loja, contrato, vendedor, responsavel, adendos, usuarios = [], salvarPedido }: any) {
  const fluxoTrabalho = (pedido.workflow_estagio || pedido.status || "").toString().toUpperCase().replace(/_/g, " ");
  const previsaoMedicao = pedido.data_medicao_tecnica;
  const dataVenda = orcamento?.confirmado_em || pedido.created_at;
  const [editingCF, setEditingCF] = useState(false);
  const [cfDraft, setCfDraft] = useState<string>(pedido?.cliente_final || "");
  useEffect(() => { setCfDraft(pedido?.cliente_final || ""); }, [pedido?.cliente_final]);

  const Field = ({ label, children }: any) => (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[13px] font-medium truncate">{children ?? "—"}</div>
    </div>
  );
  const responsavelNome = (responsavel?.nome_completo) || (vendedor?.nome_completo) || "—";

  const salvarClienteFinal = async () => {
    setEditingCF(false);
    if ((cfDraft || "") === (pedido?.cliente_final || "")) return;
    if (salvarPedido) await salvarPedido({ cliente_final: cfDraft || null });
  };
  const trocarResponsavel = async (userId: string) => {
    if (salvarPedido) await salvarPedido({ projetista_id: userId || null });
  };

  return (
    <section className="surface-card p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Field label="Código">{pedido.codigo}</Field>
        <Field label="Data da venda">{fmtDate(dataVenda)}</Field>
        <Field label="Cliente final">
          {editingCF ? (
            <input
              autoFocus
              value={cfDraft}
              onChange={(e) => setCfDraft(e.target.value)}
              onBlur={salvarClienteFinal}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setCfDraft(pedido?.cliente_final || ""); setEditingCF(false); } }}
              className="w-full text-[13px] border border-border rounded px-1.5 py-0.5 bg-background"
            />
          ) : (
            <button onClick={() => setEditingCF(true)} className="text-left hover:bg-muted/60 rounded px-1 -mx-1 w-full truncate">
              {pedido?.cliente_final || <span className="text-muted-foreground">—</span>}
            </button>
          )}
        </Field>
        <Field label="Responsável">
          {salvarPedido ? (
            <select
              value={pedido.projetista_id || pedido.estagio_responsavel_id || ""}
              onChange={(e) => trocarResponsavel(e.target.value)}
              className="w-full text-[13px] border border-border rounded px-1 py-0.5 bg-background"
            >
              <option value="">{responsavelNome === "—" ? "Selecionar…" : responsavelNome}</option>
              {usuarios.map((u: any) => (
                <option key={u.user_id} value={u.user_id}>{u.nome_completo}</option>
              ))}
            </select>
          ) : responsavelNome}
        </Field>

        <Field label="Orçamento">
          {orcamento?.id ? (
            <Link to={`/comercial/${orcamento.id}`} className="text-primary hover:underline">{orcamento.codigo}</Link>
          ) : "—"}
        </Field>
        <Field label="Fluxo de trabalho">{fluxoTrabalho || "—"}</Field>
        <Field label="Receita">
          <Link to={`/pedidos/${pedido.id}/receita`} className="text-primary hover:underline">
            {pedido.receita_codigo ? `#${pedido.receita_codigo} · ` : ""}{fmtBrl(Number(pedido.valor_total) || 0)}
          </Link>
        </Field>
        <Field label="Previsão de medição">{fmtDate(previsaoMedicao)}</Field>
      </div>

      {/* PARA / DE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Para</div>
          <div className="font-semibold text-[14px] uppercase">{cliente?.nome || "—"}</div>
          {cliente?.telefone && <div className="text-[12px] text-muted-foreground">{cliente.telefone}</div>}
          {cliente?.email && <div className="text-[12px] text-muted-foreground">{cliente.email}</div>}
          {cliente?.cpf_cnpj && <div className="text-[12px] text-muted-foreground">{cliente.cpf_cnpj.length > 14 ? "CNPJ " : "CPF "}{cliente.cpf_cnpj}</div>}
          {cliente?.endereco_entrega && <div className="text-[12px] text-muted-foreground whitespace-pre-wrap">{cliente.endereco_entrega}</div>}
        </div>
        <div className="md:text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">De</div>
          <div className="font-semibold text-[14px] uppercase">{loja?.nome || "—"}</div>
          {loja?.sigla && <div className="text-[12px] text-muted-foreground">{loja.sigla}</div>}
          {loja?.cnpj && <div className="text-[12px] text-muted-foreground">{loja.cnpj}</div>}
          {loja?.endereco && <div className="text-[12px] text-muted-foreground">{loja.endereco}</div>}
        </div>
      </div>
    </section>
  );
}

/* ============================================================== */
/*               RESUMO FINANCEIRO DO PEDIDO (real)               */
/* ============================================================== */
function ResumoFinanceiroPedidoButton({ orcamento, ambientes, pagamentos, pedido, open: openProp, onOpenChange, hideTrigger }: any) {
  const [openInner, setOpenInner] = useState(false);
  const open = openProp !== undefined ? openProp : openInner;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenInner(v); };
  const [config, setConfig] = useState<any>(null);
  const [metodos, setMetodos] = useState<any[]>([]);
  const [parceiroNome, setParceiroNome] = useState<string>("");
  const [usarMarkup, setUsarMarkup] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const lojaId = pedido?.loja_id || orcamento?.loja_id;
      const cfgQ = lojaId
        ? supabase.from("configuracoes_empresa" as any).select("*").eq("loja_id", lojaId).maybeSingle()
        : supabase.from("configuracoes_empresa" as any).select("*").limit(1).maybeSingle();
      const [{ data: cfg }, { data: mts }] = await Promise.all([
        cfgQ,
        supabase.from("metodos_pagamento").select("nome, taxa_perc_parcela, juros_modo, parcelas_config"),
      ]);
      setConfig(cfg || null);
      setUsarMarkup(!!(cfg as any)?.usar_markup);
      setMetodos(mts || []);
      if (orcamento?.parceiro_id) {
        const { data: pc } = await supabase.from("parceiros").select("nome").eq("id", orcamento.parceiro_id).maybeSingle();
        setParceiroNome((pc as any)?.nome || "");
      } else setParceiroNome("");
    })();
  }, [open, pedido?.loja_id, orcamento?.loja_id, orcamento?.parceiro_id]);

  if (!orcamento) return null;

  // Derivados a partir dos dados reais do pedido
  const totalProposta = Number(pedido?.valor_total) || Number(orcamento?.total) || 0;
  const descPerc = Number(orcamento?.desconto_perc) || 0;
  const descValor = Number(orcamento?.desconto_valor) || 0;
  const parceiroPerc = Number(orcamento?.parceiro_perc) || 0;
  const subtotalAmbs = (ambientes || []).reduce((s: number, a: any) => s + (Number(a.preco_sugerido) || 0), 0);
  const parceiroValor = totalProposta * (parceiroPerc / 100);
  // Valor Inicial (sem indicador) e com indicador (fixo, não muda com desconto)
  const parceiroAcrescimoOrig = subtotalAmbs * (parceiroPerc / 100);
  const valorInicialSemInd = subtotalAmbs > 0 ? subtotalAmbs : (totalProposta + descValor - parceiroAcrescimoOrig);
  const valorInicialComInd = valorInicialSemInd + parceiroAcrescimoOrig;
  const custoFabrica = (ambientes || []).reduce((s: number, a: any) => s + (Number(a.custo_fabrica) || 0), 0);
  const jurosCliente = (pagamentos || []).reduce((s: number, p: any) => {
    const n = Number(p.parcelas) || 1;
    if (n <= 1) return s;
    const met = metodos.find((m: any) => m.nome === p.metodo);
    // Prioriza juros_perc da parcela configurada (% total sobre o valor financiado)
    const cfg = Array.isArray(met?.parcelas_config)
      ? met.parcelas_config.find((c: any) => Number(c?.numero) === n)
      : null;
    const jurosPerc = Number(cfg?.juros_perc) || 0;
    if (jurosPerc > 0) {
      return s + (Number(p.valor || 0) * jurosPerc) / 100;
    }
    // Fallback (legado): taxa mensal simples
    const taxa = (Number(met?.taxa_perc_parcela) || 0) / 100;
    if (!taxa) return s;
    const principal = Number(p.valor || 0) / n;
    let total = 0;
    for (let i = 1; i < n; i++) total += principal * taxa * i;
    return s + total;
  }, 0);

  const valorSemJuros = totalProposta - jurosCliente;
  const totalVPL = valorSemJuros - parceiroValor;

  // Itens fixos da Formação de Preço (alinhado com Configurações)
  const FIXED_ITEMS = [
    { key: "frete_compra_perc",  defLabel: "Frete Compra",  color: "#7C3AED", base: "vpl" as const },
    { key: "frete_venda_perc",   defLabel: "Frete",         color: "#A855F7", base: "vpl" as const },
    { key: "comissao_loja_perc", defLabel: "Comissão Loja", color: "#F59E0B", base: "vpl" as const },
    { key: "icms_compra_perc",   defLabel: "ICMS Compra",   color: "#EAB308", base: "vpl" as const },
    { key: "montagem_perc",      defLabel: "Montagem",      color: "#06B6D4", base: "vpl" as const },
    { key: "imp_saida_perc",     defLabel: "Impostos Saída",color: "#F97316", base: "venda" as const },
    { key: "outros_perc",        defLabel: "Outros",        color: "#94A3B8", base: "vpl" as const },
  ];
  const EXTRA_COLORS = ["#0EA5E9","#10B981","#EC4899","#6366F1","#14B8A6","#F43F5E","#84CC16","#D946EF"];
  const labelsCfg = (config?.formacao_preco_labels && typeof config.formacao_preco_labels === "object") ? config.formacao_preco_labels : {};
  const extrasCfg: any[] = Array.isArray(config?.formacao_preco_extras) ? config.formacao_preco_extras : [];

  // Percentuais editáveis (pré-carregados da configuração da loja)
  const [percs, setPercs] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!config) return;
    const next: Record<string, number> = {};
    FIXED_ITEMS.forEach((f) => { next[f.key] = Number((config as any)?.[f.key]) || 0; });
    extrasCfg.forEach((e: any) => { next[`extra:${e.id}`] = Number(e?.value) || 0; });
    setPercs(next);
  }, [config]);

  // Base: VPL para todos, exceto Impostos Saída (sobre Valor Total da Venda)
  const itensCusto = [
    ...FIXED_ITEMS.map((f) => {
      const label = labelsCfg[f.key] ?? f.defLabel;
      const perc = percs[f.key] ?? 0;
      const base = f.base === "venda" ? totalProposta : totalVPL;
      return { id: f.key, label, perc, color: f.color, valor: base * (perc / 100) };
    }),
    ...extrasCfg.map((e: any, idx: number) => {
      const id = `extra:${e.id}`;
      const perc = percs[id] ?? 0;
      return { id, label: e.label || "Item", perc, color: EXTRA_COLORS[idx % EXTRA_COLORS.length], valor: totalVPL * (perc / 100) };
    }),
  ];
  const setPerc = (id: string, v: number) => setPercs((p) => ({ ...p, [id]: v }));

  const totalItensCusto = itensCusto.reduce((s, i) => s + i.valor, 0);
  const totalCustos = custoFabrica + totalItensCusto;
  const lucro = totalVPL - totalCustos;
  const margem = totalProposta > 0 ? (lucro / totalProposta) * 100 : 0;
  const markup = custoFabrica > 0 ? totalVPL / custoFabrica : 0;
  const composicaoTotal = totalCustos > 0 ? totalCustos : 1;
  const pct = (v: number) => (v / composicaoTotal) * 100;

  const Field = ({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) => (
    <div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-[18px] font-semibold leading-tight" style={color ? { color } : {}}>{value}</div>
    </div>
  );
  const Row = ({ label, valor, perc, color, percValue, onPercChange, editable = true }: { label: string; valor: number; perc: number; color: string; percValue?: number; onPercChange?: (v: number) => void; editable?: boolean }) => (
    <div>
      <div className="flex items-center justify-between text-[13px] gap-2">
        <div className="flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} /><span className="truncate">{label}</span></div>
        <div className="flex items-center gap-2 shrink-0">
          {editable && onPercChange && (
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                step="0.01"
                value={percValue ?? 0}
                onChange={(e) => onPercChange(Number(e.target.value) || 0)}
                className="w-14 h-6 text-[12px] text-right bg-background border border-input rounded px-1"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>
          )}
          <span className="font-semibold tabular-nums w-24 text-right">{fmtBrl(valor)}</span>
        </div>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, perc)}%`, background: color }} />
      </div>
      <div className="text-right text-[11px] text-muted-foreground mt-0.5">{perc.toFixed(2)}% do custo</div>
    </div>
  );

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" onClick={() => setOpen(true)}>
          <PieChart className="w-4 h-4 mr-1.5" /> Resumo Financeiro
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Resumo Financeiro</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valores Principais</div>
              <Field label="Valor Inicial" value={fmtBrl(valorInicialSemInd)} />
              {parceiroPerc > 0 && (
                <Field label="Valor Inicial + Ind." value={fmtBrl(valorInicialComInd)} />
              )}
              <Field label="Descontos" color="#B83232" value={<>-{fmtBrl(descValor)} <span className="text-[12px] text-muted-foreground">({descPerc.toFixed(2)}%)</span></>} />
              {(() => {
                const descMetodo = Math.max(0, valorInicialComInd - descValor - totalProposta);
                const descMetodoPerc = valorInicialComInd > 0 ? (descMetodo / valorInicialComInd) * 100 : 0;
                if (descMetodo <= 0.01) return null;
                return (
                  <Field label="Desconto Forma Pagamento" color="#B83232" value={<>-{fmtBrl(descMetodo)} <span className="text-[12px] text-muted-foreground">({descMetodoPerc.toFixed(2)}%)</span></>} />
                );
              })()}
              <Field label="Valor Total da Venda" value={fmtBrl(totalProposta)} />
              <Field label="Juros do Cliente" color="#B83232" value={<>-{fmtBrl(jurosCliente)}</>} />
              <Field label="Valor sem Juros do Cliente" value={fmtBrl(valorSemJuros)} />
              {parceiroNome && (
                <Field label={`Indicador (${parceiroNome})`} color="#B83232" value={<>-{fmtBrl(parceiroValor)} <span className="text-[12px] text-muted-foreground">({parceiroPerc.toFixed(2)}%)</span></>} />
              )}
              <Field label="VPL (Valor Presente Líquido)" color="#16A34A" value={fmtBrl(totalVPL)} />
              {usarMarkup && (
                <div>
                  <div className="text-[12px] text-muted-foreground">Markup Médio</div>
                  <div className="text-[20px] font-semibold text-emerald-600">{markup.toFixed(2)}x</div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Composição de Custos</div>
              <div className="text-[10px] text-muted-foreground -mt-2">% sobre VPL · Impostos sobre Valor Total da Venda · edite para simular</div>
              <Row label="Fábrica" valor={custoFabrica} perc={pct(custoFabrica)} color="#3F8B5C" editable={false} />
              {itensCusto.map((i) => (
                <Row key={i.id} label={i.label} valor={i.valor} perc={pct(i.valor)} color={i.color} percValue={i.perc} onPercChange={(v) => setPerc(i.id, v)} />
              ))}
              <div className="border-t border-border pt-2 flex items-center justify-between text-[14px] font-semibold">
                <span>Total</span><span>{fmtBrl(totalCustos)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado Real</div>
              <div className="flex flex-col items-center py-2">
                <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#3F8B5C ${Math.max(0, margem)}%, #E5E7EB 0)` }}>
                  <div className="w-24 h-24 rounded-full bg-background flex flex-col items-center justify-center">
                    <div className="text-[20px] font-semibold">{margem.toFixed(1)}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">margem</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[11px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Lucro</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Custos</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">Total VPL</span><span className="font-semibold">{fmtBrl(totalVPL)}</span></div>
                <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">Total Custos</span><span className="font-semibold text-rose-600">-{fmtBrl(totalCustos)}</span></div>
                <div className="border-t border-border pt-2">
                  <div className="text-[12px] text-muted-foreground">Lucro Real</div>
                  <div className="text-[24px] font-semibold text-emerald-600">{fmtBrl(lucro)}</div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================================================== */
/*                  MENU DE AÇÕES DO PEDIDO                       */
/* ============================================================== */
function PedidoAcoesMenu({
  pedido, orcamento, ambientes, pagamentos, contrato, ehAdendo,
  criandoAdendo, criandoComplemento, criarAdendo, criarComplemento,
  salvarPedido, navigate,
}: any) {
  const [resumoOpen, setResumoOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const fazerCancelamento = async () => {
    if (confirmText.trim().toUpperCase() !== "CANCELAR") {
      toast.error('Digite "CANCELAR" para confirmar');
      return;
    }
    setCancelando(true);
    try {
      // 1) Reverte o orçamento INTEGRALMENTE para a fase de negociação
      //    (status, datas de confirmação, descontos e pagamentos)
      if (pedido?.orcamento_id) {
        const [orcRes, pagRes, contratoRes] = await Promise.all([
          supabase.from("orcamentos").update({
            status: "negociacao",
            confirmado_em: null,
            desconto_perc: 0,
            desconto_valor: 0,
          }).eq("id", pedido.orcamento_id),
          supabase.from("pagamentos_orcamento").delete().eq("orcamento_id", pedido.orcamento_id),
          supabase.from("contratos")
            .update({ status: "cancelado" })
            .eq("orcamento_id", pedido.orcamento_id)
            .neq("status", "cancelado"),
        ]);
        if (orcRes.error) throw orcRes.error;
        if (pagRes.error) throw pagRes.error;
        if (contratoRes.error) throw contratoRes.error;
      }
      // 2) Cancela o pedido e remove de todos os kanbans operacionais
      await salvarPedido({ status: "cancelado" });
      await supabase.from("kanban_cards").delete().eq("pedido_id", pedido.id);

      setCancelOpen(false);
      setConfirmText("");
      toast.success("Pedido cancelado. Orçamento retornado para negociação.");
      // Redireciona para a tela de negociação (menu lateral volta ao contexto comercial)
      navigate(`/comercial/${pedido.orcamento_id}/negociacao`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar pedido");
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Ações do pedido">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setResumoOpen(true)}>
            <PieChart className="w-4 h-4 mr-2 text-emerald-700" /> Resumo Financeiro
          </DropdownMenuItem>
          {contrato && (
            <DropdownMenuItem onClick={() => navigate(`/contratos/${contrato.id}`)}>
              <Printer className="w-4 h-4 mr-2" /> Contrato
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={criandoAdendo} onClick={criarAdendo}>
            <Sparkles className="w-4 h-4 mr-2 text-purple-700" /> {criandoAdendo ? "Criando…" : "Criar Adendo"}
          </DropdownMenuItem>
          {!ehAdendo && (
            <DropdownMenuItem disabled={criandoComplemento} onClick={criarComplemento}>
              <FileText className="w-4 h-4 mr-2 text-emerald-700" /> {criandoComplemento ? "Criando…" : "Criar Complemento"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-red-600 focus:text-red-700"
            onClick={() => { setConfirmText(""); setCancelOpen(true); }}
          >
            <X className="w-4 h-4 mr-2" /> Cancelar Pedido
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResumoFinanceiroPedidoButton
        orcamento={orcamento}
        ambientes={ambientes}
        pagamentos={pagamentos}
        pedido={pedido}
        open={resumoOpen}
        onOpenChange={setResumoOpen}
        hideTrigger
      />

      <Dialog open={cancelOpen} onOpenChange={(v) => { setCancelOpen(v); if (!v) setConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Cancelar pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Esta ação cancela o pedido <b>{pedido?.codigo}</b>. Para confirmar, digite a palavra
              <b className="text-foreground"> CANCELAR </b> abaixo e clique em OK.
            </p>
            <Input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite CANCELAR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={cancelando || confirmText.trim().toUpperCase() !== "CANCELAR"}
              onClick={fazerCancelamento}
            >
              {cancelando ? "Cancelando…" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

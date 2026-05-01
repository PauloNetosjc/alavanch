import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  FileText,
  Camera,
  CheckCircle2,
  Upload,
  X,
  AlertCircle,
  PenTool,
  Image as ImageIcon,
} from "lucide-react";

type Detalhe = {
  id: string;
  codigo: string | null;
  status: string | null;
  prioridade: string | null;
  descricao: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  observacoes: string | null;
  tecnico_id: string | null;
  cliente: { nome: string; endereco: string | null; cep: string | null; cidade: string | null; estado: string | null } | null;
  pedido: { codigo: string } | null;
};

type Foto = { id: string; url: string; tipo: string };

const STATUS_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  triagem: { label: "Triagem", bg: "#fef3c7", fg: "#92400e" },
  aguardando_material: { label: "Aguardando Material", bg: "#fef3c7", fg: "#92400e" },
  agendada: { label: "Agendado", bg: "#e0e7ff", fg: "#4338ca" },
  em_atendimento: { label: "Em Andamento", bg: "#fef9c3", fg: "#854d0e" },
  conferencia: { label: "Conferência", bg: "#f3e8ff", fg: "#6b21a8" },
  concluida: { label: "Concluído", bg: "#dcfce7", fg: "#166534" },
};

export default function MeuChamadoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [a, setA] = useState<Detalhe | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [hasCheckin, setHasCheckin] = useState(false);
  const [hasAssinatura, setHasAssinatura] = useState(false);
  const [tab, setTab] = useState<"servico" | "fotos">("servico");
  const [loading, setLoading] = useState(true);
  const [openMotivo, setOpenMotivo] = useState(false);
  const [openConfirma, setOpenConfirma] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from("assistencias")
      .select(
        "id, codigo, status, prioridade, descricao, data_agendamento, hora_agendamento, observacoes, tecnico_id, cliente:clientes(nome,endereco,cep,cidade,estado), pedido:pedidos(codigo)"
      )
      .eq("id", id)
      .maybeSingle();
    setA(data as any);

    const { data: fts } = await supabase
      .from("fotos_assistencia")
      .select("id, url, tipo")
      .eq("assistencia_id", id);
    setFotos((fts || []) as any);

    const { data: ck } = await supabase
      .from("checkins")
      .select("id")
      .eq("assistencia_id", id)
      .limit(1)
      .maybeSingle();
    setHasCheckin(!!ck);

    const { data: as } = await supabase
      .from("assinaturas")
      .select("id")
      .eq("assistencia_id", id)
      .limit(1)
      .maybeSingle();
    setHasAssinatura(!!as);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading || !a) {
    return (
      <div className="p-12 text-center text-[12px] text-muted-foreground">Carregando…</div>
    );
  }

  const st = STATUS_LABELS[a.status || "triagem"] || STATUS_LABELS.triagem;
  const enderecoFull = [a.cliente?.endereco, a.cliente?.cidade, a.cliente?.estado, a.cliente?.cep]
    .filter(Boolean)
    .join(", ");
  const fotosAbertura = fotos.filter((f) => f.tipo === "abertura");
  const fotosAntes = fotos.filter((f) => f.tipo === "antes");
  const fotosDepois = fotos.filter((f) => f.tipo === "depois");

  const isOwn = role === "admin" || a.tecnico_id === user?.id;
  if (!isOwn) {
    return (
      <div className="p-12 text-center text-[12px] text-muted-foreground">
        Você não tem permissão para ver este chamado.
      </div>
    );
  }

  /* --- Ações --- */
  const fazerCheckin = async () => {
    setSaving(true);
    const { error } = await supabase.from("checkins").insert({
      assistencia_id: a.id,
      user_id: user!.id,
    });
    if (!error) {
      await supabase.from("assistencias").update({ status: "em_atendimento" }).eq("id", a.id);
      toast.success("Check-in realizado com sucesso!");
      load();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const uploadFoto = async (file: File, tipo: "antes" | "depois") => {
    const path = `assistencias/${a.id}/${tipo}_${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("order-attachments")
      .upload(path, file);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("order-attachments").getPublicUrl(path);
    await supabase
      .from("fotos_assistencia")
      .insert({ assistencia_id: a.id, url: pub.publicUrl, tipo });
    load();
  };

  const removerFoto = async (fid: string) => {
    await supabase.from("fotos_assistencia").delete().eq("id", fid);
    load();
  };

  const coletarAssinatura = async () => {
    // Assinatura simulada (em produção: canvas)
    await supabase.from("assinaturas").insert({
      assistencia_id: a.id,
      url: "data:placeholder",
    });
    toast.success("Assinatura coletada!");
    load();
  };

  const finalizarSim = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("assistencias")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
        arquivada: true,
        motivo_nao_conclusao: null,
      })
      .eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Chamado finalizado e arquivado!");
    setOpenConfirma(false);
    navigate("/meus-chamados");
  };

  const finalizarNao = async () => {
    if (!motivo.trim()) return toast.error("Informe o motivo");
    setSaving(true);
    const { error } = await supabase
      .from("assistencias")
      .update({
        status: "triagem",
        motivo_nao_conclusao: motivo.trim(),
        tecnico_id: null,
        data_agendamento: null,
        hora_agendamento: null,
      })
      .eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Chamado retornado para triagem");
    setOpenMotivo(false);
    setOpenConfirma(false);
    navigate("/meus-chamados");
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/meus-chamados")}
            className="w-9 h-9 rounded-md hover:bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[26px] font-bold">
            Chamado #{(a.codigo || "").replace(/\D/g, "").slice(-4) || "—"}
          </h1>
        </div>
        <span
          className="text-[12px] font-semibold px-3 py-1 rounded-full"
          style={{ background: st.bg, color: st.fg }}
        >
          {st.label}
        </span>
      </div>

      {/* Tabs (somente após check-in) */}
      {hasCheckin && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("servico")}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold ${
              tab === "servico" ? "bg-[#5b5bf5] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            Serviço
          </button>
          <button
            onClick={() => setTab("fotos")}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold ${
              tab === "fotos" ? "bg-[#5b5bf5] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            Fotos
          </button>
        </div>
      )}

      {(!hasCheckin || tab === "servico") && (
        <>
          {/* Dados do Cliente */}
          <div className="surface-card p-5 bg-blue-50/30 border border-blue-100">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="text-[16px] font-bold">Dados do Cliente</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-muted-foreground">Nome</div>
                <div className="text-[14px] font-medium uppercase">{a.cliente?.nome || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Endereço Completo</div>
                <div className="text-[14px] font-medium">{enderecoFull || "—"}</div>
              </div>
              {enderecoFull && (
                <div className="flex gap-2 pt-1">
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(enderecoFull)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-1.5 rounded-md bg-slate-800 text-white text-[12px] font-semibold"
                  >
                    Waze
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoFull)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-1.5 rounded-md bg-slate-800 text-white text-[12px] font-semibold"
                  >
                    Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Agendamento */}
          <div className="surface-card p-5 bg-blue-50/30 border border-blue-100">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-[16px] font-bold">Agendamento</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-muted-foreground">Contrato</div>
                <div className="text-[14px] font-medium">{a.pedido?.codigo || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Data</div>
                <div className="text-[14px] font-medium">
                  {a.data_agendamento
                    ? new Date(a.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Hora</div>
                <div className="text-[14px] font-medium">
                  {a.hora_agendamento?.slice(0, 5) || "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Prioridade</div>
                <div className="text-[14px] font-medium capitalize text-emerald-600">
                  {a.prioridade || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="surface-card p-5 bg-blue-50/30 border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-[16px] font-bold">Descrição do Serviço</h3>
            </div>
            <div className="bg-emerald-100/60 px-3 py-2 rounded text-[13px] inline-block">
              {a.descricao || "—"}
            </div>
          </div>

          {/* Fotos de abertura */}
          {fotosAbertura.length > 0 && (
            <div className="surface-card p-5 bg-blue-50/30 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-blue-600" />
                <h3 className="text-[16px] font-bold">Fotos de Abertura</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {fotosAbertura.map((f) => (
                  <img
                    key={f.id}
                    src={f.url}
                    alt=""
                    className="aspect-video w-full object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Checklist (após check-in) */}
          {hasCheckin && (
            <div className="surface-card p-5 bg-amber-50/40 border border-amber-200">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-[16px] font-bold">Checklist</h3>
              </div>
              <div className="mb-3">
                <div className="text-[11px] uppercase font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" /> FOTOS (Obrigatórias)
                </div>
                <div className="space-y-2">
                  <ChecklistItem
                    ok={fotosAntes.length > 0}
                    label="Foto Antes - Adicionar"
                    count={fotosAntes.length}
                    onClick={() => setTab("fotos")}
                  />
                  <ChecklistItem
                    ok={fotosDepois.length > 0}
                    label="Foto Depois - Adicionar"
                    count={fotosDepois.length}
                    onClick={() => setTab("fotos")}
                  />
                </div>
              </div>
              <div className="mb-3">
                <div className="text-[11px] uppercase font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5" /> ASSINATURA (Opcional)
                </div>
                <div className="text-[13px] inline-flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] ${hasAssinatura ? "bg-emerald-500" : "bg-blue-400"}`}>
                    {hasAssinatura ? "✓" : "i"}
                  </span>
                  {hasAssinatura ? "Coletada" : "Pendente"}
                </div>
              </div>
              {!hasAssinatura && (
                <Button
                  onClick={coletarAssinatura}
                  className="w-full bg-[#5b5bf5] hover:bg-[#4a4ae0] mt-2"
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  Coletar Assinatura do Cliente
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Aba Fotos */}
      {hasCheckin && tab === "fotos" && (
        <>
          <FotoSection
            title="Fotos Antes"
            count={fotosAntes.length}
            fotos={fotosAntes}
            onUpload={(f) => uploadFoto(f, "antes")}
            onRemove={removerFoto}
          />
          <FotoSection
            title="Fotos Depois"
            count={fotosDepois.length}
            fotos={fotosDepois}
            onUpload={(f) => uploadFoto(f, "depois")}
            onRemove={removerFoto}
          />
        </>
      )}

      {/* Botão flutuante */}
      {a.status !== "concluida" && (
        <div className="fixed bottom-6 left-0 right-0 px-6 z-30">
          <div className="max-w-3xl mx-auto">
            {!hasCheckin ? (
              <Button
                onClick={fazerCheckin}
                disabled={saving}
                className="w-full h-12 bg-[#5b5bf5] hover:bg-[#4a4ae0] text-white text-[14px] font-semibold"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Fazer Check-in
              </Button>
            ) : (
              <Button
                onClick={() => setOpenConfirma(true)}
                disabled={saving}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-semibold"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Finalizar Serviço
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Serviço concluído? */}
      <Dialog open={openConfirma} onOpenChange={setOpenConfirma}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Serviço concluído com sucesso?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Confirme se o serviço foi finalizado conforme esperado.
          </p>
          <DialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <Button
              onClick={() => {
                setOpenConfirma(false);
                setOpenMotivo(true);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Não
            </Button>
            <Button
              onClick={finalizarSim}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Sim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Motivo */}
      <Dialog open={openMotivo} onOpenChange={setOpenMotivo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo do Não Conclusão</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Digite o motivo..."
            className="border-red-300 focus-visible:ring-red-300"
          />
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setOpenMotivo(false)}>
              Cancelar
            </Button>
            <Button
              onClick={finalizarNao}
              disabled={saving}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistItem({
  ok,
  label,
  count,
  onClick,
}: {
  ok: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onClick} className="inline-flex items-center gap-2 text-[13px]">
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] ${
            ok ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {ok ? "✓" : "✕"}
        </span>
        <span className={ok ? "text-emerald-700" : "text-red-600 underline"}>{label}</span>
      </button>
      <span className="text-[12px] text-muted-foreground">{count} foto(s)</span>
    </div>
  );
}

function FotoSection({
  title,
  count,
  fotos,
  onUpload,
  onRemove,
}: {
  title: string;
  count: number;
  fotos: Foto[];
  onUpload: (f: File) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[18px] font-bold">{title}</h3>
        <span className="text-[13px] text-muted-foreground">{count}/5</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="aspect-[4/3] rounded-xl bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100">
          <Camera className="w-7 h-7 text-blue-600 mb-1" />
          <div className="text-[13px] font-semibold text-blue-700">Tirar Foto</div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30">
          <Upload className="w-7 h-7 text-muted-foreground mb-1" />
          <div className="text-[13px] font-semibold text-muted-foreground">Galeria</div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {fotos.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-muted-foreground">
          <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
          <div className="text-[12px]">Nenhuma foto adicionada</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={f.url} className="w-full h-full object-cover" alt="" />
              <button
                onClick={() => onRemove(f.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

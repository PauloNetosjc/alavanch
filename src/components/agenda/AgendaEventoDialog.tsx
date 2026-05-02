import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";

export type AgendaTipo =
  | "medicao_tecnica" | "revisao_final" | "entrega"
  | "montagem" | "assistencia_tecnica" | "tarefa_interna";

const TIPO_LABEL: Record<AgendaTipo, string> = {
  medicao_tecnica: "Medição Técnica",
  revisao_final: "Revisão Final",
  entrega: "Entrega",
  montagem: "Montagem",
  assistencia_tecnica: "Assistência Técnica",
  tarefa_interna: "Tarefa Interna",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId?: string | null;
  orcamentoId?: string | null;
  defaultTipo?: AgendaTipo;
  defaultDate?: string;        // yyyy-mm-dd
  onCreated?: () => void;
}

export function AgendaEventoDialog({ open, onOpenChange, pedidoId, orcamentoId, defaultTipo = "tarefa_interna", defaultDate, onCreated }: Props) {
  const { user } = useAuth();
  const { lojaId } = useLoja() as any;

  const [tipo, setTipo] = useState<AgendaTipo>(defaultTipo);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("09:00");
  const [horaFim, setHoraFim] = useState("");
  const [endereco, setEndereco] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [responsaveis, setResponsaveis] = useState<{ user_id: string; nome_completo: string | null }[]>([]);
  const [config, setConfig] = useState<any>(null);

  // exceção
  const [excecao, setExcecao] = useState(false);
  const [autorizadorEmail, setAutorizadorEmail] = useState("");
  const [autorizadorSenha, setAutorizadorSenha] = useState("");
  const [excecaoMotivo, setExcecaoMotivo] = useState("");
  const [validacaoErr, setValidacaoErr] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo(defaultTipo);
    setTitulo("");
    setDescricao("");
    setEndereco("");
    setResponsavelId(user?.id || "");
    setExcecao(false);
    setAutorizadorEmail("");
    setAutorizadorSenha("");
    setExcecaoMotivo("");
    setValidacaoErr("");
    if (defaultDate) setData(defaultDate);
    (async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .order("nome_completo");
      setResponsaveis((profs as any) || []);
    })();
  }, [open, defaultTipo, defaultDate, user?.id]);

  // Carrega config sempre que tipo mudar
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: cfgs } = await supabase
        .from("agenda_config" as any)
        .select("*")
        .eq("tipo", tipo);
      const cfg = (cfgs as any[])?.find((c) => c.loja_id === lojaId) ?? (cfgs as any[])?.find((c) => !c.loja_id);
      setConfig(cfg || null);
    })();
  }, [tipo, lojaId, open]);

  /** Valida regras: dia da semana, horário, prazo mínimo */
  const validar = useMemo(() => async (): Promise<string | null> => {
    if (!data || !hora) return "Informe data e hora.";
    if (!responsavelId) return "Escolha um responsável.";
    if ((tipo === "medicao_tecnica" || tipo === "revisao_final" || tipo === "entrega" || tipo === "montagem") && !endereco.trim())
      return "Endereço é obrigatório para este tipo de evento.";
    if (!config) return null;

    const dt = new Date(data + "T00:00:00");
    const dow = dt.getDay(); // 0=dom..6=sáb
    if (Array.isArray(config.dias_semana) && !config.dias_semana.includes(dow))
      return "Dia da semana não permitido para " + TIPO_LABEL[tipo] + ".";

    if (config.hora_inicio && hora < config.hora_inicio) return "Horário antes do permitido (" + config.hora_inicio + ").";
    if (config.hora_fim && hora > config.hora_fim)       return "Horário depois do permitido (" + config.hora_fim + ").";

    // prazo mínimo dias úteis
    const prazo = Number(config.prazo_minimo_dias_uteis) || 0;
    if (prazo > 0) {
      // base = data da venda (pedido) ou hoje
      let base: string | null = null;
      if (pedidoId) {
        const { data: p } = await supabase.from("pedidos").select("created_at").eq("id", pedidoId).maybeSingle();
        base = p?.created_at ? (p.created_at as string).slice(0, 10) : null;
      }
      const baseDate = base || new Date().toISOString().slice(0, 10);
      const { data: minDate } = await supabase.rpc("add_dias_uteis" as any, {
        _inicio: baseDate, _n: prazo, _loja: lojaId,
      });
      if (minDate && data < (minDate as string)) {
        return "Data antes do prazo mínimo (" + prazo + " dias úteis após a base).";
      }
    }
    return null;
  }, [data, hora, responsavelId, tipo, endereco, config, pedidoId, lojaId]);

  const handleSubmit = async () => {
    setSaving(true);
    setValidacaoErr("");
    try {
      const err = await validar();
      let usaExcecao = false;
      let autorizadorId: string | null = null;
      if (err) {
        if (!excecao) {
          setValidacaoErr(err + " Para liberar, marque 'Agendar com exceção' e informe um autorizador.");
          setSaving(false);
          return;
        }
        if (!autorizadorEmail || !autorizadorSenha) {
          setValidacaoErr("Informe e-mail e senha do autorizador para liberar a exceção.");
          setSaving(false);
          return;
        }
        // valida senha do autorizador via Edge Function existente
        const { data: vp, error: vpErr } = await supabase.functions.invoke("verify-admin-password", {
          body: { email: autorizadorEmail, password: autorizadorSenha },
        });
        if (vpErr || !(vp as any)?.ok) {
          setValidacaoErr("Senha do autorizador inválida.");
          setSaving(false);
          return;
        }
        autorizadorId = (vp as any)?.user_id || null;
        // checa se ele pode autorizar
        const { data: pode } = await supabase.rpc("pode_autorizar_excecao_agenda" as any, {
          _user_id: autorizadorId, _loja: lojaId,
        });
        if (!pode) {
          setValidacaoErr("Esse usuário não está autorizado a liberar exceções na agenda.");
          setSaving(false);
          return;
        }
        usaExcecao = true;
      }

      const payload: any = {
        pedido_id: pedidoId || null,
        orcamento_id: orcamentoId || null,
        loja_id: lojaId || null,
        tipo,
        titulo: titulo || TIPO_LABEL[tipo],
        descricao: descricao || null,
        data,
        hora_inicio: hora,
        hora_fim: horaFim || null,
        endereco: endereco || null,
        responsavel_id: responsavelId,
        excecao: usaExcecao,
        excecao_autorizador_id: autorizadorId,
        excecao_motivo: usaExcecao ? excecaoMotivo || null : null,
        created_by: user?.id || null,
      };
      const { error } = await supabase.from("agenda_eventos" as any).insert(payload);
      if (error) throw error;
      toast.success("Evento agendado");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo evento na agenda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as AgendaTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={TIPO_LABEL[tipo]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Hora início</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div>
              <Label>Hora fim</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Endereço {(tipo === "medicao_tecnica" || tipo === "revisao_final" || tipo === "entrega" || tipo === "montagem") && <span className="text-destructive">*</span>}</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {responsaveis.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || p.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          {config && (
            <div className="text-[11px] text-muted-foreground">
              Regra: {(config.dias_semana || []).map((d: number) => ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d]).join(", ")}
              {" • "}{config.hora_inicio?.slice(0,5)}–{config.hora_fim?.slice(0,5)}
              {Number(config.prazo_minimo_dias_uteis) > 0 ? ` • prazo mín. ${config.prazo_minimo_dias_uteis} dias úteis` : ""}
            </div>
          )}

          {validacaoErr && (
            <div className="text-[12px] rounded-md p-2 bg-destructive/10 text-destructive border border-destructive/30">
              {validacaoErr}
            </div>
          )}

          <div className="rounded-md border p-2">
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={excecao} onChange={(e) => setExcecao(e.target.checked)} />
              Agendar com exceção (fora da regra)
            </label>
            {excecao && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input placeholder="E-mail do autorizador" value={autorizadorEmail} onChange={(e) => setAutorizadorEmail(e.target.value)} />
                <Input type="password" placeholder="Senha" value={autorizadorSenha} onChange={(e) => setAutorizadorSenha(e.target.value)} />
                <Input className="col-span-2" placeholder="Motivo da exceção" value={excecaoMotivo} onChange={(e) => setExcecaoMotivo(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvando…" : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

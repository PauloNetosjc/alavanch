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
import { maskPhone, unmask } from "@/lib/masks";

export type AgendaTipo =
  | "apresentacao_comercial"
  | "retorno"
  | "medicao_orcamento"
  | "medicao_tecnica" | "revisao_final" | "entrega"
  | "montagem" | "assistencia_tecnica" | "tarefa_interna";

const TIPO_LABEL: Record<AgendaTipo, string> = {
  apresentacao_comercial: "Apresentação",
  retorno: "Retorno",
  medicao_orcamento: "Medição de Orçamento",
  medicao_tecnica: "Medição Técnica",
  revisao_final: "Revisão",
  entrega: "Entrega",
  montagem: "Montagem",
  assistencia_tecnica: "Assistência Técnica",
  tarefa_interna: "Tarefa Interna",
};

// Tipos que exigem vínculo com PEDIDO existente do cliente
const TIPOS_PEDIDO: AgendaTipo[] = ["retorno", "revisao_final", "medicao_tecnica", "entrega", "montagem"];
// Tipo que exige vínculo com ORÇAMENTO do cliente
const TIPOS_ORCAMENTO: AgendaTipo[] = ["medicao_orcamento"];
// Tipos que exigem cliente vinculado
const TIPOS_COM_CLIENTE: AgendaTipo[] = ["apresentacao_comercial", ...TIPOS_PEDIDO, ...TIPOS_ORCAMENTO];
// Tipos que exigem endereço
const TIPOS_COM_ENDERECO: AgendaTipo[] = ["medicao_tecnica", "revisao_final", "entrega", "montagem", "medicao_orcamento"];
// Tipos que permitem cadastrar um cliente novo no próprio diálogo
const TIPOS_NOVO_CLIENTE: AgendaTipo[] = ["apresentacao_comercial", "medicao_orcamento"];
// Map tipo principal → tipo do followup obrigatório
const FOLLOWUP_TIPO: Partial<Record<AgendaTipo, AgendaTipo>> = {
  medicao_orcamento: "apresentacao_comercial",
  medicao_tecnica: "revisao_final",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId?: string | null;
  orcamentoId?: string | null;
  defaultTipo?: AgendaTipo;
  defaultDate?: string;
  onCreated?: () => void;
}

interface Loja { id: string; nome: string }

export function AgendaEventoDialog({ open, onOpenChange, pedidoId, orcamentoId, defaultTipo = "tarefa_interna", defaultDate, onCreated }: Props) {
  const { user, role } = useAuth();
  const { selectedLojaId: lojaCtxId } = useLoja();
  const isAdmin = role === "admin" || role === "diretor";

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

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaEventoId, setLojaEventoId] = useState<string | null>(lojaCtxId || null);

  // cliente
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteFone, setClienteFone] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clientesEnc, setClientesEnc] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [novoCliente, setNovoCliente] = useState(true);

  // pedido / orçamento vinculado (filtrados por cliente)
  const [pedidoSelId, setPedidoSelId] = useState<string>(pedidoId || "");
  const [pedidosCliente, setPedidosCliente] = useState<{ id: string; codigo: string | null; status: string | null }[]>([]);
  const [orcamentoSelId, setOrcamentoSelId] = useState<string>(orcamentoId || "");
  const [orcamentosCliente, setOrcamentosCliente] = useState<{ id: string; codigo: string | null; status: string | null }[]>([]);

  // exceção
  const [excecao, setExcecao] = useState(false);
  const [autorizadorEmail, setAutorizadorEmail] = useState("");
  const [autorizadorSenha, setAutorizadorSenha] = useState("");
  const [excecaoMotivo, setExcecaoMotivo] = useState("");
  const [validacaoErr, setValidacaoErr] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const exigeCliente = TIPOS_COM_CLIENTE.includes(tipo);
  const exigePedido = TIPOS_PEDIDO.includes(tipo);
  const exigeOrcamento = TIPOS_ORCAMENTO.includes(tipo);
  const exigeEndereco = TIPOS_COM_ENDERECO.includes(tipo);
  const isApresentacao = tipo === "apresentacao_comercial";
  const permiteNovoCliente = TIPOS_NOVO_CLIENTE.includes(tipo);
  const followupTipo = FOLLOWUP_TIPO[tipo];

  // Followup obrigatório (apresentação após medição de orçamento; revisão após medição técnica)
  const [followupData, setFollowupData] = useState("");
  const [followupHora, setFollowupHora] = useState("09:00");
  const [followupHoraFim, setFollowupHoraFim] = useState("");
  const [followupEndereco, setFollowupEndereco] = useState("");
  const [followupDescricao, setFollowupDescricao] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo(defaultTipo);
    setTitulo(""); setDescricao(""); setEndereco("");
    setResponsavelId(user?.id || "");
    setExcecao(false); setAutorizadorEmail(""); setAutorizadorSenha("");
    setExcecaoMotivo(""); setValidacaoErr("");
    setClienteId(""); setClienteNome(""); setClienteFone(""); setClienteBusca("");
    setNovoCliente(TIPOS_NOVO_CLIENTE.includes(defaultTipo));
    setFollowupData(""); setFollowupHora("09:00"); setFollowupHoraFim("");
    setFollowupEndereco(""); setFollowupDescricao("");
    setPedidoSelId(pedidoId || ""); setOrcamentoSelId(orcamentoId || "");
    setPedidosCliente([]); setOrcamentosCliente([]);
    setLojaEventoId(lojaCtxId || null);
    if (defaultDate) setData(defaultDate);
    (async () => {
      const [profs, ls] = await Promise.all([
        supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
        supabase.from("lojas").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setResponsaveis((profs.data as any) || []);
      setLojas((ls.data as any) || []);
    })();
  }, [open, defaultTipo, defaultDate, user?.id, lojaCtxId, pedidoId, orcamentoId]);

  // Em mudança de tipo, reseta cliente novo apenas para apresentação (default novo)
  useEffect(() => {
    if (!open) return;
    setNovoCliente(tipo === "apresentacao_comercial");
    setPedidoSelId(""); setOrcamentoSelId("");
  }, [tipo, open]);

  // busca incremental de clientes
  useEffect(() => {
    if (!open || !exigeCliente || novoCliente || clienteBusca.length < 2) {
      setClientesEnc([]); return;
    }
    let active = true;
    (async () => {
      const { data: cs } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .ilike("nome", `%${clienteBusca}%`)
        .limit(10);
      if (active) setClientesEnc((cs as any) || []);
    })();
    return () => { active = false; };
  }, [clienteBusca, exigeCliente, novoCliente, open]);

  // Carrega pedidos/orçamentos do cliente selecionado
  useEffect(() => {
    if (!open || !clienteId) { setPedidosCliente([]); setOrcamentosCliente([]); return; }
    (async () => {
      if (exigePedido) {
        const { data: ps } = await supabase
          .from("pedidos").select("id, codigo, status")
          .eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(50);
        setPedidosCliente((ps as any) || []);
      }
      if (exigeOrcamento) {
        const { data: os } = await supabase
          .from("orcamentos").select("id, codigo, status")
          .eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(50);
        setOrcamentosCliente((os as any) || []);
      }
    })();
  }, [clienteId, exigePedido, exigeOrcamento, open]);

  // config por tipo/loja
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: cfgs } = await supabase
        .from("agenda_config" as any)
        .select("*")
        .eq("tipo", tipo);
      const cfg = (cfgs as any[])?.find((c) => c.loja_id === lojaEventoId) ?? (cfgs as any[])?.find((c) => !c.loja_id);
      setConfig(cfg || null);
    })();
  }, [tipo, lojaEventoId, open]);

  const validar = useMemo(() => async (): Promise<string | null> => {
    if (!data || !hora) return "Informe data e hora.";
    if (!responsavelId) return "Escolha um responsável.";
    if (exigeCliente) {
      if (isApresentacao && novoCliente) {
        if (!clienteNome.trim()) return "Informe o nome do cliente.";
        if (!unmask(clienteFone)) return "Informe o telefone do cliente.";
      } else if (!clienteId) {
        return "Selecione um cliente.";
      }
    }
    if (exigePedido && !pedidoSelId) return "Selecione um pedido do cliente.";
    if (exigeOrcamento && !orcamentoSelId) return "Selecione um orçamento do cliente.";
    if (exigeEndereco && !endereco.trim()) return "Endereço é obrigatório para este tipo de evento.";

    if (!config) return null;
    const dt = new Date(data + "T00:00:00");
    const dow = dt.getDay();
    if (Array.isArray(config.dias_semana) && !config.dias_semana.includes(dow))
      return "Dia da semana não permitido para " + TIPO_LABEL[tipo] + ".";
    if (config.hora_inicio && hora < config.hora_inicio) return "Horário antes do permitido (" + config.hora_inicio + ").";
    if (config.hora_fim && hora > config.hora_fim)       return "Horário depois do permitido (" + config.hora_fim + ").";

    const prazo = Number(config.prazo_minimo_dias_uteis) || 0;
    if (prazo > 0) {
      let base: string | null = null;
      const pid = pedidoSelId || pedidoId;
      if (pid) {
        const { data: p } = await supabase.from("pedidos").select("created_at").eq("id", pid).maybeSingle();
        base = p?.created_at ? (p.created_at as string).slice(0, 10) : null;
      }
      const baseDate = base || new Date().toISOString().slice(0, 10);
      const { data: minDate } = await supabase.rpc("add_dias_uteis" as any, {
        _inicio: baseDate, _n: prazo, _loja: lojaEventoId,
      });
      if (minDate && data < (minDate as string))
        return "Data antes do prazo mínimo (" + prazo + " dias úteis após a base).";
    }
    return null;
  }, [data, hora, responsavelId, tipo, endereco, config, pedidoId, lojaEventoId, novoCliente, clienteNome, clienteFone, clienteId, isApresentacao, exigeCliente, exigePedido, exigeOrcamento, exigeEndereco, pedidoSelId, orcamentoSelId]);

  const handleSubmit = async () => {
    setSaving(true); setValidacaoErr("");
    try {
      const err = await validar();
      let usaExcecao = false;
      let autorizadorId: string | null = null;
      if (err) {
        if (!excecao) {
          setValidacaoErr(err + " Para liberar, marque 'Agendar com exceção' e informe um autorizador.");
          setSaving(false); return;
        }
        if (!autorizadorEmail || !autorizadorSenha) {
          setValidacaoErr("Informe e-mail e senha do autorizador para liberar a exceção.");
          setSaving(false); return;
        }
        const { data: vp, error: vpErr } = await supabase.functions.invoke("verify-user-password", {
          body: { email: autorizadorEmail, password: autorizadorSenha },
        });
        if (vpErr || !(vp as any)?.ok) {
          setValidacaoErr("Senha do autorizador inválida.");
          setSaving(false); return;
        }
        autorizadorId = (vp as any)?.user_id || null;
        const { data: pode } = await supabase.rpc("pode_autorizar_excecao_agenda" as any, {
          _user_id: autorizadorId, _loja: lojaEventoId,
        });
        if (!pode) {
          setValidacaoErr("Esse usuário não está autorizado a liberar exceções na agenda.");
          setSaving(false); return;
        }
        usaExcecao = true;
      }

      let cliId = clienteId || null;
      let cliNomeFinal = clienteNome;
      if (isApresentacao && novoCliente && clienteNome.trim()) {
        const { data: novo, error: cErr } = await supabase
          .from("clientes")
          .insert({
            nome: clienteNome.trim(),
            telefone: clienteFone || null,
            loja_id: lojaEventoId,
            created_by: user?.id || null,
            ativo: true,
          })
          .select("id, nome").maybeSingle();
        if (cErr) throw cErr;
        cliId = (novo as any)?.id || null;
        cliNomeFinal = (novo as any)?.nome || clienteNome;
      } else if (exigeCliente && clienteId) {
        const found = clientesEnc.find(c => c.id === clienteId);
        cliNomeFinal = found?.nome || clienteBusca;
      }

      const tituloFinal = titulo
        || (cliNomeFinal ? `${TIPO_LABEL[tipo]} – ${cliNomeFinal}` : TIPO_LABEL[tipo]);

      const payload: any = {
        pedido_id: pedidoSelId || pedidoId || null,
        orcamento_id: orcamentoSelId || orcamentoId || null,
        cliente_id: cliId,
        loja_id: lojaEventoId,
        tipo,
        titulo: tituloFinal,
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
            <Label>Loja</Label>
            {isAdmin ? (
              <Select value={lojaEventoId ?? "__all__"} onValueChange={(v) => setLojaEventoId(v === "__all__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as lojas (geral)</SelectItem>
                  {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={lojas.find(l => l.id === lojaEventoId)?.nome || "—"} disabled />
            )}
          </div>

          {/* Cliente — para apresentação (novo/existente) e demais (apenas existente) */}
          {exigeCliente && (
            <div className="rounded-md border p-3 bg-muted/20 space-y-2">
              {isApresentacao && (
                <div className="flex items-center gap-3 text-[12px]">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={novoCliente} onChange={() => setNovoCliente(true)} /> Novo cliente
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={!novoCliente} onChange={() => setNovoCliente(false)} /> Cliente existente
                  </label>
                </div>
              )}
              {isApresentacao && novoCliente ? (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} /></div>
                  <div><Label>Telefone <span className="text-destructive">*</span></Label><Input value={clienteFone} onChange={(e) => setClienteFone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" /></div>
                </div>
              ) : (
                <div>
                  <Label>Cliente <span className="text-destructive">*</span></Label>
                  <Input value={clienteBusca} onChange={(e) => { setClienteBusca(e.target.value); setClienteId(""); }} placeholder="Digite o nome…" />
                  {clientesEnc.length > 0 && (
                    <div className="mt-1 border rounded-md max-h-40 overflow-y-auto">
                      {clientesEnc.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setClienteId(c.id); setClienteBusca(c.nome); setClientesEnc([]); }}
                          className={`w-full text-left px-2 py-1.5 text-[12px] hover:bg-accent ${clienteId === c.id ? "bg-accent" : ""}`}>
                          {c.nome} {c.telefone ? `· ${c.telefone}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Seletor de pedido (filtrado por cliente) */}
              {exigePedido && clienteId && (
                <div>
                  <Label>Pedido vinculado <span className="text-destructive">*</span></Label>
                  <Select value={pedidoSelId} onValueChange={setPedidoSelId}>
                    <SelectTrigger><SelectValue placeholder={pedidosCliente.length ? "Selecione…" : "Cliente sem pedidos"} /></SelectTrigger>
                    <SelectContent>
                      {pedidosCliente.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.codigo || p.id.slice(0,8)} {p.status ? `· ${p.status}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Seletor de orçamento (filtrado por cliente) */}
              {exigeOrcamento && clienteId && (
                <div>
                  <Label>Orçamento vinculado <span className="text-destructive">*</span></Label>
                  <Select value={orcamentoSelId} onValueChange={setOrcamentoSelId}>
                    <SelectTrigger><SelectValue placeholder={orcamentosCliente.length ? "Selecione…" : "Cliente sem orçamentos"} /></SelectTrigger>
                    <SelectContent>
                      {orcamentosCliente.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.codigo || o.id.slice(0,8)} {o.status ? `· ${o.status}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={TIPO_LABEL[tipo]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora início</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Hora fim</Label><Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
          </div>
          <div>
            <Label>Endereço {exigeEndereco && <span className="text-destructive">*</span>}</Label>
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

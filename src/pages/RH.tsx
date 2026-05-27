import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { toast } from "@/hooks/use-toast";
import { maskCpf, maskPhone } from "@/lib/masks";
import {
  Users, UserPlus, Plane, AlertTriangle, Briefcase, UserX, Search,
  FileText, Upload, Trash2, Pencil, Calendar, AlertCircle,
  Clock, MapPin, Camera, History, Fingerprint,
} from "lucide-react";

type Setor = { id: string; nome: string };
type Cargo = { id: string; nome: string; setor_id: string | null };
type Turno = {
  id: string; nome: string;
  hora_entrada: string; hora_saida_almoco: string | null; hora_volta_almoco: string | null; hora_saida: string;
  dias_semana: number[]; tolerancia_min: number; observacoes: string | null;
};
type Zona = { id: string; setor_id: string | null; nome: string; latitude: number; longitude: number; raio_metros: number };
type Ponto = {
  id: string; funcionario_id: string; data: string;
  tipo: "entrada" | "saida_almoco" | "volta_almoco" | "saida";
  marcado_em: string; latitude: number | null; longitude: number | null;
  selfie_url: string | null; origem: "sistema" | "celular"; atraso_min: number;
};
type Funcionario = {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  cpf: string | null;
  rg: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cargo_id: string | null;
  setor_id: string | null;
  turno_id: string | null;
  salario: number | null;
  data_admissao: string | null;
  tipo_contrato: "clt" | "pj" | "terceirizado" | "autonomo";
  data_fim_experiencia: string | null;
  data_fim_contrato: string | null;
  status: "ativo" | "afastado" | "ferias" | "desligado";
  data_desligamento: string | null;
  observacoes: string | null;
};
type Ferias = { id: string; funcionario_id: string; data_inicio: string; data_fim: string; status: string; observacoes: string | null };
type Ocorrencia = { id: string; funcionario_id: string; data: string; tipo: string; descricao: string | null; responsavel: string | null; anexo_url: string | null };
type Documento = { id: string; funcionario_id: string; tipo: string; nome_arquivo: string | null; url: string; observacoes: string | null };

const STATUS_LABEL: Record<string, string> = { ativo: "Ativo", afastado: "Afastado", ferias: "Em férias", desligado: "Desligado" };
const STATUS_COLOR: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800",
  afastado: "bg-amber-100 text-amber-800",
  ferias: "bg-sky-100 text-sky-800",
  desligado: "bg-rose-100 text-rose-800",
};
const CONTRATO_LABEL: Record<string, string> = { clt: "CLT", pj: "PJ", terceirizado: "Terceirizado", autonomo: "Autônomo" };
const TIPOS_DOC = ["RG", "CPF", "Comprovante de endereço", "Contrato", "CNH", "ASO", "Outros"];

const emptyFunc: Partial<Funcionario> = {
  tipo_contrato: "clt", status: "ativo",
};

function daysUntil(date: string | null) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00").getTime();
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now.getTime()) / 86400000);
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function nowHM() { const d = new Date(); return d.toTimeString().slice(0, 5); }
function hmToMin(hm: string) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
function minToHM(min: number) {
  const sign = min < 0 ? "-" : "";
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(lat2 - lat1); const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const TIPO_PONTO_LABEL: Record<string, string> = {
  entrada: "Entrada", saida_almoco: "Saída almoço", volta_almoco: "Volta almoço", saida: "Saída final",
};
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcSaldoDia(pontos: Ponto[], turno: Turno | undefined): { trabalhado: number; previsto: number; saldo: number } {
  if (!turno) return { trabalhado: 0, previsto: 0, saldo: 0 };
  const previsto =
    (hmToMin(turno.hora_saida) - hmToMin(turno.hora_entrada)) -
    (turno.hora_saida_almoco && turno.hora_volta_almoco
      ? hmToMin(turno.hora_volta_almoco) - hmToMin(turno.hora_saida_almoco)
      : 0);
  const get = (t: string) => pontos.find(p => p.tipo === t);
  const e = get("entrada"); const sa = get("saida_almoco"); const va = get("volta_almoco"); const s = get("saida");
  let trabalhado = 0;
  if (e && s) {
    const min = (a: string) => { const d = new Date(a); return d.getHours() * 60 + d.getMinutes(); };
    trabalhado = min(s.marcado_em) - min(e.marcado_em);
    if (sa && va) trabalhado -= (min(va.marcado_em) - min(sa.marcado_em));
  }
  return { trabalhado, previsto, saldo: trabalhado - previsto };
}

export default function RH() {
  const [tab, setTab] = useState("dashboard");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState<string>("todos");
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");

  const [funcDialog, setFuncDialog] = useState(false);
  const [funcForm, setFuncForm] = useState<Partial<Funcionario>>(emptyFunc);
  const [setorDialog, setSetorDialog] = useState(false);
  const [cargoDialog, setCargoDialog] = useState(false);
  const [novoSetor, setNovoSetor] = useState("");
  const [novoCargo, setNovoCargo] = useState({ nome: "", setor_id: "" });

  const [detalheFunc, setDetalheFunc] = useState<Funcionario | null>(null);
  const [feriasDialog, setFeriasDialog] = useState(false);
  const [feriasForm, setFeriasForm] = useState<Partial<Ferias>>({ status: "programada" });
  const [ocoDialog, setOcoDialog] = useState(false);
  const [ocoForm, setOcoForm] = useState<Partial<Ocorrencia>>({ data: new Date().toISOString().slice(0,10) });
  const [docDialog, setDocDialog] = useState(false);
  const [docForm, setDocForm] = useState<{ tipo: string; observacoes: string }>({ tipo: "RG", observacoes: "" });
  const [docFile, setDocFile] = useState<File | null>(null);

  // Turnos / Ponto / Banco de horas
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [turnoDialog, setTurnoDialog] = useState(false);
  const [turnoForm, setTurnoForm] = useState<Partial<Turno>>({
    dias_semana: [1, 2, 3, 4, 5], tolerancia_min: 5,
    hora_entrada: "08:00", hora_saida_almoco: "12:00", hora_volta_almoco: "13:00", hora_saida: "17:00",
  });
  const [zonaDialog, setZonaDialog] = useState(false);
  const [zonaForm, setZonaForm] = useState<Partial<Zona>>({ raio_metros: 150 });
  const [pontoFuncId, setPontoFuncId] = useState<string>("");
  const [bancoFiltroFunc, setBancoFiltroFunc] = useState<string>("todos");
  const [bancoDe, setBancoDe] = useState<string>(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [bancoAte, setBancoAte] = useState<string>(hojeISO());

  async function load() {
    setLoading(true);
    const [s, c, f, fe, oc, dc, t, z, p] = await Promise.all([
      supabase.from("rh_setores").select("*").order("nome"),
      supabase.from("rh_cargos").select("*").order("nome"),
      supabase.from("rh_funcionarios").select("*").order("nome_completo"),
      supabase.from("rh_ferias").select("*").order("data_inicio", { ascending: false }),
      supabase.from("rh_ocorrencias").select("*").order("data", { ascending: false }),
      supabase.from("rh_documentos").select("*").order("created_at", { ascending: false }),
      supabase.from("rh_turnos" as any).select("*").order("nome"),
      supabase.from("rh_zonas_ponto" as any).select("*").order("nome"),
      supabase.from("rh_pontos" as any).select("*").order("marcado_em", { ascending: false }),
    ]);
    setSetores((s.data as Setor[]) || []);
    setCargos((c.data as Cargo[]) || []);
    setFuncs((f.data as Funcionario[]) || []);
    setFerias((fe.data as Ferias[]) || []);
    setOcorrencias((oc.data as Ocorrencia[]) || []);
    setDocumentos((dc.data as Documento[]) || []);
    setTurnos(((t.data as unknown) as Turno[]) || []);
    setZonas(((z.data as unknown) as Zona[]) || []);
    setPontos(((p.data as unknown) as Ponto[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Atualizar status com base em férias do dia
  useEffect(() => {
    const hoje = new Date().toISOString().slice(0,10);
    ferias.forEach(async (f) => {
      if (f.data_inicio <= hoje && f.data_fim >= hoje && f.status !== "em_andamento") {
        await supabase.from("rh_ferias").update({ status: "em_andamento" }).eq("id", f.id);
      } else if (f.data_fim < hoje && f.status !== "finalizada") {
        await supabase.from("rh_ferias").update({ status: "finalizada" }).eq("id", f.id);
      }
    });
  }, [ferias]);

  const ativos = funcs.filter(f => f.status !== "desligado");
  const desligados = funcs.filter(f => f.status === "desligado");
  const emFerias = funcs.filter(f => {
    const hoje = new Date().toISOString().slice(0,10);
    return ferias.some(fe => fe.funcionario_id === f.id && fe.data_inicio <= hoje && fe.data_fim >= hoje);
  });

  const proximosVencimentos = useMemo(() => {
    return ativos.flatMap(f => {
      const out: { funcionario: Funcionario; tipo: string; data: string; dias: number }[] = [];
      if (f.tipo_contrato === "clt" && f.data_fim_experiencia) {
        const d = daysUntil(f.data_fim_experiencia);
        if (d !== null && d >= 0 && d <= 30) out.push({ funcionario: f, tipo: "Fim de experiência (CLT)", data: f.data_fim_experiencia, dias: d });
      }
      if (f.tipo_contrato === "pj" && f.data_fim_contrato) {
        const d = daysUntil(f.data_fim_contrato);
        if (d !== null && d >= 0 && d <= 60) out.push({ funcionario: f, tipo: "Fim de contrato (PJ)", data: f.data_fim_contrato, dias: d });
      }
      return out;
    }).sort((a,b) => a.dias - b.dias);
  }, [ativos]);

  const filtrados = useMemo(() => {
    let base = funcs;
    if (filtroStatus === "ativos") base = base.filter(f => f.status !== "desligado");
    else if (filtroStatus !== "todos") base = base.filter(f => f.status === filtroStatus);
    if (filtroCargo !== "todos") base = base.filter(f => f.cargo_id === filtroCargo);
    if (filtroSetor !== "todos") base = base.filter(f => f.setor_id === filtroSetor);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      base = base.filter(f =>
        f.nome_completo.toLowerCase().includes(q) ||
        (f.email || "").toLowerCase().includes(q) ||
        (f.cpf || "").includes(q)
      );
    }
    return base;
  }, [funcs, filtroStatus, filtroCargo, filtroSetor, busca]);

  const cargoNome = (id: string | null) => cargos.find(c => c.id === id)?.nome || "—";
  const setorNome = (id: string | null) => setores.find(s => s.id === id)?.nome || "—";

  async function salvarSetor() {
    if (!novoSetor.trim()) return;
    const { error } = await supabase.from("rh_setores").insert({ nome: novoSetor.trim() });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovoSetor(""); setSetorDialog(false); load();
  }
  async function removerSetor(id: string) {
    if (!confirm("Remover setor?")) return;
    const { error } = await supabase.from("rh_setores").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  }
  async function salvarCargo() {
    if (!novoCargo.nome.trim()) return;
    const { error } = await supabase.from("rh_cargos").insert({
      nome: novoCargo.nome.trim(),
      setor_id: novoCargo.setor_id || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovoCargo({ nome: "", setor_id: "" }); setCargoDialog(false); load();
  }
  async function removerCargo(id: string) {
    if (!confirm("Remover cargo?")) return;
    const { error } = await supabase.from("rh_cargos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  }

  function abrirNovoFunc() { setFuncForm(emptyFunc); setFuncDialog(true); }
  function abrirEditarFunc(f: Funcionario) { setFuncForm(f); setFuncDialog(true); }

  async function uploadFoto(file: File): Promise<string | null> {
    const path = `funcionarios/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("rh").upload(path, file);
    if (error) { toast({ title: "Erro upload", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("rh").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvarFunc() {
    if (!funcForm.nome_completo?.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const payload: any = {
      nome_completo: funcForm.nome_completo,
      foto_url: funcForm.foto_url || null,
      cpf: funcForm.cpf || null,
      rg: funcForm.rg || null,
      telefone: funcForm.telefone || null,
      email: funcForm.email || null,
      endereco: funcForm.endereco || null,
      cargo_id: funcForm.cargo_id || null,
      setor_id: funcForm.setor_id || null,
      turno_id: (funcForm as any).turno_id || null,
      salario: funcForm.salario || null,
      data_admissao: funcForm.data_admissao || null,
      tipo_contrato: funcForm.tipo_contrato || "clt",
      data_fim_experiencia: funcForm.data_fim_experiencia || null,
      data_fim_contrato: funcForm.data_fim_contrato || null,
      status: funcForm.status || "ativo",
      data_desligamento: funcForm.status === "desligado" ? (funcForm.data_desligamento || new Date().toISOString().slice(0,10)) : null,
      observacoes: funcForm.observacoes || null,
    };
    const { error } = funcForm.id
      ? await supabase.from("rh_funcionarios").update(payload).eq("id", funcForm.id)
      : await supabase.from("rh_funcionarios").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvo" });
    setFuncDialog(false); load();
  }

  async function desligar(f: Funcionario) {
    if (!confirm(`Desligar ${f.nome_completo}?`)) return;
    await supabase.from("rh_funcionarios").update({
      status: "desligado",
      data_desligamento: new Date().toISOString().slice(0,10),
    }).eq("id", f.id);
    load();
  }
  async function reativar(f: Funcionario) {
    await supabase.from("rh_funcionarios").update({ status: "ativo", data_desligamento: null }).eq("id", f.id);
    load();
  }

  async function salvarFerias() {
    if (!detalheFunc || !feriasForm.data_inicio || !feriasForm.data_fim) return;
    const { error } = await supabase.from("rh_ferias").insert({
      funcionario_id: detalheFunc.id,
      data_inicio: feriasForm.data_inicio,
      data_fim: feriasForm.data_fim,
      status: feriasForm.status || "programada",
      observacoes: feriasForm.observacoes || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFeriasForm({ status: "programada" }); setFeriasDialog(false); load();
  }
  async function removerFerias(id: string) {
    if (!confirm("Remover período de férias?")) return;
    await supabase.from("rh_ferias").delete().eq("id", id); load();
  }

  async function salvarOcorrencia() {
    if (!detalheFunc || !ocoForm.tipo) return;
    let anexo_url: string | null = null;
    if ((ocoForm as any)._file instanceof File) {
      const file = (ocoForm as any)._file as File;
      const path = `ocorrencias/${crypto.randomUUID()}-${file.name}`;
      const { error: e } = await supabase.storage.from("rh").upload(path, file);
      if (!e) anexo_url = supabase.storage.from("rh").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("rh_ocorrencias").insert({
      funcionario_id: detalheFunc.id,
      data: ocoForm.data || new Date().toISOString().slice(0,10),
      tipo: ocoForm.tipo,
      descricao: ocoForm.descricao || null,
      responsavel: ocoForm.responsavel || null,
      anexo_url,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOcoForm({ data: new Date().toISOString().slice(0,10) }); setOcoDialog(false); load();
  }
  async function removerOcorrencia(id: string) {
    if (!confirm("Remover ocorrência?")) return;
    await supabase.from("rh_ocorrencias").delete().eq("id", id); load();
  }

  async function salvarDocumento() {
    if (!detalheFunc || !docFile) return;
    const path = `documentos/${detalheFunc.id}/${crypto.randomUUID()}-${docFile.name}`;
    const { error: eU } = await supabase.storage.from("rh").upload(path, docFile);
    if (eU) { toast({ title: "Erro upload", description: eU.message, variant: "destructive" }); return; }
    const url = supabase.storage.from("rh").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("rh_documentos").insert({
      funcionario_id: detalheFunc.id, tipo: docForm.tipo, nome_arquivo: docFile.name, url, observacoes: docForm.observacoes || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDocFile(null); setDocForm({ tipo: "RG", observacoes: "" }); setDocDialog(false); load();
  }
  async function removerDocumento(id: string) {
    if (!confirm("Remover documento?")) return;
    await supabase.from("rh_documentos").delete().eq("id", id); load();
  }

  // ===== Turnos =====
  function abrirNovoTurno() {
    setTurnoForm({
      dias_semana: [1, 2, 3, 4, 5], tolerancia_min: 5,
      hora_entrada: "08:00", hora_saida_almoco: "12:00", hora_volta_almoco: "13:00", hora_saida: "17:00",
    });
    setTurnoDialog(true);
  }
  function abrirEditarTurno(t: Turno) { setTurnoForm(t); setTurnoDialog(true); }
  async function salvarTurno() {
    if (!turnoForm.nome?.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const payload: any = {
      nome: turnoForm.nome,
      hora_entrada: turnoForm.hora_entrada || "08:00",
      hora_saida_almoco: turnoForm.hora_saida_almoco || null,
      hora_volta_almoco: turnoForm.hora_volta_almoco || null,
      hora_saida: turnoForm.hora_saida || "17:00",
      dias_semana: turnoForm.dias_semana || [1,2,3,4,5],
      tolerancia_min: turnoForm.tolerancia_min ?? 5,
      observacoes: turnoForm.observacoes || null,
    };
    const { error } = (turnoForm as any).id
      ? await supabase.from("rh_turnos" as any).update(payload).eq("id", (turnoForm as any).id)
      : await supabase.from("rh_turnos" as any).insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setTurnoDialog(false); load();
  }
  async function removerTurno(id: string) {
    if (!confirm("Remover turno?")) return;
    await supabase.from("rh_turnos" as any).delete().eq("id", id); load();
  }

  // ===== Zonas =====
  async function salvarZona() {
    if (!zonaForm.nome?.trim() || zonaForm.latitude == null || zonaForm.longitude == null) {
      toast({ title: "Preencha nome, latitude e longitude", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("rh_zonas_ponto" as any).insert({
      nome: zonaForm.nome, setor_id: zonaForm.setor_id || null,
      latitude: zonaForm.latitude, longitude: zonaForm.longitude,
      raio_metros: zonaForm.raio_metros ?? 150,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setZonaForm({ raio_metros: 150 }); setZonaDialog(false); load();
  }
  async function removerZona(id: string) {
    if (!confirm("Remover zona?")) return;
    await supabase.from("rh_zonas_ponto" as any).delete().eq("id", id); load();
  }
  async function usarMinhaLocalizacao() {
    if (!navigator.geolocation) { toast({ title: "Geolocalização indisponível", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setZonaForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      (err) => toast({ title: "Erro localização", description: err.message, variant: "destructive" }),
      { enableHighAccuracy: true }
    );
  }

  // ===== Ponto =====
  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("Geolocalização indisponível"));
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 });
    });
  }
  async function tirarSelfie(): Promise<Blob | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      const video = document.createElement("video");
      video.srcObject = stream; await video.play();
      await new Promise(r => setTimeout(r, 600));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      return await new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", 0.8));
    } catch (e: any) {
      toast({ title: "Não foi possível acessar a câmera", description: e.message, variant: "destructive" });
      return null;
    }
  }
  async function baterPonto(funcionarioId: string, tipo: Ponto["tipo"]) {
    const func = funcs.find(f => f.id === funcionarioId);
    if (!func) return;
    const turno = turnos.find(t => t.id === func.turno_id);
    // localização
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await getLocation();
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (e: any) {
      toast({ title: "Localização necessária", description: e.message, variant: "destructive" }); return;
    }
    // valida zona
    const zonasAplic = zonas.filter(z => !z.setor_id || z.setor_id === func.setor_id);
    if (zonasAplic.length > 0) {
      const ok = zonasAplic.some(z => haversineM(lat!, lng!, z.latitude, z.longitude) <= z.raio_metros);
      if (!ok) { toast({ title: "Fora da zona autorizada", description: "Aproxime-se do local de trabalho.", variant: "destructive" }); return; }
    }
    // selfie
    const selfie = await tirarSelfie();
    let selfie_url: string | null = null;
    if (selfie) {
      const path = `pontos/${funcionarioId}/${Date.now()}.jpg`;
      const { error: eU } = await supabase.storage.from("rh").upload(path, selfie, { contentType: "image/jpeg" });
      if (!eU) selfie_url = supabase.storage.from("rh").getPublicUrl(path).data.publicUrl;
    }
    // atraso (apenas para entrada / volta_almoco)
    let atraso = 0;
    if (turno) {
      const ref = tipo === "entrada" ? turno.hora_entrada
        : tipo === "volta_almoco" ? turno.hora_volta_almoco
        : null;
      if (ref) {
        const diff = hmToMin(nowHM()) - hmToMin(ref);
        atraso = Math.max(0, diff);
      }
    }
    const origem = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "celular" : "sistema";
    const { error } = await supabase.from("rh_pontos" as any).insert({
      funcionario_id: funcionarioId, tipo, latitude: lat, longitude: lng,
      selfie_url, origem, atraso_min: atraso,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${TIPO_PONTO_LABEL[tipo]} registrada`, description: atraso > 0 ? `Atraso de ${atraso} min` : "No horário" });
    load();
  }

  // ===== Notificações de atraso =====
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (funcs.length === 0 || turnos.length === 0) return;
    const interval = setInterval(() => {
      const agora = new Date();
      const dow = agora.getDay();
      const nowMin = agora.getHours() * 60 + agora.getMinutes();
      const hoje = hojeISO();
      funcs.filter(f => f.status === "ativo" && f.turno_id).forEach(f => {
        const t = turnos.find(x => x.id === f.turno_id); if (!t) return;
        if (!t.dias_semana.includes(dow)) return;
        const pHoje = pontos.filter(p => p.funcionario_id === f.id && p.data === hoje);
        const checks: { tipo: Ponto["tipo"]; ref: string | null }[] = [
          { tipo: "entrada", ref: t.hora_entrada },
          { tipo: "saida_almoco", ref: t.hora_saida_almoco },
          { tipo: "volta_almoco", ref: t.hora_volta_almoco },
          { tipo: "saida", ref: t.hora_saida },
        ];
        for (const c of checks) {
          if (!c.ref) continue;
          if (pHoje.some(p => p.tipo === c.tipo)) continue;
          const limite = hmToMin(c.ref) + (t.tolerancia_min || 0) + 5;
          if (nowMin >= limite) {
            const key = `rh_aviso_${f.id}_${hoje}_${c.tipo}`;
            if (localStorage.getItem(key)) continue;
            localStorage.setItem(key, "1");
            const msg = `${f.nome_completo} — ${TIPO_PONTO_LABEL[c.tipo]} pendente (previsto ${c.ref})`;
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("RH — Atraso de ponto", { body: msg });
              }
            } catch {}
            toast({ title: "Atraso de ponto", description: msg, variant: "destructive" });
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [funcs, turnos, pontos]);

  // ===== Banco de horas =====
  const bancoLinhas = useMemo(() => {
    const fLista = bancoFiltroFunc === "todos" ? ativos : ativos.filter(f => f.id === bancoFiltroFunc);
    const out: { funcionario: Funcionario; data: string; trabalhado: number; previsto: number; saldo: number }[] = [];
    fLista.forEach(f => {
      const turno = turnos.find(t => t.id === f.turno_id);
      const datas = new Set(pontos.filter(p => p.funcionario_id === f.id && p.data >= bancoDe && p.data <= bancoAte).map(p => p.data));
      datas.forEach(d => {
        const ps = pontos.filter(p => p.funcionario_id === f.id && p.data === d);
        const { trabalhado, previsto, saldo } = calcSaldoDia(ps, turno);
        out.push({ funcionario: f, data: d, trabalhado, previsto, saldo });
      });
    });
    return out.sort((a, b) => b.data.localeCompare(a.data));
  }, [pontos, turnos, ativos, bancoFiltroFunc, bancoDe, bancoAte]);

  const bancoTotal = useMemo(() => bancoLinhas.reduce((s, l) => s + l.saldo, 0), [bancoLinhas]);

  const docsFunc = detalheFunc ? documentos.filter(d => d.funcionario_id === detalheFunc.id) : [];
  const feriasFunc = detalheFunc ? ferias.filter(d => d.funcionario_id === detalheFunc.id) : [];
  const ocoFunc = detalheFunc ? ocorrencias.filter(d => d.funcionario_id === detalheFunc.id) : [];

  return (
    <div>
      <PageHeader icon={Users} iconVariant="green" title="Recursos Humanos" subtitle="Gestão de funcionários, documentos, férias e ocorrências." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
          <TabsTrigger value="cargos">Cargos & Setores</TabsTrigger>
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
          <TabsTrigger value="ponto">Bater Ponto</TabsTrigger>
          <TabsTrigger value="desligados">Desligados</TabsTrigger>
          <TabsTrigger value="banco">Banco de Horas</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Funcionários ativos" value={ativos.length} />
            <KpiCard label="Em férias hoje" value={emFerias.length} />
            <KpiCard label="Vencimentos próximos (30/60 dias)" value={proximosVencimentos.length} />
            <KpiCard label="Desligados" value={desligados.length} />
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Próximos vencimentos</h3>
            {proximosVencimentos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum vencimento próximo.</p>
            ) : (
              <div className="space-y-1.5">
                {proximosVencimentos.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0">
                    <div>
                      <span className="font-medium">{v.funcionario.nome_completo}</span>
                      <span className="text-muted-foreground"> — {v.tipo}</span>
                    </div>
                    <Badge variant={v.dias <= 7 ? "destructive" : "secondary"}>
                      {v.dias === 0 ? "Hoje" : `${v.dias} dias`} ({new Date(v.data + "T00:00").toLocaleDateString("pt-BR")})
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plane className="w-4 h-4 text-sky-600" /> Em férias hoje</h3>
            {emFerias.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém em férias hoje.</p> :
              <div className="flex flex-wrap gap-2">
                {emFerias.map(f => <Badge key={f.id} variant="secondary">{f.nome_completo}</Badge>)}
              </div>}
          </Card>
        </TabsContent>

        {/* FUNCIONÁRIOS */}
        <TabsContent value="funcionarios" className="mt-4">
          <Card className="p-4 mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar nome, CPF, e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <Select value={filtroCargo} onValueChange={setFiltroCargo}>
                <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os cargos</SelectItem>
                  {cargos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos (não desligados)</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="ferias">Em férias</SelectItem>
                  <SelectItem value="desligado">Desligados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={abrirNovoFunc}><UserPlus className="w-4 h-4 mr-1.5" /> Novo funcionário</Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Cargo / Setor</th>
                    <th className="px-3 py-2">Contrato</th>
                    <th className="px-3 py-2">Admissão</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum funcionário encontrado.</td></tr>
                  ) : filtrados.map(f => (
                    <tr key={f.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {f.foto_url ? (
                            <img src={f.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {f.nome_completo.split(" ").map(x => x[0]).slice(0,2).join("")}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{f.nome_completo}</div>
                            <div className="text-xs text-muted-foreground">{f.email || f.telefone || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{cargoNome(f.cargo_id)}</div>
                        <div className="text-xs text-muted-foreground">{setorNome(f.setor_id)}</div>
                      </td>
                      <td className="px-3 py-2">{CONTRATO_LABEL[f.tipo_contrato]}</td>
                      <td className="px-3 py-2">{f.data_admissao ? new Date(f.data_admissao + "T00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetalheFunc(f)}><FileText className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEditarFunc(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                        {f.status !== "desligado" ? (
                          <Button size="sm" variant="ghost" onClick={() => desligar(f)} className="text-rose-600"><UserX className="w-3.5 h-3.5" /></Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => reativar(f)} className="text-emerald-600">Reativar</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* FÉRIAS */}
        <TabsContent value="ferias" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Início</th>
                    <th className="px-3 py-2">Fim</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Observações</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ferias.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sem registros.</td></tr>
                  ) : ferias.map(f => {
                    const fu = funcs.find(x => x.id === f.funcionario_id);
                    return (
                      <tr key={f.id} className="border-t">
                        <td className="px-3 py-2">{fu?.nome_completo || "—"}</td>
                        <td className="px-3 py-2">{new Date(f.data_inicio + "T00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2">{new Date(f.data_fim + "T00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2"><Badge variant="secondary">{f.status}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{f.observacoes || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => removerFerias(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">Para programar férias, abra o detalhe do funcionário.</p>
        </TabsContent>

        {/* OCORRÊNCIAS */}
        <TabsContent value="ocorrencias" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Anexo</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ocorrencias.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem registros.</td></tr>
                  ) : ocorrencias.map(o => {
                    const fu = funcs.find(x => x.id === o.funcionario_id);
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="px-3 py-2">{new Date(o.data + "T00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2">{fu?.nome_completo || "—"}</td>
                        <td className="px-3 py-2">{o.tipo}</td>
                        <td className="px-3 py-2">{o.descricao || "—"}</td>
                        <td className="px-3 py-2">{o.responsavel || "—"}</td>
                        <td className="px-3 py-2">{o.anexo_url ? <a className="text-primary underline" href={o.anexo_url} target="_blank" rel="noreferrer">ver</a> : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => removerOcorrencia(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">Para registrar uma ocorrência, abra o detalhe do funcionário.</p>
        </TabsContent>

        {/* CARGOS & SETORES */}
        <TabsContent value="cargos" className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Setores</h3>
              <Button size="sm" onClick={() => setSetorDialog(true)}>+ Novo</Button>
            </div>
            <div className="space-y-1">
              {setores.map(s => (
                <div key={s.id} className="flex items-center justify-between border-b py-1.5 text-sm">
                  <span>{s.nome}</span>
                  <Button size="sm" variant="ghost" onClick={() => removerSetor(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Cargos</h3>
              <Button size="sm" onClick={() => setCargoDialog(true)}>+ Novo</Button>
            </div>
            <div className="space-y-1">
              {cargos.map(c => (
                <div key={c.id} className="flex items-center justify-between border-b py-1.5 text-sm">
                  <span>{c.nome} <span className="text-xs text-muted-foreground">({setorNome(c.setor_id)})</span></span>
                  <Button size="sm" variant="ghost" onClick={() => removerCargo(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* DESLIGADOS */}
        <TabsContent value="desligados" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Cargo / Setor</th>
                    <th className="px-3 py-2">Admissão</th>
                    <th className="px-3 py-2">Desligamento</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {desligados.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum desligado.</td></tr>
                  ) : desligados.map(f => (
                    <tr key={f.id} className="border-t">
                      <td className="px-3 py-2">{f.nome_completo}</td>
                      <td className="px-3 py-2">{cargoNome(f.cargo_id)} / {setorNome(f.setor_id)}</td>
                      <td className="px-3 py-2">{f.data_admissao ? new Date(f.data_admissao + "T00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2">{f.data_desligamento ? new Date(f.data_desligamento + "T00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetalheFunc(f)}><FileText className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => reativar(f)} className="text-emerald-600">Reativar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TURNOS */}
        <TabsContent value="turnos" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Turnos de trabalho</h3>
              <Button size="sm" onClick={abrirNovoTurno}>+ Novo turno</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr className="text-left">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Entrada</th>
                  <th className="px-3 py-2">Almoço</th>
                  <th className="px-3 py-2">Saída</th>
                  <th className="px-3 py-2">Dias</th>
                  <th className="px-3 py-2">Tolerância</th>
                  <th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {turnos.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum turno cadastrado.</td></tr>
                  ) : turnos.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{t.nome}</td>
                      <td className="px-3 py-2">{t.hora_entrada?.slice(0,5)}</td>
                      <td className="px-3 py-2">{t.hora_saida_almoco?.slice(0,5) || "—"} / {t.hora_volta_almoco?.slice(0,5) || "—"}</td>
                      <td className="px-3 py-2">{t.hora_saida?.slice(0,5)}</td>
                      <td className="px-3 py-2 text-xs">{(t.dias_semana || []).map(d => DIAS_SEMANA[d]).join(", ")}</td>
                      <td className="px-3 py-2">{t.tolerancia_min} min</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => abrirEditarTurno(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => removerTurno(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Zonas autorizadas para bater ponto</h3>
              <Button size="sm" onClick={() => setZonaDialog(true)}>+ Nova zona</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">A marcação só é aceita dentro do raio de uma zona aplicável (do setor do funcionário ou geral).</p>
            <div className="space-y-1">
              {zonas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma zona cadastrada — qualquer localização será aceita.</p> :
                zonas.map(z => (
                  <div key={z.id} className="flex items-center justify-between border-b py-1.5 text-sm">
                    <div>
                      <span className="font-medium">{z.nome}</span>
                      <span className="text-xs text-muted-foreground"> · {z.setor_id ? setorNome(z.setor_id) : "Todos os setores"} · raio {z.raio_metros}m</span>
                      <div className="text-xs text-muted-foreground">{z.latitude.toFixed(5)}, {z.longitude.toFixed(5)}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerZona(z.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        {/* BATER PONTO */}
        <TabsContent value="ponto" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Fingerprint className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Marcação de ponto</h3>
                <p className="text-xs text-muted-foreground">Requer localização autorizada e selfie. Funciona em computador e celular.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <Label>Funcionário</Label>
                <Select value={pontoFuncId} onValueChange={setPontoFuncId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                  <SelectContent>
                    {ativos.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {pontoFuncId && (() => {
                const f = funcs.find(x => x.id === pontoFuncId);
                const t = turnos.find(x => x.id === f?.turno_id);
                return (
                  <div className="text-sm">
                    <Label>Turno</Label>
                    <div className="border rounded px-3 py-2 mt-1 text-xs">
                      {t ? <><span className="font-medium">{t.nome}</span> · {t.hora_entrada.slice(0,5)} → {t.hora_saida.slice(0,5)} · tol. {t.tolerancia_min} min</>
                        : <span className="text-muted-foreground">Sem turno atribuído</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
            {pontoFuncId && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["entrada","saida_almoco","volta_almoco","saida"] as const).map(t => (
                  <Button key={t} variant="outline" onClick={() => baterPonto(pontoFuncId, t)} className="h-auto py-3 flex-col">
                    <Camera className="w-4 h-4 mb-1" />
                    <span className="text-xs">{TIPO_PONTO_LABEL[t]}</span>
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Últimas marcações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr className="text-left">
                  <th className="px-3 py-2">Data/Hora</th>
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Atraso</th>
                  <th className="px-3 py-2">Geo</th>
                  <th className="px-3 py-2">Selfie</th>
                </tr></thead>
                <tbody>
                  {pontos.slice(0, 50).map(p => {
                    const f = funcs.find(x => x.id === p.funcionario_id);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2">{new Date(p.marcado_em).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2">{f?.nome_completo || "—"}</td>
                        <td className="px-3 py-2">{TIPO_PONTO_LABEL[p.tipo]}</td>
                        <td className="px-3 py-2"><Badge variant="secondary">{p.origem}</Badge></td>
                        <td className="px-3 py-2">{p.atraso_min > 0 ? <span className="text-rose-600">+{p.atraso_min} min</span> : "—"}</td>
                        <td className="px-3 py-2 text-xs">{p.latitude != null ? `${p.latitude.toFixed(4)}, ${p.longitude!.toFixed(4)}` : "—"}</td>
                        <td className="px-3 py-2">{p.selfie_url ? <a href={p.selfie_url} target="_blank" rel="noreferrer"><img src={p.selfie_url} className="w-8 h-8 rounded object-cover" /></a> : "—"}</td>
                      </tr>
                    );
                  })}
                  {pontos.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem marcações ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* BANCO DE HORAS */}
        <TabsContent value="banco" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
              <div>
                <Label>Funcionário</Label>
                <Select value={bancoFiltroFunc} onValueChange={setBancoFiltroFunc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ativos.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>De</Label><Input type="date" value={bancoDe} onChange={e => setBancoDe(e.target.value)} /></div>
              <div><Label>Até</Label><Input type="date" value={bancoAte} onChange={e => setBancoAte(e.target.value)} /></div>
              <div className="flex items-end">
                <div className="surface-card w-full text-center">
                  <div className="kpi-label">Saldo total</div>
                  <div className={`kpi-value mt-1 ${bancoTotal < 0 ? "text-rose-600" : "text-emerald-600"}`}>{minToHM(bancoTotal)}</div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr className="text-left">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Previsto</th>
                  <th className="px-3 py-2">Trabalhado</th>
                  <th className="px-3 py-2">Saldo</th>
                </tr></thead>
                <tbody>
                  {bancoLinhas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem registros no período.</td></tr>
                  ) : bancoLinhas.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{new Date(l.data + "T00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2">{l.funcionario.nome_completo}</td>
                      <td className="px-3 py-2">{minToHM(l.previsto)}</td>
                      <td className="px-3 py-2">{minToHM(l.trabalhado)}</td>
                      <td className={`px-3 py-2 font-medium ${l.saldo < 0 ? "text-rose-600" : "text-emerald-600"}`}>{minToHM(l.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Funcionário */}
      <Dialog open={funcDialog} onOpenChange={setFuncDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{funcForm.id ? "Editar" : "Novo"} funcionário</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-3 mt-1">
                {funcForm.foto_url && <img src={funcForm.foto_url} className="w-16 h-16 rounded-full object-cover" />}
                <Input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadFoto(f); if (url) setFuncForm(p => ({ ...p, foto_url: url }));
                }} />
              </div>
            </div>
            <div className="md:col-span-2"><Label>Nome completo *</Label><Input value={funcForm.nome_completo || ""} onChange={e => setFuncForm(p => ({...p, nome_completo: e.target.value}))} /></div>
            <div><Label>CPF</Label><Input value={funcForm.cpf || ""} onChange={e => setFuncForm(p => ({...p, cpf: maskCpf(e.target.value)}))} /></div>
            <div><Label>RG</Label><Input value={funcForm.rg || ""} onChange={e => setFuncForm(p => ({...p, rg: e.target.value}))} /></div>
            <div><Label>Telefone</Label><Input value={funcForm.telefone || ""} onChange={e => setFuncForm(p => ({...p, telefone: maskPhone(e.target.value)}))} /></div>
            <div><Label>E-mail</Label><Input type="email" value={funcForm.email || ""} onChange={e => setFuncForm(p => ({...p, email: e.target.value}))} /></div>
            <div className="md:col-span-2"><Label>Endereço</Label><Input value={funcForm.endereco || ""} onChange={e => setFuncForm(p => ({...p, endereco: e.target.value}))} /></div>
            <div>
              <Label>Setor</Label>
              <Select value={funcForm.setor_id || ""} onValueChange={v => setFuncForm(p => ({...p, setor_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={funcForm.cargo_id || ""} onValueChange={v => setFuncForm(p => ({...p, cargo_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cargos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={(funcForm as any).turno_id || ""} onValueChange={v => setFuncForm(p => ({...p, turno_id: v} as any))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{turnos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} ({t.hora_entrada.slice(0,5)}–{t.hora_saida.slice(0,5)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Salário</Label><Input type="number" step="0.01" value={funcForm.salario || ""} onChange={e => setFuncForm(p => ({...p, salario: e.target.value ? Number(e.target.value) : null}))} /></div>
            <div><Label>Data de admissão</Label><Input type="date" value={funcForm.data_admissao || ""} onChange={e => setFuncForm(p => ({...p, data_admissao: e.target.value}))} /></div>
            <div>
              <Label>Tipo de contrato</Label>
              <Select value={funcForm.tipo_contrato || "clt"} onValueChange={v => setFuncForm(p => ({...p, tipo_contrato: v as any}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                  <SelectItem value="terceirizado">Terceirizado</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={funcForm.status || "ativo"} onValueChange={v => setFuncForm(p => ({...p, status: v as any}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="desligado">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {funcForm.tipo_contrato === "clt" && (
              <div><Label>Fim da experiência</Label><Input type="date" value={funcForm.data_fim_experiencia || ""} onChange={e => setFuncForm(p => ({...p, data_fim_experiencia: e.target.value}))} /></div>
            )}
            {funcForm.tipo_contrato === "pj" && (
              <div><Label>Fim do contrato</Label><Input type="date" value={funcForm.data_fim_contrato || ""} onChange={e => setFuncForm(p => ({...p, data_fim_contrato: e.target.value}))} /></div>
            )}
            <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={3} value={funcForm.observacoes || ""} onChange={e => setFuncForm(p => ({...p, observacoes: e.target.value}))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFuncDialog(false)}>Cancelar</Button>
            <Button onClick={salvarFunc}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Setor */}
      <Dialog open={setorDialog} onOpenChange={setSetorDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo setor</DialogTitle></DialogHeader>
          <Input placeholder="Nome do setor" value={novoSetor} onChange={e => setNovoSetor(e.target.value)} />
          <DialogFooter><Button onClick={salvarSetor}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cargo */}
      <Dialog open={cargoDialog} onOpenChange={setCargoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cargo</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Nome do cargo" value={novoCargo.nome} onChange={e => setNovoCargo({...novoCargo, nome: e.target.value})} />
            <Select value={novoCargo.setor_id} onValueChange={v => setNovoCargo({...novoCargo, setor_id: v})}>
              <SelectTrigger><SelectValue placeholder="Setor (opcional)" /></SelectTrigger>
              <SelectContent>{setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={salvarCargo}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe Funcionário */}
      <Dialog open={!!detalheFunc} onOpenChange={(o) => !o && setDetalheFunc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detalheFunc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {detalheFunc.foto_url ? <img src={detalheFunc.foto_url} className="w-10 h-10 rounded-full object-cover" /> :
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {detalheFunc.nome_completo.split(" ").map(x => x[0]).slice(0,2).join("")}
                    </div>}
                  {detalheFunc.nome_completo}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                <div><span className="text-muted-foreground">Cargo:</span> {cargoNome(detalheFunc.cargo_id)}</div>
                <div><span className="text-muted-foreground">Setor:</span> {setorNome(detalheFunc.setor_id)}</div>
                <div><span className="text-muted-foreground">Contrato:</span> {CONTRATO_LABEL[detalheFunc.tipo_contrato]}</div>
                <div><span className="text-muted-foreground">Status:</span> <span className={`px-2 py-0.5 rounded ${STATUS_COLOR[detalheFunc.status]}`}>{STATUS_LABEL[detalheFunc.status]}</span></div>
                <div><span className="text-muted-foreground">CPF:</span> {detalheFunc.cpf || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {detalheFunc.telefone || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">E-mail:</span> {detalheFunc.email || "—"}</div>
              </div>

              <Tabs defaultValue="documentos">
                <TabsList>
                  <TabsTrigger value="documentos">Documentos ({docsFunc.length})</TabsTrigger>
                  <TabsTrigger value="ferias">Férias ({feriasFunc.length})</TabsTrigger>
                  <TabsTrigger value="ocorrencias">Ocorrências ({ocoFunc.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="documentos" className="mt-3">
                  <Button size="sm" onClick={() => setDocDialog(true)} className="mb-2"><Upload className="w-3.5 h-3.5 mr-1" /> Anexar documento</Button>
                  <div className="space-y-1">
                    {docsFunc.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum documento.</p> :
                      docsFunc.map(d => (
                        <div key={d.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                          <div>
                            <span className="font-medium">{d.tipo}</span>
                            <span className="text-muted-foreground"> — </span>
                            <a href={d.url} target="_blank" rel="noreferrer" className="text-primary underline">{d.nome_arquivo || "arquivo"}</a>
                            {d.observacoes && <span className="text-xs text-muted-foreground"> ({d.observacoes})</span>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removerDocumento(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                  </div>
                </TabsContent>
                <TabsContent value="ferias" className="mt-3">
                  <Button size="sm" onClick={() => setFeriasDialog(true)} className="mb-2"><Calendar className="w-3.5 h-3.5 mr-1" /> Programar férias</Button>
                  <div className="space-y-1">
                    {feriasFunc.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma férias.</p> :
                      feriasFunc.map(f => (
                        <div key={f.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                          <div>
                            {new Date(f.data_inicio + "T00:00").toLocaleDateString("pt-BR")} → {new Date(f.data_fim + "T00:00").toLocaleDateString("pt-BR")}
                            <Badge variant="secondary" className="ml-2">{f.status}</Badge>
                            {f.observacoes && <div className="text-xs text-muted-foreground">{f.observacoes}</div>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removerFerias(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                  </div>
                </TabsContent>
                <TabsContent value="ocorrencias" className="mt-3">
                  <Button size="sm" onClick={() => setOcoDialog(true)} className="mb-2"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Nova ocorrência</Button>
                  <div className="space-y-1">
                    {ocoFunc.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma ocorrência.</p> :
                      ocoFunc.map(o => (
                        <div key={o.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                          <div>
                            <span className="font-medium">{o.tipo}</span>
                            <span className="text-muted-foreground"> — {new Date(o.data + "T00:00").toLocaleDateString("pt-BR")}</span>
                            {o.descricao && <div className="text-xs">{o.descricao}</div>}
                            {o.responsavel && <div className="text-xs text-muted-foreground">Responsável: {o.responsavel}</div>}
                            {o.anexo_url && <a href={o.anexo_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">ver anexo</a>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removerOcorrencia(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Férias */}
      <Dialog open={feriasDialog} onOpenChange={setFeriasDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Programar férias</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Início</Label><Input type="date" value={feriasForm.data_inicio || ""} onChange={e => setFeriasForm(p => ({...p, data_inicio: e.target.value}))} /></div>
            <div><Label>Fim</Label><Input type="date" value={feriasForm.data_fim || ""} onChange={e => setFeriasForm(p => ({...p, data_fim: e.target.value}))} /></div>
            <div>
              <Label>Status</Label>
              <Select value={feriasForm.status || "programada"} onValueChange={v => setFeriasForm(p => ({...p, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="programada">Programada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={feriasForm.observacoes || ""} onChange={e => setFeriasForm(p => ({...p, observacoes: e.target.value}))} /></div>
          </div>
          <DialogFooter><Button onClick={salvarFerias}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ocorrência */}
      <Dialog open={ocoDialog} onOpenChange={setOcoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Data</Label><Input type="date" value={ocoForm.data || ""} onChange={e => setOcoForm(p => ({...p, data: e.target.value}))} /></div>
            <div><Label>Tipo</Label><Input placeholder="Advertência, elogio, atestado..." value={ocoForm.tipo || ""} onChange={e => setOcoForm(p => ({...p, tipo: e.target.value}))} /></div>
            <div><Label>Descrição</Label><Textarea value={ocoForm.descricao || ""} onChange={e => setOcoForm(p => ({...p, descricao: e.target.value}))} /></div>
            <div><Label>Responsável</Label><Input value={ocoForm.responsavel || ""} onChange={e => setOcoForm(p => ({...p, responsavel: e.target.value}))} /></div>
            <div><Label>Anexo (opcional)</Label><Input type="file" onChange={e => setOcoForm(p => ({...p, _file: e.target.files?.[0]} as any))} /></div>
          </div>
          <DialogFooter><Button onClick={salvarOcorrencia}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Documento */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anexar documento</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Tipo</Label>
              <Select value={docForm.tipo} onValueChange={v => setDocForm({...docForm, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Arquivo</Label><Input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} /></div>
            <div><Label>Observações</Label><Textarea value={docForm.observacoes} onChange={e => setDocForm({...docForm, observacoes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={salvarDocumento} disabled={!docFile}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Turno */}
      <Dialog open={turnoDialog} onOpenChange={setTurnoDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{(turnoForm as any).id ? "Editar" : "Novo"} turno</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={turnoForm.nome || ""} onChange={e => setTurnoForm(p => ({...p, nome: e.target.value}))} /></div>
            <div><Label>Entrada *</Label><Input type="time" value={turnoForm.hora_entrada || ""} onChange={e => setTurnoForm(p => ({...p, hora_entrada: e.target.value}))} /></div>
            <div><Label>Saída final *</Label><Input type="time" value={turnoForm.hora_saida || ""} onChange={e => setTurnoForm(p => ({...p, hora_saida: e.target.value}))} /></div>
            <div><Label>Saída almoço</Label><Input type="time" value={turnoForm.hora_saida_almoco || ""} onChange={e => setTurnoForm(p => ({...p, hora_saida_almoco: e.target.value}))} /></div>
            <div><Label>Volta almoço</Label><Input type="time" value={turnoForm.hora_volta_almoco || ""} onChange={e => setTurnoForm(p => ({...p, hora_volta_almoco: e.target.value}))} /></div>
            <div className="col-span-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {DIAS_SEMANA.map((d, i) => {
                  const ativo = (turnoForm.dias_semana || []).includes(i);
                  return (
                    <Button key={i} type="button" size="sm" variant={ativo ? "default" : "outline"}
                      onClick={() => setTurnoForm(p => ({
                        ...p,
                        dias_semana: ativo
                          ? (p.dias_semana || []).filter(x => x !== i)
                          : [...(p.dias_semana || []), i].sort()
                      }))}
                    >{d}</Button>
                  );
                })}
              </div>
            </div>
            <div><Label>Tolerância (min)</Label><Input type="number" value={turnoForm.tolerancia_min ?? 5} onChange={e => setTurnoForm(p => ({...p, tolerancia_min: Number(e.target.value)}))} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={turnoForm.observacoes || ""} onChange={e => setTurnoForm(p => ({...p, observacoes: e.target.value}))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTurnoDialog(false)}>Cancelar</Button>
            <Button onClick={salvarTurno}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Zona */}
      <Dialog open={zonaDialog} onOpenChange={setZonaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova zona autorizada</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Nome *</Label><Input value={zonaForm.nome || ""} onChange={e => setZonaForm(p => ({...p, nome: e.target.value}))} /></div>
            <div>
              <Label>Setor (opcional — em branco vale para todos)</Label>
              <Select value={zonaForm.setor_id || ""} onValueChange={v => setZonaForm(p => ({...p, setor_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                <SelectContent>{setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="0.000001" value={zonaForm.latitude ?? ""} onChange={e => setZonaForm(p => ({...p, latitude: e.target.value ? Number(e.target.value) : undefined}))} /></div>
              <div><Label>Longitude</Label><Input type="number" step="0.000001" value={zonaForm.longitude ?? ""} onChange={e => setZonaForm(p => ({...p, longitude: e.target.value ? Number(e.target.value) : undefined}))} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={usarMinhaLocalizacao}><MapPin className="w-3.5 h-3.5 mr-1" /> Usar minha localização</Button>
            <div><Label>Raio (metros)</Label><Input type="number" value={zonaForm.raio_metros ?? 150} onChange={e => setZonaForm(p => ({...p, raio_metros: Number(e.target.value)}))} /></div>
          </div>
          <DialogFooter><Button onClick={salvarZona}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

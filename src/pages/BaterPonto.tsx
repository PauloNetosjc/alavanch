import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Fingerprint, Camera, Clock, MapPin, History, AlertTriangle, CheckCircle2, Lock } from "lucide-react";

type HorarioDia = { hora_entrada?: string | null; hora_saida_almoco?: string | null; hora_volta_almoco?: string | null; hora_saida?: string | null };
type Turno = {
  id: string; nome: string;
  hora_entrada: string; hora_saida_almoco: string | null; hora_volta_almoco: string | null; hora_saida: string;
  dias_semana: number[]; tolerancia_min: number; observacoes: string | null;
  horarios_por_dia?: Record<string, HorarioDia> | null;
};
function getHorarioDia(turno: Turno, dow: number) {
  const ov = (turno.horarios_por_dia || {})[String(dow)] || {};
  return {
    hora_entrada: ov.hora_entrada || turno.hora_entrada,
    hora_saida_almoco: ov.hora_saida_almoco ?? turno.hora_saida_almoco,
    hora_volta_almoco: ov.hora_volta_almoco ?? turno.hora_volta_almoco,
    hora_saida: ov.hora_saida || turno.hora_saida,
  };
}
type Zona = { id: string; setor_id: string | null; cargo_id: string | null; funcionario_id: string | null; nome: string; latitude: number; longitude: number; raio_metros: number };
type Ponto = {
  id: string; funcionario_id: string; data: string;
  tipo: "entrada" | "saida_almoco" | "volta_almoco" | "saida";
  marcado_em: string; latitude: number | null; longitude: number | null;
  selfie_url: string | null; origem: "sistema" | "celular"; atraso_min: number;
};
type Funcionario = {
  id: string; nome_completo: string; foto_url: string | null;
  email: string | null; cargo_id: string | null; setor_id: string | null; turno_id: string | null;
  status: "ativo" | "afastado" | "ferias" | "desligado";
};

const TIPO_PONTO_LABEL: Record<string, string> = {
  entrada: "Entrada", saida_almoco: "Saída almoço", volta_almoco: "Volta almoço", saida: "Saída final",
};

function nowHM() { const d = new Date(); return d.toTimeString().slice(0, 5); }
function hmToMin(hm: string) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(lat2 - lat1); const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function BaterPonto() {
  const { user } = useAuth();
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);

  async function load() {
    if (!user?.email) { setLoading(false); return; }
    setLoading(true);
    const { data: f } = await supabase.from("rh_funcionarios" as any).select("*").ilike("email", user.email).limit(1).maybeSingle();
    const fn = (f as any) || null;
    setFunc(fn);
    if (fn?.turno_id) {
      const { data: t } = await supabase.from("rh_turnos" as any).select("*").eq("id", fn.turno_id).maybeSingle();
      setTurno((t as any) || null);
    } else setTurno(null);
    const { data: z } = await supabase.from("rh_zonas_ponto" as any).select("*");
    setZonas(((z as any) || []) as Zona[]);
    if (fn) {
      const { data: p } = await supabase.from("rh_pontos" as any).select("*").eq("funcionario_id", fn.id).order("marcado_em", { ascending: false }).limit(20);
      setPontos(((p as any) || []) as Ponto[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pontosHoje = useMemo(() => pontos.filter(p => p.data === hoje), [pontos, hoje]);
  const ORDEM = ["entrada", "saida_almoco", "volta_almoco", "saida"] as const;
  const jaFez = (tipo: string) => pontosHoje.some(p => p.tipo === tipo);
  const proximoIdx = ORDEM.findIndex(t => !jaFez(t));
  const horarioPrevisto = (tipo: typeof ORDEM[number]): string | null => {
    if (!turno) return null;
    const map: Record<string, string | null> = {
      entrada: turno.hora_entrada,
      saida_almoco: turno.hora_saida_almoco,
      volta_almoco: turno.hora_volta_almoco,
      saida: turno.hora_saida,
    };
    return map[tipo]?.slice(0, 5) ?? null;
  };

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

  async function baterPonto(tipo: Ponto["tipo"]) {
    if (!func) return;
    const idx = ORDEM.indexOf(tipo);
    if (idx > 0 && !jaFez(ORDEM[idx - 1])) {
      toast({ title: "Sequência obrigatória", description: `Bata primeiro: ${TIPO_PONTO_LABEL[ORDEM[idx - 1]]}.`, variant: "destructive" });
      return;
    }
    if (jaFez(tipo)) return;
    setMarcando(tipo);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await getLocation();
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch (e: any) {
        toast({ title: "Localização necessária", description: e.message, variant: "destructive" }); return;
      }
      const zonasAplic = zonas.filter(z =>
        (!z.setor_id && !z.cargo_id && !z.funcionario_id) ||
        (z.funcionario_id && z.funcionario_id === func.id) ||
        (z.cargo_id && z.cargo_id === func.cargo_id) ||
        (z.setor_id && z.setor_id === func.setor_id)
      );
      if (zonasAplic.length > 0) {
        const ok = zonasAplic.some(z => haversineM(lat!, lng!, z.latitude, z.longitude) <= z.raio_metros);
        if (!ok) { toast({ title: "Fora da zona autorizada", description: "Aproxime-se do local de trabalho.", variant: "destructive" }); return; }
      }
      const selfie = await tirarSelfie();
      let selfie_url: string | null = null;
      if (selfie) {
        const path = `pontos/${func.id}/${Date.now()}.jpg`;
        const { error: eU } = await supabase.storage.from("rh").upload(path, selfie, { contentType: "image/jpeg" });
        if (!eU) selfie_url = supabase.storage.from("rh").getPublicUrl(path).data.publicUrl;
      }
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
        funcionario_id: func.id, tipo, latitude: lat, longitude: lng,
        selfie_url, origem, atraso_min: atraso,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: `${TIPO_PONTO_LABEL[tipo]} registrada`, description: atraso > 0 ? `Atraso de ${atraso} min` : "No horário" });
      load();
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div>
      <PageHeader icon={Fingerprint} iconVariant="green" title="Bater Ponto" subtitle="Marcação rápida do ponto do colaborador logado." />

      {loading ? (
        <div className="text-sm text-muted-foreground p-6">Carregando…</div>
      ) : !func ? (
        <Card className="p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <h3 className="font-semibold">Funcionário não encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Não localizamos um cadastro em RH vinculado ao seu e-mail{user?.email ? ` (${user.email})` : ""}.
              Solicite ao administrador para cadastrar você em RH usando o mesmo e-mail de acesso.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              {func.foto_url
                ? <img src={func.foto_url} className="w-12 h-12 rounded-full object-cover" />
                : <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">{func.nome_completo.slice(0,1)}</div>}
              <div className="flex-1">
                <div className="font-semibold">{func.nome_completo}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Clock className="w-3 h-3" />
                  {turno
                    ? <>Turno <span className="font-medium">{turno.nome}</span> · {turno.hora_entrada.slice(0,5)} → {turno.hora_saida.slice(0,5)} · tol. {turno.tolerancia_min} min</>
                    : <span className="text-amber-600">Sem turno atribuído</span>}
                </div>
              </div>
              <Badge variant="secondary">{nowHM()}</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ORDEM.map((t, i) => {
                const feito = jaFez(t);
                const ehProximo = !feito && i === proximoIdx;
                const bloqueado = !feito && !ehProximo;
                const previsto = horarioPrevisto(t);
                const pontoFeito = pontosHoje.find(p => p.tipo === t);
                const horaReal = pontoFeito ? new Date(pontoFeito.marcado_em).toTimeString().slice(0, 5) : null;
                return (
                  <Button
                    key={t}
                    variant={feito ? "secondary" : ehProximo ? "default" : "outline"}
                    disabled={marcando !== null || feito || bloqueado}
                    onClick={() => baterPonto(t)}
                    className={`h-auto py-3 flex-col relative ${feito ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15" : ""} ${ehProximo ? "ring-2 ring-primary/60" : ""} ${bloqueado ? "opacity-60" : ""}`}
                  >
                    <div className="absolute top-1.5 right-1.5">
                      {feito
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        : bloqueado
                          ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          : <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">PRÓXIMO</span>}
                    </div>
                    <Camera className="w-4 h-4 mb-1" />
                    <span className="text-xs font-medium">{TIPO_PONTO_LABEL[t]}</span>
                    {previsto && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> previsto {previsto}
                      </span>
                    )}
                    {feito && horaReal && (
                      <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">batido {horaReal}</span>
                    )}
                    {bloqueado && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">aguardando anterior</span>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 mt-3">
              {ORDEM.map((t, i) => {
                const feito = jaFez(t);
                const ehProximo = !feito && i === proximoIdx;
                return (
                  <div key={t} className="flex items-center gap-1 flex-1">
                    <div className={`flex-1 h-1.5 rounded-full ${feito ? "bg-emerald-500" : ehProximo ? "bg-primary/60" : "bg-muted"}`} />
                    {i < ORDEM.length - 1 && <span className="text-muted-foreground text-xs">›</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-3">
              <MapPin className="w-3 h-3" /> Requer localização e selfie. Disponível no computador e no celular.
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Minhas últimas marcações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr className="text-left">
                  <th className="px-3 py-2">Data/Hora</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Atraso</th>
                  <th className="px-3 py-2">Selfie</th>
                </tr></thead>
                <tbody>
                  {pontos.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{new Date(p.marcado_em).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2">{TIPO_PONTO_LABEL[p.tipo]}</td>
                      <td className="px-3 py-2"><Badge variant="secondary">{p.origem}</Badge></td>
                      <td className="px-3 py-2">{p.atraso_min > 0 ? <span className="text-rose-600">+{p.atraso_min} min</span> : "—"}</td>
                      <td className="px-3 py-2">{p.selfie_url ? <a href={p.selfie_url} target="_blank" rel="noreferrer"><img src={p.selfie_url} className="w-8 h-8 rounded object-cover" /></a> : "—"}</td>
                    </tr>
                  ))}
                  {pontos.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem marcações ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

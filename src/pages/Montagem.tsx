import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Hammer, MapPin, Camera, CheckCircle2, LogOut } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  codigo: string | null;
  tipo: string;
  status: string | null;
  descricao: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  cliente: { nome: string; telefone: string | null; endereco: string | null } | null;
};

const statusColor: Record<string, string> = {
  triagem: "bg-slate-500", agendada: "bg-blue-500", em_atendimento: "bg-amber-500",
  aguardando_material: "bg-purple-500", concluida: "bg-emerald-600", cancelada: "bg-red-500",
};

export default function Montagem() {
  const { user, signOut, profile } = useAuth();
  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [obs, setObs] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("assistencias")
      .select("id, codigo, tipo, status, descricao, data_agendamento, hora_agendamento, cliente:clientes(nome, telefone, endereco)")
      .eq("tecnico_id", user.id)
      .neq("status", "concluida")
      .neq("status", "cancelada")
      .order("data_agendamento", { ascending: true, nullsFirst: false });
    setList((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const checkin = async (item: Item) => {
    const tryGeo = () =>
      new Promise<{ lat?: number; lng?: number }>((res) => {
        if (!navigator.geolocation) return res({});
        navigator.geolocation.getCurrentPosition(
          (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => res({}), { timeout: 5000 }
        );
      });
    const { lat, lng } = await tryGeo();
    const { error } = await supabase.from("checkins").insert({
      assistencia_id: item.id, montador_id: user?.id,
      latitude: lat, longitude: lng,
    });
    if (error) return toast.error(error.message);
    await supabase.from("assistencias").update({ status: "em_atendimento" }).eq("id", item.id);
    toast.success("Check-in registrado");
    load();
  };

  const concluir = async (item: Item) => {
    if (obs.trim()) {
      // simples: anota descrição extra (sem upload de foto neste passo)
      await supabase.from("assistencias")
        .update({ status: "concluida", observacoes: obs })
        .eq("id", item.id);
    } else {
      await supabase.from("assistencias").update({ status: "concluida" }).eq("id", item.id);
    }
    toast.success("Chamado concluído");
    setSelected(null); setObs("");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar mobile-first */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-medium flex items-center gap-2">
            <Hammer className="w-4 h-4" /> Meus Chamados
          </div>
          <div className="text-[10px] text-muted-foreground">{profile?.nome_completo || user?.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3 max-w-md mx-auto">
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-10 text-center">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <div className="text-[13px]">Nenhum chamado pendente</div>
            <div className="text-[11px] text-muted-foreground mt-1">Bom trabalho!</div>
          </div>
        ) : (
          list.map((it) => (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className="w-full text-left surface-card p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-[13px]">{it.codigo}</div>
                <Badge className={`text-[10px] text-white ${statusColor[it.status || "triagem"]}`}>
                  {(it.status || "triagem").replace("_", " ")}
                </Badge>
              </div>
              <div className="text-[12px]">{it.cliente?.nome || "—"}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{it.tipo}</div>
              {it.data_agendamento && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  📅 {new Date(it.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}
                  {it.hora_agendamento ? ` às ${it.hora_agendamento.slice(0, 5)}` : ""}
                </div>
              )}
              {it.cliente?.endereco && (
                <div className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {it.cliente.endereco}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.codigo} — {selected.tipo}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Cliente</div>
                  <div className="text-[13px] font-medium">{selected.cliente?.nome}</div>
                  {selected.cliente?.telefone && (
                    <a className="text-[12px] text-primary" href={`tel:${selected.cliente.telefone}`}>
                      {selected.cliente.telefone}
                    </a>
                  )}
                </div>
                {selected.cliente?.endereco && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Endereço</div>
                    <div className="text-[12px]">{selected.cliente.endereco}</div>
                    <a
                      className="text-[11px] text-primary inline-flex items-center gap-1 mt-1"
                      target="_blank" rel="noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.cliente.endereco)}`}
                    >
                      <MapPin className="w-3 h-3" /> Abrir no mapa
                    </a>
                  </div>
                )}
                {selected.descricao && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Descrição</div>
                    <div className="text-[12px]">{selected.descricao}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => checkin(selected)} variant="outline" size="sm">
                    <MapPin className="w-3.5 h-3.5 mr-1.5" /> Check-in
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <Camera className="w-3.5 h-3.5 mr-1.5" /> Foto
                  </Button>
                </div>

                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                    Observações de conclusão
                  </div>
                  <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>

                <Button onClick={() => concluir(selected)} className="w-full">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Concluir Chamado
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

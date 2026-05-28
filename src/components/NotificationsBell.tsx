import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { ShieldCheck } from "lucide-react";

type Notif = {
  id: string; titulo: string; mensagem: string | null;
  link: string | null; lida: boolean; created_at: string;
  metadata: any;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [autPend, setAutPend] = useState(0);

  const carregar = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("notificacoes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setNotifs(data || []);
  };

  const carregarAutorizacoes = async () => {
    const { count } = await (supabase as any)
      .from("autorizacoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    setAutPend(count || 0);
  };

  useEffect(() => {
    carregar();
    carregarAutorizacoes();
    if (!user?.id) return;
    const ch = supabase.channel(`notif_${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` }, () => carregar())
      .subscribe();
    const chAut = supabase.channel(`aut_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "autorizacoes" }, () => carregarAutorizacoes())
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(chAut); };
  }, [user?.id]);

  const naoLidas = notifs.filter(n => !n.lida).length;
  const totalBadge = naoLidas + autPend;

  const abrir = async (n: Notif) => {
    if (!n.lida) await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    if (n.link) navigate(n.link);
    carregar();
  };

  const marcarTodas = async () => {
    if (!user?.id) return;
    await supabase.from("notificacoes").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    carregar();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-4 relative w-9 h-9 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {totalBadge > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{totalBadge > 9 ? "9+" : totalBadge}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-[12px] font-semibold uppercase tracking-wider">Notificações</span>
          {naoLidas > 0 && <button onClick={marcarTodas} className="text-[10px] text-[#2D6BE5] hover:underline">Marcar todas</button>}
        </div>
        {autPend > 0 && (
          <button
            onClick={() => navigate("/autorizacoes")}
            className="block w-full text-left px-3 py-2 border-b bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <div className="text-[12px] font-semibold flex items-center gap-1.5 text-amber-900">
              <ShieldCheck className="w-3.5 h-3.5" />
              {autPend} {autPend === 1 ? "autorização pendente" : "autorizações pendentes"}
            </div>
            <div className="text-[11px] text-amber-800">Toque para abrir a Central de Autorizações.</div>
          </button>
        )}
        {notifs.length === 0 && autPend === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground">Nenhuma notificação</div>
        ) : notifs.map(n => (
          <button key={n.id} onClick={() => abrir(n)} className={`block w-full text-left px-3 py-2 border-b hover:bg-accent ${!n.lida ? "bg-blue-50/50" : ""}`}>
            <div className="text-[12px] font-semibold flex items-center gap-1.5">
              {!n.lida && <span className="w-1.5 h-1.5 rounded-full bg-[#2D6BE5]" />}
              {n.titulo}
            </div>
            {n.mensagem && <div className="text-[11px] text-muted-foreground line-clamp-2">{n.mensagem}</div>}
            <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

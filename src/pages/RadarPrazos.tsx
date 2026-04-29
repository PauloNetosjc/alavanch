import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarClock, Truck, Hammer, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Pedido = {
  id: string;
  codigo: string;
  status: string;
  valor_total: number;
  data_envio_fabrica: string | null;
  data_montagem: string | null;
  data_vistoria: string | null;
  cliente: { nome: string } | null;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const diffDays = (dateStr: string | null) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

const slaBadge = (days: number | null) => {
  if (days === null) return <Badge variant="outline" className="text-[10px]">—</Badge>;
  if (days < 0) return <Badge className="bg-red-600 text-white text-[10px]">Atrasado {Math.abs(days)}d</Badge>;
  if (days <= 3) return <Badge className="bg-amber-500 text-white text-[10px]">{days}d</Badge>;
  if (days <= 7) return <Badge className="bg-yellow-500 text-black text-[10px]">{days}d</Badge>;
  return <Badge variant="outline" className="text-[10px]">{days}d</Badge>;
};

export default function RadarPrazos() {
  const nav = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "atrasado" | "criticos" | "semana">("todos");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, codigo, status, valor_total, data_envio_fabrica, data_montagem, data_vistoria, cliente:clientes(nome)")
        .order("data_montagem", { ascending: true, nullsFirst: false });
      setPedidos((data || []) as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return pedidos.filter((p) => {
      const t = search.toLowerCase();
      const matchTxt = !t || p.codigo.toLowerCase().includes(t) || (p.cliente?.nome || "").toLowerCase().includes(t);
      if (!matchTxt) return false;
      const dMon = diffDays(p.data_montagem);
      const dFab = diffDays(p.data_envio_fabrica);
      const minD = [dMon, dFab].filter((x) => x !== null).reduce((a, b) => Math.min(a as number, b as number), Number.POSITIVE_INFINITY) as number;
      if (filter === "atrasado") return minD < 0;
      if (filter === "criticos") return minD >= 0 && minD <= 3;
      if (filter === "semana") return minD >= 0 && minD <= 7;
      return true;
    });
  }, [pedidos, search, filter]);

  const stats = useMemo(() => {
    let atrasados = 0, criticos = 0, semana = 0;
    pedidos.forEach((p) => {
      const d = Math.min(
        diffDays(p.data_montagem) ?? Infinity,
        diffDays(p.data_envio_fabrica) ?? Infinity,
        diffDays(p.data_vistoria) ?? Infinity,
      );
      if (d === Infinity) return;
      if (d < 0) atrasados++;
      else if (d <= 3) criticos++;
      else if (d <= 7) semana++;
    });
    return { atrasados, criticos, semana, total: pedidos.length };
  }, [pedidos]);

  return (
    <div className="space-y-6">
      <div>
        <h1>Radar de Prazos</h1>
        <p className="text-[12px] text-muted-foreground mt-1">
          Acompanhe envios à fábrica, montagens e vistorias com alertas de SLA.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Atrasados</div>
          <div className="text-[22px] font-medium text-red-500 mt-1">{stats.atrasados}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Críticos (≤3d)</div>
          <div className="text-[22px] font-medium text-amber-500 mt-1">{stats.criticos}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Próximos 7d</div>
          <div className="text-[22px] font-medium text-yellow-500 mt-1">{stats.semana}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Pedidos</div>
          <div className="text-[22px] font-medium mt-1">{stats.total}</div>
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Input
            placeholder="Buscar por código ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="criticos">Críticos (≤3d)</SelectItem>
              <SelectItem value="semana">Próximos 7d</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-10 text-center">Nenhum pedido encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-normal">Código</th>
                  <th className="py-2 px-2 font-normal">Cliente</th>
                  <th className="py-2 px-2 font-normal">Status</th>
                  <th className="py-2 px-2 font-normal"><Truck className="inline w-3 h-3 mr-1" />Fábrica</th>
                  <th className="py-2 px-2 font-normal"><Hammer className="inline w-3 h-3 mr-1" />Montagem</th>
                  <th className="py-2 px-2 font-normal"><CalendarClock className="inline w-3 h-3 mr-1" />Vistoria</th>
                  <th className="py-2 px-2 font-normal text-right">Valor</th>
                  <th className="py-2 px-2 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{p.codigo}</td>
                    <td className="py-2 px-2">{p.cliente?.nome || "—"}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    </td>
                    <td className="py-2 px-2">{slaBadge(diffDays(p.data_envio_fabrica))}</td>
                    <td className="py-2 px-2">{slaBadge(diffDays(p.data_montagem))}</td>
                    <td className="py-2 px-2">{slaBadge(diffDays(p.data_vistoria))}</td>
                    <td className="py-2 px-2 text-right">{fmtBRL(Number(p.valor_total || 0))}</td>
                    <td className="py-2 px-2">
                      <button
                        className="p-1 hover:text-foreground text-muted-foreground"
                        onClick={() => nav(`/comercial/${p.id}`)}
                        title="Detalhar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        Pedidos ficam atrasados quando a data planejada já passou.
      </div>
    </div>
  );
}

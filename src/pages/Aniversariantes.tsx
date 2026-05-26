import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Cake, Users, Building2, UserCog, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Pessoa = {
  id: string;
  nome: string;
  data_nascimento: string;
  origem: "cliente" | "parceiro" | "funcionario";
  email?: string | null;
  telefone?: string | null;
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const COR: Record<Pessoa["origem"], string> = {
  cliente: "bg-blue-500/15 text-blue-700 border-blue-300",
  parceiro: "bg-purple-500/15 text-purple-700 border-purple-300",
  funcionario: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
};

const LABEL: Record<Pessoa["origem"], string> = {
  cliente: "Cliente",
  parceiro: "Parceiro",
  funcionario: "Funcionário",
};

export default function Aniversariantes() {
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: clis }, { data: pars }, { data: profs }] = await Promise.all([
        supabase.from("clientes").select("id, nome, data_nascimento, email, telefone").not("data_nascimento", "is", null),
        supabase.from("parceiros").select("id, nome, data_nascimento, email, telefone").not("data_nascimento", "is", null),
        supabase.from("profiles").select("user_id, nome_completo, data_nascimento, telefone").not("data_nascimento", "is", null),
      ]);
      const lista: Pessoa[] = [
        ...((clis as any[]) || []).map((c) => ({ id: c.id, nome: c.nome, data_nascimento: c.data_nascimento, email: c.email, telefone: c.telefone, origem: "cliente" as const })),
        ...((pars as any[]) || []).map((p) => ({ id: p.id, nome: p.nome, data_nascimento: p.data_nascimento, email: p.email, telefone: p.telefone, origem: "parceiro" as const })),
        ...((profs as any[]) || []).map((p) => ({ id: p.user_id, nome: p.nome_completo || "Sem nome", data_nascimento: p.data_nascimento, telefone: p.telefone, origem: "funcionario" as const })),
      ];
      setPessoas(lista);
      setLoading(false);
    })();
  }, []);

  const aniversariantes = useMemo(() => {
    return pessoas
      .filter((p) => {
        const d = new Date(p.data_nascimento + "T00:00:00");
        return d.getMonth() + 1 === mes;
      })
      .sort((a, b) => {
        const da = new Date(a.data_nascimento + "T00:00:00").getDate();
        const db = new Date(b.data_nascimento + "T00:00:00").getDate();
        return da - db;
      });
  }, [pessoas, mes]);

  const idadeAtual = (nasc: string) => {
    const d = new Date(nasc + "T00:00:00");
    const hoje = new Date();
    let i = hoje.getFullYear() - d.getFullYear();
    const m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) i--;
    return i;
  };

  const fmtDia = (s: string) => {
    const d = new Date(s + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div>
      <PageHeader
        title="Aniversariantes do Mês"
        subtitle="Clientes, parceiros e funcionários que aniversariam no mês"
        icon={Cake}
        actions={
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {(["cliente","parceiro","funcionario"] as const).map((o) => {
          const total = aniversariantes.filter((p) => p.origem === o).length;
          const Icon = o === "cliente" ? Users : o === "parceiro" ? Building2 : UserCog;
          return (
            <div key={o} className={`surface-card p-4 flex items-center gap-3 border ${COR[o]}`}>
              <Icon className="w-7 h-7" />
              <div>
                <div className="text-[11px] uppercase tracking-wider opacity-70">{LABEL[o]}s</div>
                <div className="text-2xl font-semibold">{total}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : aniversariantes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Cake className="w-10 h-10 opacity-40" />
            Nenhum aniversariante em {MESES[mes - 1]}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-3 px-4">Dia</th>
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Tipo</th>
                <th className="text-left py-3 px-4">Idade</th>
                <th className="text-left py-3 px-4">Contato</th>
              </tr>
            </thead>
            <tbody>
              {aniversariantes.map((p) => (
                <tr key={`${p.origem}-${p.id}`} className="border-b hover:bg-muted/30">
                  <td className="py-3 px-4 font-mono font-semibold">{fmtDia(p.data_nascimento)}</td>
                  <td className="py-3 px-4 font-medium">{p.nome}</td>
                  <td className="py-3 px-4"><Badge variant="outline" className={COR[p.origem]}>{LABEL[p.origem]}</Badge></td>
                  <td className="py-3 px-4">{idadeAtual(p.data_nascimento)} anos</td>
                  <td className="py-3 px-4 text-muted-foreground text-[12px]">
                    {p.telefone && <span className="inline-flex items-center gap-1 mr-3"><Phone className="w-3 h-3" />{p.telefone}</span>}
                    {p.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

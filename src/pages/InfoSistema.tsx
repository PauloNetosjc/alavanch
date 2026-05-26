import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, HardDrive, Users } from "lucide-react";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function InfoSistema() {
  const [lojas, setLojas] = useState<number | null>(null);
  const [usuarios, setUsuarios] = useState<number | null>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const storageLimit = 40 * 1024 * 1024 * 1024; // 40 GB referência

  useEffect(() => {
    (async () => {
      const [{ count: lc }, { count: uc }] = await Promise.all([
        supabase.from("lojas").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setLojas(lc ?? 0);
      setUsuarios(uc ?? 0);

      // Tenta listar buckets e somar tamanhos (best-effort)
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        let total = 0;
        for (const b of buckets ?? []) {
          const { data: files } = await supabase.storage.from(b.name).list("", { limit: 1000 });
          for (const f of files ?? []) {
            total += (f.metadata as any)?.size ?? 0;
          }
        }
        setStorage(total);
      } catch {
        setStorage(0);
      }
    })();
  }, []);

  const cards = [
    {
      icon: Building2,
      title: "Lojas cadastradas",
      value: lojas == null ? "…" : `${lojas}`,
      sub: "unidades de negócio",
    },
    {
      icon: HardDrive,
      title: "Espaço utilizado",
      value: storage == null ? "…" : `${formatBytes(storage)} / ${formatBytes(storageLimit)}`,
      sub: "armazenamento de arquivos",
    },
    {
      icon: Users,
      title: "Usuários",
      value: usuarios == null ? "…" : `${usuarios}`,
      sub: "contas ativas no sistema",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl">Info Sistema</h1>
        <p className="text-sm text-muted-foreground">Visão geral de uso da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground font-medium">{c.title}</CardTitle>
              <c.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

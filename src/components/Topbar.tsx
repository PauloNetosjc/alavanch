import { useEffect, useState, useRef } from "react";
import { Search, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { NotificationsBell } from "@/components/NotificationsBell";
import { TopbarLojaSwitcher } from "@/components/TopbarLojaSwitcher";


type Result = {
  id: string;
  type: "Clientes" | "Orçamentos" | "Pedidos";
  title: string;
  subtitle?: string;
  path: string;
};

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const term = `%${q}%`;
      const [c, o, p] = await Promise.all([
        supabase.from("clientes").select("id,nome,cpf_cnpj").or(`nome.ilike.${term},cpf_cnpj.ilike.${term}`).limit(5),
        supabase.from("orcamentos").select("id,codigo,nome_projeto").or(`codigo.ilike.${term},nome_projeto.ilike.${term}`).limit(5),
        supabase.from("pedidos").select("id,codigo").ilike("codigo", term).limit(5),
      ]);
      if (cancelled) return;
      const r: Result[] = [];
      (c.data || []).forEach((x: any) => r.push({ id: x.id, type: "Clientes", title: x.nome, subtitle: x.cpf_cnpj || undefined, path: `/clientes` }));
      (o.data || []).forEach((x: any) => r.push({ id: x.id, type: "Orçamentos", title: x.codigo, subtitle: x.nome_projeto, path: `/comercial` }));
      (p.data || []).forEach((x: any) => r.push({ id: x.id, type: "Pedidos", title: x.codigo, path: `/comercial` }));
      setResults(r);
    };
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

  return (
    <header
      className="h-14 flex items-center px-3 sm:px-4 md:px-6 sticky top-0 z-30 gap-2"
      style={{ background: "hsl(var(--background))", borderBottom: "0.5px solid hsl(var(--border))" }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onOpenMobileMenu}
        className="md:hidden h-9 w-9 flex items-center justify-center rounded-md hover:bg-secondary shrink-0"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="relative flex-1 max-w-2xl mx-auto min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar…"
          className="w-full h-9 pl-9 pr-3 sm:pr-16 rounded-md text-[13px] bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ border: "0.5px solid hsl(var(--border))" }}
        />
        <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-secondary">
          ⌘K
        </kbd>

        {open && q.trim().length >= 2 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-card rounded-md shadow-lg max-h-96 overflow-y-auto z-40"
            style={{ border: "0.5px solid hsl(var(--border))" }}
          >
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Nenhum resultado</div>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                    {type}
                  </div>
                  {items.map((r) => (
                    <button
                      key={`${type}-${r.id}`}
                      onMouseDown={() => {
                        navigate(r.path);
                        setOpen(false);
                        setQ("");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[13px]">{r.title}</div>
                        {r.subtitle && <div className="text-[11px] text-muted-foreground">{r.subtitle}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <TopbarLojaSwitcher />
        <NotificationsBell />
      </div>
    </header>
  );
}

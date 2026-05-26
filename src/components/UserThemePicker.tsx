import { useEffect, useState, useRef } from "react";
import { Palette, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Prefs = {
  accent: string; // hsl values "H S% L%"
  contrast: "normal" | "alto";
  fontSize: "sm" | "md" | "lg";
};

const ACCENTS: { name: string; value: string; preview: string }[] = [
  { name: "Verde Floresta", value: "142 35% 32%", preview: "#3a6b4d" },
  { name: "Dourado", value: "38 45% 55%", preview: "#c9a14a" },
  { name: "Âmbar", value: "32 90% 50%", preview: "#f08b1a" },
  { name: "Azul Petróleo", value: "190 55% 35%", preview: "#298a9e" },
  { name: "Vinho", value: "350 55% 38%", preview: "#9c2c44" },
  { name: "Roxo", value: "265 50% 50%", preview: "#7a47c2" },
  { name: "Grafite", value: "220 10% 35%", preview: "#525866" },
  { name: "Cobre", value: "18 60% 45%", preview: "#b85a2e" },
];

const DEFAULT: Prefs = { accent: "142 35% 32%", contrast: "normal", fontSize: "md" };

function storageKey(uid?: string | null) {
  return `user_theme_prefs:${uid ?? "anon"}`;
}

export function applyUserTheme(p: Prefs) {
  const r = document.documentElement;
  r.style.setProperty("--primary", p.accent);
  r.style.setProperty("--ring", p.accent);
  r.style.setProperty("--sidebar-primary", p.accent);
  // tokens lidos pela sidebar
  r.style.setProperty("--user-accent", p.accent);
  r.style.setProperty("--user-accent-bg", `hsl(${p.accent} / 0.22)`);
  // contraste
  if (p.contrast === "alto") {
    r.style.setProperty("--foreground", "0 0% 8%");
    r.style.setProperty("--muted-foreground", "0 0% 25%");
  } else {
    r.style.removeProperty("--foreground");
    r.style.removeProperty("--muted-foreground");
  }
  // fonte
  const size = p.fontSize === "sm" ? "14px" : p.fontSize === "lg" ? "17px" : "15px";
  r.style.setProperty("font-size", size);
}


export function useUserThemeBoot() {
  const { user } = useAuth();
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(user?.id));
    const p = raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    applyUserTheme(p);
  }, [user?.id]);
}

export function UserThemePicker({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(user?.id));
    if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
    else setPrefs(DEFAULT);
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Posição ancorada ao botão (popover sai para a direita da sidebar)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const update = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const w = 260, gap = 8;
      let left = r.right + gap;
      // se não couber à direita, encosta na borda direita da viewport
      if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
      const bottom = Math.max(8, window.innerHeight - r.bottom);
      setPos({ left, bottom });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(storageKey(user?.id), JSON.stringify(next));
    applyUserTheme(next);
  };

  const reset = () => {
    localStorage.removeItem(storageKey(user?.id));
    setPrefs(DEFAULT);
    applyUserTheme(DEFAULT);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Personalizar aparência"
        aria-label="Personalizar aparência"
        className="w-6 h-6 rounded-full flex items-center justify-center text-[#888] hover:text-white hover:bg-[#1F1F1F] transition-colors"
      >
        <Palette className="w-3.5 h-3.5" />
      </button>

      {open && pos && (
        <div
          className="fixed z-[100] w-[260px] rounded-md p-3 shadow-xl"
          style={{
            background: "#1A1A1A",
            border: "0.5px solid #2A2A2A",
            left: pos.left,
            bottom: pos.bottom,
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#888] mb-2">Cor de destaque</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {ACCENTS.map((a) => {
              const active = prefs.accent === a.value;
              return (
                <button
                  key={a.value}
                  onClick={() => update({ accent: a.value })}
                  title={a.name}
                  className="aspect-square rounded-md flex items-center justify-center transition-transform hover:scale-105"
                  style={{
                    background: a.preview,
                    border: active ? "2px solid #FFF" : "0.5px solid #2A2A2A",
                  }}
                >
                  {active && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] uppercase tracking-[0.12em] text-[#888] mb-2">Contraste</div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {(["normal", "alto"] as const).map((c) => (
              <button
                key={c}
                onClick={() => update({ contrast: c })}
                className="text-[11px] py-1.5 rounded-md transition-colors"
                style={{
                  background: prefs.contrast === c ? "#2A2A2A" : "transparent",
                  border: "0.5px solid #2A2A2A",
                  color: prefs.contrast === c ? "#FFF" : "#AAA",
                }}
              >
                {c === "normal" ? "Normal" : "Alto contraste"}
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-[0.12em] text-[#888] mb-2">Tamanho da fonte</div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                onClick={() => update({ fontSize: s })}
                className="text-[11px] py-1.5 rounded-md transition-colors"
                style={{
                  background: prefs.fontSize === s ? "#2A2A2A" : "transparent",
                  border: "0.5px solid #2A2A2A",
                  color: prefs.fontSize === s ? "#FFF" : "#AAA",
                }}
              >
                {s === "sm" ? "A-" : s === "md" ? "A" : "A+"}
              </button>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full text-[10px] uppercase tracking-wider text-[#666] hover:text-white transition-colors py-1"
          >
            Restaurar padrão
          </button>
        </div>
      )}
    </div>
  );
}

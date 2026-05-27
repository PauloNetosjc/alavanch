import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/alavanch-logo.png";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-[#0a0a0f] text-white overflow-hidden">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        {/* Animated gradient backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#2a1f4a_0%,#0a0a0f_55%)]" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-600/20 blur-[120px]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {/* Rising arrow behind the text */}
        <svg
          className="absolute left-0 right-0 bottom-20 w-full h-[70%] pointer-events-none z-0"
          viewBox="0 0 600 400"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arrowGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.0" />
              <stop offset="40%" stopColor="#8b5cf6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.95" />
            </linearGradient>
            <filter id="arrowGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#arrowGlow)" stroke="url(#arrowGrad)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <polyline points="40,340 130,260 200,310 290,200 360,250 450,120 540,170" />
            {/* arrow head */}
            <polyline points="510,110 555,95 555,150" />
          </g>
        </svg>


        <div className="relative z-10">
          <img src={logo} alt="Alavanch" className="h-20 w-auto drop-shadow-[0_0_20px_rgba(139,92,246,0.4)]" />
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-[0.18em] text-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Acelerador Digital
          </div>
          <h2 className="text-4xl font-light leading-tight tracking-tight">
            Gestão inteligente,
            <br />
            <span className="font-serif italic text-purple-300">resultados acelerados.</span>
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Plataforma completa para gerenciar orçamentos, pedidos, produção e relacionamento — tudo em um só lugar.
          </p>
        </div>

        <div className="relative z-10 text-[11px] text-white/40 tracking-wider">
          © {new Date().getFullYear()} ALAVANCH · TODOS OS DIREITOS RESERVADOS
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-[#0f0f17] via-[#0a0a0f] to-[#0a0a0f]">
        {/* mobile logo backdrop */}
        <div className="absolute inset-0 lg:hidden bg-[radial-gradient(ellipse_at_top,#2a1f4a_0%,#0a0a0f_60%)]" />

        <div className="relative z-10 w-full max-w-md">
          <div className="lg:hidden mb-10 flex justify-center">
            <img src={logo} alt="Alavanch" className="h-18 w-auto" style={{ height: "4.5rem" }} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-[0_0_60px_-15px_rgba(139,92,246,0.25)]">
            <div className="mb-8">
              <h1 className="text-2xl font-light tracking-tight text-white">
                Bem-vindo de volta
              </h1>
              <p className="text-sm text-white/50 mt-1">
                Entre para acessar seu painel
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field
                icon={<Mail size={15} />}
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                required
              />
              <Field
                icon={<Lock size={15} />}
                label="Senha"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                required
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-white/40 hover:text-white/80 transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-11 rounded-lg text-sm font-medium text-white overflow-hidden transition-all disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#4f46e5 100%)",
                  boxShadow: "0 10px 30px -10px rgba(124,58,237,0.6)",
                }}
              >
                <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? "Aguarde…" : "Entrar"}
                  {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                </span>
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-white/30 mt-6 tracking-wider lg:hidden">
            © {new Date().getFullYear()} ALAVANCH
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  required,
  rightSlot,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">{label}</label>
      <div className="relative group">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-purple-300 transition-colors">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full h-11 pl-9 pr-10 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20 transition-all"
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        navigate("/dashboard");
      } else {
        await signUp(email, password, nome);
        toast.success("Cadastro realizado! Verifique seu e-mail.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm surface-card" style={{ padding: 32 }}>
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "#1A1A1A", border: "0.5px solid #333" }}
          >
            <span className="text-[11px] font-medium text-white">P</span>
          </div>
          <div>
            <div className="text-[13px] font-medium tracking-[0.02em]">Alavanch</div>
            <div className="text-[9px] uppercase text-muted-foreground tracking-[0.12em]">Sistema</div>
          </div>
        </div>

        <h1 className="mb-1">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="text-[12px] text-muted-foreground mb-6">
          {mode === "login" ? "Acesse seu painel" : "Crie sua conta administrativa"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="kpi-label block mb-1.5">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-md bg-card text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ border: "0.5px solid hsl(var(--border-strong))" }}
              />
            </div>
          )}
          <div>
            <label className="kpi-label block mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-md bg-card text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ border: "0.5px solid hsl(var(--border-strong))" }}
            />
          </div>
          <div>
            <label className="kpi-label block mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-9 px-3 rounded-md bg-card text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ border: "0.5px solid hsl(var(--border-strong))" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 rounded-md text-[12px] font-medium text-white transition-colors"
            style={{ background: loading ? "#555" : "#1A1A1A" }}
          >
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center mt-4 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}

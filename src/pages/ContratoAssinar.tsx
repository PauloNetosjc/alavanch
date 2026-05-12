import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Rota legada `/contrato/:token`.
 * Mantida apenas como redirecionador para o novo módulo público `/assinatura/:novoToken`.
 * Se ainda não existir solicitação para este contrato, cria automaticamente via RPC.
 */
export default function ContratoAssinar() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [erro, setErro] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      // Busca contrato pelo signing_token legado (RLS pública permite SELECT)
      const { data: ct } = await supabase
        .from("contratos")
        .select("id, orcamento_id")
        .eq("signing_token", token)
        .maybeSingle();

      if (!ct?.id) {
        setErro("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      // Procura solicitação de assinatura mais recente para este contrato
      let solicToken: string | null = null;
      const r1 = await supabase
        .from("solicitacoes_assinatura")
        .select("token")
        .eq("contrato_id", ct.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      solicToken = r1.data?.token ?? null;

      if (!solicToken) {
        try {
          await supabase.rpc("auto_criar_solic_contrato", {
            p_pedido_id: null as any,
            p_contrato_id: ct.id,
          });
        } catch { /* sem auth: ignora */ }
        const r2 = await supabase
          .from("solicitacoes_assinatura")
          .select("token")
          .eq("contrato_id", ct.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        solicToken = r2.data?.token ?? null;
      }

      if (solicToken) {
        setRedirectTo(`/assinatura/${solicToken}`);
      } else {
        setErro("Solicitação de assinatura ainda não disponível. Entre em contato com a loja.");
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (redirectTo) return <Navigate to={redirectTo} replace />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
      {erro || "Link inválido."}
    </div>
  );
}

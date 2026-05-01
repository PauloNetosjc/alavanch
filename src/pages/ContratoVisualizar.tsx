import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { renderContratoHtml, type ContratoTemplate } from "@/lib/contratoTemplate";

export default function ContratoVisualizar() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<any>(null);
  const [tpl, setTpl] = useState<ContratoTemplate | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase.from("contratos").select("*").eq("id", id).maybeSingle();
      setContrato(c);
      if (c?.template_id) {
        const { data: t } = await supabase.from("contratos_template").select("*").eq("id", c.template_id).maybeSingle();
        setTpl(t as ContratoTemplate);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="text-center py-20 text-muted-foreground text-[13px]">Carregando…</div>;
  if (!contrato) return <div className="text-center py-20 text-muted-foreground text-[13px]">Contrato não encontrado.</div>;

  const signingUrl = `${window.location.origin}/contrato/${contrato.signing_token}`;

  const copiarLink = async () => {
    await navigator.clipboard.writeText(signingUrl);
    toast.success("Link de assinatura copiado!");
  };

  const imprimir = () => {
    if (!tpl) return toast.error("Template não encontrado");
    const ctx = (contrato.conteudo_snapshot as any) || {};
    ctx.signing_url = signingUrl;
    const html = renderContratoHtml(tpl, ctx, contrato.assinado_em ? {
      assinado: { nome: contrato.assinatura_nome, cpf: contrato.assinatura_cpf, data: contrato.assinado_em },
    } : undefined);
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return toast.error("Bloqueador de pop-up impediu a impressão");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 350);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/comercial/${contrato.orcamento_id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex gap-2">
          <Button onClick={copiarLink} className="bg-[#2D6BE5] hover:bg-[#2459C9] text-white">
            <Copy className="w-4 h-4 mr-1.5" /> Copiar link de assinatura
          </Button>
          <Button onClick={imprimir} variant="outline">
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="text-center mb-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Contrato Nº</div>
          <div className="text-[28px] font-semibold text-[#2D6BE5]">{contrato.numero}</div>
          <div className="mt-1 text-[12px]">
            Status:{" "}
            <span className={contrato.status === "assinado" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {contrato.status === "assinado" ? "✓ Assinado" : "Aguardando assinatura"}
            </span>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/20">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Link público de assinatura</div>
          <div className="text-[12px] break-all text-[#2D6BE5]">{signingUrl}</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-[13px]">
          <div><span className="text-muted-foreground">Cliente:</span> <b>{(contrato.conteudo_snapshot as any)?.cliente?.nome}</b></div>
          <div><span className="text-muted-foreground">Valor:</span> <b>R$ {Number(contrato.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div>
        </div>

        {contrato.assinado_em && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[13px] text-emerald-900">
            ✓ Assinado por <b>{contrato.assinatura_nome}</b> em {new Date(contrato.assinado_em).toLocaleString("pt-BR")}.
          </div>
        )}
      </div>
    </div>
  );
}

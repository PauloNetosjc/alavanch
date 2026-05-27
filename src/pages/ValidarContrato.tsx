import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Estado = {
  loading: boolean;
  found: boolean;
  contrato?: any;
  solic?: any;
  cliente?: any;
  loja?: any;
  pedido?: any;
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d as string; }
}

export default function ValidarContrato() {
  const { token } = useParams();
  const [s, setS] = useState<Estado>({ loading: true, found: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) { setS({ loading: false, found: false }); return; }
      const { data: contrato } = await (supabase as any)
        .from("contratos")
        .select("*")
        .eq("validation_token", token)
        .maybeSingle();
      if (!alive) return;
      if (!contrato) { setS({ loading: false, found: false }); return; }


      const [{ data: solic }, { data: cliente }, { data: loja }] = await Promise.all([
        supabase.from("solicitacoes_assinatura").select("*").eq("contrato_id", contrato.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        contrato.cliente_id ? supabase.from("clientes").select("nome,cpf_cnpj,email").eq("id", contrato.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
        contrato.loja_id ? supabase.from("lojas").select("nome,cnpj").eq("id", contrato.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);

      let pedido: any = null;
      if (solic?.pedido_id) {
        const { data: p } = await supabase.from("pedidos").select("codigo,id").eq("id", solic.pedido_id).maybeSingle();
        pedido = p;
      }

      if (!alive) return;
      setS({ loading: false, found: true, contrato, solic, cliente, loja, pedido });
    })();
    return () => { alive = false; };
  }, [token]);

  if (s.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">Validando contrato…</div>;
  }

  if (!s.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-2">
          <div className="text-2xl font-semibold">Contrato não encontrado</div>
          <p className="text-sm text-muted-foreground">O token informado é inválido ou foi revogado.</p>
        </div>
      </div>
    );
  }

  const { contrato, solic, cliente, loja, pedido } = s;
  const statusContrato = solic?.status || contrato?.status || "—";
  const statusLoja = solic?.loja_assinado_em ? "Assinado" : "Pendente";
  const statusCliente = solic?.cliente_assinado_em ? "Assinado" : "Pendente";
  const cancelado = ["cancelado", "recusado", "expirado"].includes(String(statusContrato));

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto bg-card rounded-lg border shadow-sm p-6 space-y-5">
        <header className="border-b pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Validação pública</div>
          <h1 className="text-2xl font-semibold mt-1">Contrato {contrato.numero}</h1>
          <div className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono">{contrato.id}</span></div>
        </header>

        {cancelado && (
          <div className="rounded border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
            Este contrato está com status <b>{statusContrato}</b>.
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase">Status</div>
            <div className="font-medium">{statusContrato}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Pedido</div>
            <div className="font-medium">{pedido?.codigo || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Loja</div>
            <div className="font-medium">{loja?.nome || "—"}</div>
            {loja?.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {loja.cnpj}</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Cliente</div>
            <div className="font-medium">{cliente?.nome || "—"}</div>
            {cliente?.cpf_cnpj && <div className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Gerado em</div>
            <div className="font-medium">{fmt(contrato.created_at)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">ID da solicitação</div>
            <div className="font-mono text-xs">{solic?.id || "—"}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded border p-4">
            <div className="text-xs uppercase text-muted-foreground">Assinatura da loja</div>
            <div className={`mt-1 font-semibold ${solic?.loja_assinado_em ? "text-emerald-600" : "text-muted-foreground"}`}>{statusLoja}</div>
            {solic?.loja_assinatura_nome && <div className="text-sm mt-2">{solic.loja_assinatura_nome}</div>}
            {solic?.loja_assinatura_email && <div className="text-xs text-muted-foreground">{solic.loja_assinatura_email}</div>}
            {solic?.loja_assinatura_cargo && <div className="text-xs text-muted-foreground">{solic.loja_assinatura_cargo}</div>}
            {solic?.loja_assinado_em && <div className="text-xs text-muted-foreground mt-1">Em {fmt(solic.loja_assinado_em)}</div>}
          </div>
          <div className="rounded border p-4">
            <div className="text-xs uppercase text-muted-foreground">Assinatura do cliente</div>
            <div className={`mt-1 font-semibold ${solic?.cliente_assinado_em ? "text-emerald-600" : "text-muted-foreground"}`}>{statusCliente}</div>
            {solic?.cliente_nome && <div className="text-sm mt-2">{solic.cliente_nome}</div>}
            {solic?.cliente_documento && <div className="text-xs text-muted-foreground">{solic.cliente_documento}</div>}
            {solic?.cliente_assinado_em && <div className="text-xs text-muted-foreground mt-1">Em {fmt(solic.cliente_assinado_em)}</div>}
          </div>
        </section>

        <footer className="border-t pt-4 text-xs text-muted-foreground space-y-1">
          <div>Token público: <span className="font-mono">{token}</span></div>
          <div>Esta página é somente leitura e exibe os dados oficiais registrados para validação do contrato.</div>
        </footer>
      </div>
    </div>
  );
}

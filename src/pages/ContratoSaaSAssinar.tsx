import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, FileSignature, Printer } from "lucide-react";
import { maskCpf, maskCnpj } from "@/lib/masks";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contrato-saas-public`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Contrato = {
  id: string; numero_contrato: string; tipo_contrato: string; status: string;
  conteudo_html: string | null; data_envio_assinatura: string | null;
  data_assinatura: string | null; plano: string | null;
  valor_mensal: number | null; valor_implantacao: number | null;
  data_inicio: string | null; data_fim: string | null;
};
type Base = { nome: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string | null };

export default function ContratoSaaSAssinar() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [base, setBase] = useState<Base | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assinadoAgora, setAssinadoAgora] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErro(null);
    try {
      const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token ?? "")}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const data = await res.json();
      if (!res.ok) { setErro(data?.error || "Link inválido ou expirado."); return; }
      setContrato(data.contrato); setBase(data.base);
    } catch (e: any) { setErro(e.message || "Erro ao carregar contrato"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (token) load(); }, [token]);

  async function handleAssinar() {
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!documento.trim()) return setErro("Informe o documento.");
    if (!email.trim()) return setErro("Informe o e-mail.");
    if (!aceite) return setErro("Você precisa aceitar os termos.");
    setSaving(true); setErro(null);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ token, nome, documento, email, aceite }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data?.error || "Não foi possível assinar."); return; }
      setAssinadoAgora(data.data_assinatura);
    } catch (e: any) { setErro(e.message || "Erro ao assinar"); }
    finally { setSaving(false); }
  }

  function imprimir() {
    if (!contrato?.conteudo_html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${contrato.numero_contrato}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;max-width:780px;margin:0 auto;color:#222;}</style>
      </head><body>${contrato.conteudo_html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando contrato…
      </div>
    );
  }

  if (erro && !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-600 mb-3" />
          <div className="font-medium">{erro}</div>
        </Card>
      </div>
    );
  }

  if (!contrato) return null;

  const jaAssinado = contrato.status === "assinado" || !!assinadoAgora;
  const indisponivel = ["cancelado", "expirado", "anexado_manual"].includes(contrato.status) && !assinadoAgora;
  const dataAss = assinadoAgora ?? contrato.data_assinatura;

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center mb-2">
          <FileSignature className="h-8 w-8 mx-auto text-zinc-700" />
          <h1 className="text-xl font-bold mt-2">Assinatura Digital de Contrato</h1>
          <p className="text-xs text-muted-foreground">Sistema SaaS</p>
        </div>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Contrato nº</div>
              <div className="font-mono text-sm">{contrato.numero_contrato}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Base</div>
              <div className="text-sm font-medium">{base?.nome_fantasia || base?.razao_social || base?.nome || "—"}</div>
              {base?.cnpj && <div className="text-xs text-muted-foreground">{base.cnpj}</div>}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="prose prose-sm max-w-none text-[12.5px]">
            <div dangerouslySetInnerHTML={{ __html: contrato.conteudo_html || "<em>Contrato sem conteúdo.</em>" }} />
          </div>
          <div className="flex justify-end mt-4">
            <Button size="sm" variant="outline" onClick={imprimir}><Printer className="h-3.5 w-3.5 mr-1" /> Imprimir</Button>
          </div>
        </Card>

        {jaAssinado ? (
          <Card className="p-6 border-emerald-300 bg-emerald-50">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-700 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-900">Contrato assinado com sucesso.</div>
                {dataAss && (
                  <div className="text-sm text-emerald-800 mt-1">
                    Assinado em {new Date(dataAss).toLocaleString("pt-BR")}.
                  </div>
                )}
                <Badge className="mt-2 bg-emerald-100 text-emerald-800">Assinado</Badge>
              </div>
            </div>
          </Card>
        ) : indisponivel ? (
          <Card className="p-6 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-700 mt-0.5" />
              <div className="font-medium text-amber-900">Este contrato não está mais disponível para assinatura.</div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-3">
            <div className="font-medium">Assinatura</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Nome completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ *</Label>
                <Input
                  value={documento}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setDocumento(digits.length > 11 ? maskCnpj(e.target.value) : maskCpf(e.target.value));
                  }}
                  maxLength={20}
                />
              </div>
              <div>
                <Label className="text-xs">E-mail *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
              <Checkbox checked={aceite} onCheckedChange={v => setAceite(!!v)} />
              <span>Li e concordo com os termos deste contrato.</span>
            </label>
            {erro && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{erro}</div>}
            <Button className="w-full" onClick={handleAssinar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
              Assinar digitalmente
            </Button>
            <div className="text-[11px] text-muted-foreground">
              Ao assinar, registramos seu nome, documento, e-mail, IP e dispositivo como evidências.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

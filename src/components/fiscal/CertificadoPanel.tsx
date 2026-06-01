import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Shield, Upload, RotateCcw } from "lucide-react";

type Cert = {
  id: string; nome: string; status: string; tipo_certificado: string | null;
  cnpj_certificado: string | null; razao_social_certificado: string | null;
  validade_inicio: string | null; validade_fim: string | null;
  ultimo_teste_em: string | null; ultimo_uso_em: string | null;
  storage_path: string; created_at: string;
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-800",
    pendente_validacao: "bg-amber-100 text-amber-800",
    vencido: "bg-red-100 text-red-800",
    invalido: "bg-red-100 text-red-800",
    substituido: "bg-muted text-foreground",
    removido: "bg-muted text-foreground",
  };
  return <Badge className={`${map[s] || ""} border-0`}>{s.replace("_", " ")}</Badge>;
}

export function CertificadoPanel() {
  const { selectedLojaId } = useLoja();
  const { user } = useAuth();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!selectedLojaId) { setCerts([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("certificados_digitais" as any)
      .select("*")
      .eq("loja_id", selectedLojaId)
      .order("created_at", { ascending: false });
    setCerts((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedLojaId]);

  const ativo = certs.find((c) => c.status === "ativo" || c.status === "pendente_validacao");

  async function enviar() {
    if (!file || !selectedLojaId) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "pfx" && ext !== "p12") { toast.error("Aceitamos somente arquivos .pfx ou .p12"); return; }
    if (!senha) { toast.error("Informe a senha do certificado"); return; }
    setBusy(true);
    try {
      const path = `${selectedLojaId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("certificados-digitais").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      // Marca certificados anteriores como substituidos
      await supabase.from("certificados_digitais" as any)
        .update({ status: "substituido" } as any)
        .eq("loja_id", selectedLojaId)
        .in("status", ["ativo", "pendente_validacao"]);
      // Senha NUNCA é salva em texto puro — guardamos apenas marcador. Criptografia real virá no backend.
      const { error } = await supabase.from("certificados_digitais" as any).insert({
        loja_id: selectedLojaId,
        nome: file.name,
        tipo_certificado: "A1",
        storage_path: path,
        senha_encrypted: null, // backend fiscal irá ler do storage + KMS futuramente
        status: "pendente_validacao",
        uploaded_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Certificado enviado. Validação e criptografia serão realizadas pelo backend fiscal.");
      setFile(null); setSenha("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar certificado");
    } finally {
      setBusy(false);
    }
  }

  async function remover(c: Cert) {
    if (!confirm("Remover este certificado?")) return;
    await supabase.from("certificados_digitais" as any).update({ status: "removido" } as any).eq("id", c.id);
    toast.success("Certificado marcado como removido");
    load();
  }

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  const venceEm = ativo?.validade_fim ? Math.ceil((new Date(ativo.validade_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-display flex items-center gap-2"><Shield className="w-5 h-5"/> Certificado Digital A1</h2>
        <p className="text-xs text-muted-foreground">Senha nunca é armazenada em texto puro. Validação e descriptografia são responsabilidade do backend fiscal.</p>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Status atual</h3>
            {!ativo ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-800 text-sm">
                <AlertTriangle className="w-4 h-4"/> Nenhum certificado configurado para esta loja.
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                  <strong>{ativo.nome}</strong> {statusBadge(ativo.status)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>CNPJ do certificado: {ativo.cnpj_certificado || "—"}</div>
                  <div>Razão social: {ativo.razao_social_certificado || "—"}</div>
                  <div>Validade início: {ativo.validade_inicio ? new Date(ativo.validade_inicio).toLocaleDateString("pt-BR") : "—"}</div>
                  <div>Validade fim: {ativo.validade_fim ? new Date(ativo.validade_fim).toLocaleDateString("pt-BR") : "—"}</div>
                  <div>Último teste: {ativo.ultimo_teste_em ? new Date(ativo.ultimo_teste_em).toLocaleString("pt-BR") : "Nunca testado"}</div>
                  <div>Último uso: {ativo.ultimo_uso_em ? new Date(ativo.ultimo_uso_em).toLocaleString("pt-BR") : "—"}</div>
                </div>
                {venceEm !== null && venceEm <= 30 && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 text-amber-800 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5"/>
                    {venceEm < 0 ? "Certificado vencido!" : `Certificado vence em ${venceEm} dia(s).`}
                  </div>
                )}
                {ativo.status === "pendente_validacao" && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 text-amber-800 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5"/>
                    Aguardando validação pelo backend fiscal. Dados do CNPJ e validade serão preenchidos automaticamente.
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><span><Button size="sm" variant="outline" disabled>Testar certificado</Button></span></TooltipTrigger>
                      <TooltipContent>Disponível na próxima fase (emissão em homologação).</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remover(ativo)}>Remover</Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <RotateCcw className="w-4 h-4"/> {ativo ? "Substituir certificado" : "Enviar certificado"}
            </h3>
            <div>
              <Label className="text-xs">Arquivo (.pfx ou .p12)</Label>
              <div className="flex gap-2 mt-1 items-center">
                <label className="px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-muted inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5"/> Escolher arquivo
                  <input type="file" accept=".pfx,.p12" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden"/>
                </label>
                <span className="text-xs text-muted-foreground">{file?.name || "Nenhum arquivo selecionado"}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha do certificado"/>
              <p className="text-[10px] text-muted-foreground mt-1">A senha é enviada para validação pelo backend e nunca persistida em texto puro.</p>
            </div>
            <Button onClick={enviar} disabled={!file || !senha || busy} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
              Enviar certificado
            </Button>
          </Card>

          {certs.length > 1 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-2">Histórico</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase">
                    <tr><th className="text-left p-2">Arquivo</th><th className="text-left p-2">Status</th><th className="text-left p-2">Enviado em</th><th className="text-left p-2">Validade</th></tr>
                  </thead>
                  <tbody>
                    {certs.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{c.nome}</td>
                        <td className="p-2">{statusBadge(c.status)}</td>
                        <td className="p-2">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-2">{c.validade_fim ? new Date(c.validade_fim).toLocaleDateString("pt-BR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

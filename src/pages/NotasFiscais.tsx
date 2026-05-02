import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Settings, Shield, Wrench, XCircle } from "lucide-react";
import { BRL } from "@/lib/financeiro";

type NF = {
  id: string;
  tipo: string;
  numero: string | null;
  status: string;
  valor_total: number;
  data_emissao: string | null;
  motivo_rejeicao: string | null;
  pedido_id: string | null;
  created_at: string;
};

type Cert = { id: string; nome: string; validade_fim: string | null; status: string };

export default function NotasFiscais() {
  const [tab, setTab] = useState("dashboard");
  const [periodo, setPeriodo] = useState("mes");
  const [notas, setNotas] = useState<NF[]>([]);
  const [cert, setCert] = useState<Cert | null>(null);

  useEffect(() => {
    supabase
      .from("notas_fiscais" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotas((data as unknown as NF[]) || []));
    supabase
      .from("certificados_digitais" as any)
      .select("id, nome, validade_fim, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCert(data as unknown as Cert));
  }, []);

  const stats = useMemo(() => {
    const total = notas.length;
    const autorizadas = notas.filter((n) => n.status === "autorizada");
    const negadas = notas.filter((n) => n.status === "rejeitada" || n.status === "erro");
    const canceladas = notas.filter((n) => n.status === "cancelada");
    const valorAutorizado = autorizadas.reduce((s, n) => s + Number(n.valor_total || 0), 0);
    return {
      total, autorizadas: autorizadas.length, negadas: negadas.length,
      canceladas: canceladas.length, valor: valorAutorizado,
      pctAut: total ? (autorizadas.length / total) * 100 : 0,
    };
  }, [notas]);

  const certOk = cert && cert.status === "ativo";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b w-full justify-start rounded-none p-0 h-auto">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <BarChart3 className="w-4 h-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="nfe" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <FileText className="w-4 h-4 mr-1.5" /> NF-e
          </TabsTrigger>
          <TabsTrigger value="nfse" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <Wrench className="w-4 h-4 mr-1.5" /> NFS-e
          </TabsTrigger>
          <TabsTrigger value="emitidas" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <FileText className="w-4 h-4 mr-1.5" /> Notas Emitidas
          </TabsTrigger>
          <TabsTrigger value="certificado" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <Shield className="w-4 h-4 mr-1.5" /> Certificado
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            <Settings className="w-4 h-4 mr-1.5" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display">Dashboard Fiscal</h1>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm border rounded-md px-3 py-1.5 bg-background">
              <option value="mes">Este mês</option>
              <option value="ano">Este ano</option>
            </select>
          </div>

          {!certOk && (
            <div className="rounded-xl p-5 flex items-center justify-between" style={{ background: "hsl(0 70% 97%)", border: "1px solid hsl(0 70% 88%)" }}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">Envio de notas bloqueado até configurar o certificado digital</div>
                  <div className="text-sm text-red-700">Para emitir NF-e e NFS-e, envie o certificado digital da empresa na aba Certificado.</div>
                </div>
              </div>
              <Button variant="destructive" onClick={() => setTab("certificado")}>Configurar certificado</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Stat label="Total no período" value={stats.total} icon={<FileText />} hint={`${notas.filter(n => new Date(n.created_at).toDateString() === new Date().toDateString()).length} criadas hoje`} />
            <Stat label="Autorizadas" value={stats.autorizadas} icon={<CheckCircle2 className="text-green-600" />} hint={`${stats.pctAut.toFixed(1)}% do total no período`} />
            <Stat label="Negadas / Erro" value={stats.negadas} icon={<XCircle className="text-red-600" />} hint={stats.negadas ? "Verifique rejeições" : "Nenhuma rejeição no período"} />
            <Stat label="Canceladas" value={stats.canceladas} icon={<AlertTriangle className="text-amber-600" />} hint={stats.canceladas ? "" : "Nenhum cancelamento no período"} />
            <Stat label="Valor total" value={BRL(stats.valor)} icon={<BarChart3 />} hint="Notas autorizadas" big />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResumoTipo titulo="NF-e" notas={notas.filter(n => n.tipo === "nfe")} />
            <ResumoTipo titulo="NFS-e" notas={notas.filter(n => n.tipo === "nfse")} />
            <div className="surface-card p-5">
              <h4 className="text-sm font-medium mb-3">Notas emitidas por mês</h4>
              <div className="text-xs text-muted-foreground">
                {notas.length === 0 ? "Sem dados ainda." : `${notas.length} notas no histórico.`}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="emitidas" className="mt-6">
          <div className="surface-card p-0 overflow-hidden">
            {/* Mobile cards */}
            <ul className="md:hidden divide-y">
              {notas.map((n) => (
                <li key={n.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{n.tipo}</div>
                      <div className="font-medium text-[14px] mt-0.5">{n.numero || "—"}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-mono font-semibold text-[13px]">{BRL(n.valor_total)}</div>
                      <div className="mt-1"><StatusBadge status={n.status} /></div>
                    </div>
                  </div>
                </li>
              ))}
              {!notas.length && <li className="p-8 text-center text-muted-foreground text-[12px]">Nenhuma nota emitida.</li>}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <tr><th className="text-left p-3">Tipo</th><th className="text-left p-3">Número</th><th className="text-left p-3">Status</th><th className="text-right p-3">Valor</th><th className="text-left p-3">Emitida em</th></tr>
                </thead>
                <tbody className="divide-y">
                  {notas.map((n) => (
                    <tr key={n.id}>
                      <td className="p-3 uppercase">{n.tipo}</td>
                      <td className="p-3">{n.numero || "—"}</td>
                      <td className="p-3"><StatusBadge status={n.status} /></td>
                      <td className="p-3 text-right">{BRL(n.valor_total)}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                  {!notas.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma nota emitida.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="nfe" className="mt-6">
          <PainelEmissao tipo="nfe" certOk={!!certOk} onIr={() => setTab("certificado")} />
        </TabsContent>
        <TabsContent value="nfse" className="mt-6">
          <PainelEmissao tipo="nfse" certOk={!!certOk} onIr={() => setTab("certificado")} />
        </TabsContent>

        <TabsContent value="certificado" className="mt-6">
          <CertificadoForm cert={cert} onChange={setCert} />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="surface-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Configurações Fiscais</h2>
            <p className="text-sm text-muted-foreground">
              Provider de emissão: <strong>Focus NFe</strong>. Para ativar a emissão real, contrate um plano em focusnfe.com.br e adicione a API token nos segredos do projeto.
            </p>
            <div className="text-xs text-muted-foreground">
              Buckets configurados: certificados-digitais, notas-fiscais (privados).
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, hint, icon, big }: { label: string; value: any; hint?: string; icon: React.ReactNode; big?: boolean }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="w-4 h-4">{icon}</span>
      </div>
      <div className={"mt-2 " + (big ? "text-2xl font-display" : "text-3xl font-display")}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ResumoTipo({ titulo, notas }: { titulo: string; notas: NF[] }) {
  const aut = notas.filter(n => n.status === "autorizada");
  const valor = aut.reduce((s, n) => s + Number(n.valor_total), 0);
  return (
    <div className="surface-card p-5">
      <h4 className="text-sm font-medium mb-3">{titulo}</h4>
      <Linha label="Total no período" valor={notas.length} />
      <Linha label="Autorizadas" valor={aut.length} />
      <Linha label="Rejeitadas" valor={notas.filter(n => n.status === "rejeitada").length} />
      <Linha label="Canceladas" valor={notas.filter(n => n.status === "cancelada").length} />
      <Linha label="Valor autorizado" valor={BRL(valor)} />
    </div>
  );
}
function Linha({ label, valor }: { label: string; valor: any }) {
  return <div className="flex justify-between text-sm py-1.5 border-b last:border-0"><span className="text-muted-foreground">{label}</span><span>{valor}</span></div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    autorizada: "bg-green-100 text-green-800",
    rejeitada: "bg-red-100 text-red-800",
    cancelada: "bg-amber-100 text-amber-800",
    rascunho: "bg-muted text-foreground",
    erro: "bg-red-100 text-red-800",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
}

function PainelEmissao({ tipo, certOk, onIr }: { tipo: string; certOk: boolean; onIr: () => void }) {
  return (
    <div className="surface-card p-6">
      <h2 className="text-lg font-medium uppercase">{tipo}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Para emitir uma {tipo.toUpperCase()} a partir de um pedido, abra o pedido no menu Comercial e use a ação "Emitir Nota Fiscal".
        A integração será realizada via Focus NFe quando o token estiver configurado.
      </p>
      {!certOk && (
        <div className="mt-4 p-3 rounded-md bg-red-50 text-red-800 text-sm flex items-center justify-between">
          Certificado digital ausente.
          <Button size="sm" variant="destructive" onClick={onIr}>Configurar</Button>
        </div>
      )}
    </div>
  );
}

function CertificadoForm({ cert, onChange }: { cert: Cert | null; onChange: (c: Cert | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function enviar() {
    if (!file) return;
    setBusy(true);
    try {
      const path = `${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("certificados-digitais").upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase
        .from("certificados_digitais" as any)
        .insert({ nome: file.name, storage_path: path, senha_encrypted: senha, status: "ativo" } as any)
        .select()
        .single();
      if (error) throw error;
      onChange(data as unknown as Cert);
      setFile(null);
      setSenha("");
    } catch (e: any) {
      alert("Erro ao enviar certificado: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display">Certificado Digital</h1>
        <p className="text-sm text-muted-foreground">Envie o certificado A1 (.pfx) para liberar emissão de NF-e e NFS-e.</p>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" />
          <h3 className="font-medium">Status atual</h3>
        </div>
        {cert ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            <div className="text-sm">
              {cert.nome} {cert.validade_fim && <span>· Válido até {new Date(cert.validade_fim).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-800">
            <AlertTriangle className="w-4 h-4" /><span className="text-sm">Certificado não configurado</span>
          </div>
        )}
      </div>

      <div className="surface-card p-5">
        <h3 className="font-medium mb-3">Enviar certificado</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Arquivo do certificado (.pfx)</label>
            <div className="flex gap-2 mt-1">
              <label className="px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-muted">
                Escolher arquivo
                <input type="file" accept=".pfx,.p12" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
              <span className="text-sm text-muted-foreground self-center">{file?.name || "Nenhum arquivo escolhido"}</span>
            </div>
          </div>
          <div>
            <label className="text-sm">Senha do certificado</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha do certificado"
              className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
            />
          </div>
          <Button onClick={enviar} disabled={!file || busy}>
            {busy ? "Enviando…" : "Enviar certificado"}
          </Button>
        </div>
      </div>
    </div>
  );
}

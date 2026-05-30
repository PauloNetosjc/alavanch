import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileSignature, Plus, Eye, Upload, XCircle, Download, Printer, FileText, Send, Copy, ExternalLink,
} from "lucide-react";
import {
  renderContratoSaasTemplate, type DadosContratoSaaS,
} from "@/lib/contratoSaasTemplate";

type Props = {
  baseId: string;
  baseNome: string;
};

type Modelo = { id: string; nome: string; conteudo_html: string; ativo: boolean; padrao: boolean };
type Assinatura = {
  id: string; plano: string | null; valor_implantacao: number | null; valor_mensal: number | null;
  dia_vencimento: number | null; lojas_incluidas: number | null; usuarios_incluidos: number | null;
  armazenamento_incluido_mb: number | null; armazenamento_adicional_mb: number | null;
  data_inicio: string | null;
};
type Contrato = {
  id: string; base_cliente_id: string; numero_contrato: string;
  tipo_contrato: string; status: string; plano: string | null;
  valor_implantacao: number | null; valor_mensal: number | null;
  dia_vencimento: number | null; lojas_incluidas: number | null;
  usuarios_incluidos: number | null; armazenamento_incluido_mb: number | null;
  armazenamento_adicional_mb: number | null;
  data_inicio: string | null; data_fim: string | null; data_assinatura: string | null;
  data_envio_assinatura: string | null;
  assinatura_token: string | null; assinatura_url: string | null;
  assinante_nome: string | null; assinante_documento: string | null;
  assinante_email: string | null; assinante_ip: string | null; assinante_user_agent: string | null;
  arquivo_assinado_url: string | null; conteudo_html: string | null;
  modelo_id: string | null; observacoes: string | null;
  created_at: string;
};
type Base = {
  id: string; nome: string; razao_social: string | null; cnpj: string | null;
  responsavel_nome: string | null; email_responsavel: string | null; telefone_responsavel: string | null;
};

const TIPOS = [
  { value: "contrato_inicial", label: "Contrato inicial" },
  { value: "renovacao", label: "Renovação" },
  { value: "aditivo", label: "Aditivo" },
  { value: "cancelamento", label: "Cancelamento" },
];

const statusColor: Record<string, string> = {
  rascunho: "bg-zinc-100 text-zinc-700",
  aguardando_assinatura: "bg-amber-100 text-amber-800",
  enviado_para_assinatura: "bg-blue-100 text-blue-800",
  assinado: "bg-emerald-100 text-emerald-800",
  anexado_manual: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
  expirado: "bg-zinc-100 text-zinc-700",
};
const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  enviado_para_assinatura: "Enviado para assinatura",
  assinado: "Assinado",
  anexado_manual: "Anexado manual",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const registrarHistorico = async (
  base_id: string, evento: string, descricao: string, detalhes: any, user_id?: string | null,
) => {
  await (supabase.from("bases_clientes_historico" as any) as any).insert({
    base_id, evento, descricao, detalhes: detalhes ?? null, usuario_id: user_id ?? null,
  });
};

export function ContratosTab({ baseId, baseNome }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<Base | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [modulosNomes, setModulosNomes] = useState<string[]>([]);

  // dialogs
  const [openGerar, setOpenGerar] = useState(false);
  const [openVisualizar, setOpenVisualizar] = useState<Contrato | null>(null);
  const [openAnexar, setOpenAnexar] = useState<Contrato | null>(null);
  const [openCancelar, setOpenCancelar] = useState<Contrato | null>(null);
  const [linkAssinatura, setLinkAssinatura] = useState<{ url: string; numero: string } | null>(null);

  // form gerar
  const [modeloId, setModeloId] = useState<string>("");
  const [tipoContrato, setTipoContrato] = useState<string>("contrato_inicial");
  const [dataInicio, setDataInicio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState<string>("");
  const [statusInicial, setStatusInicial] = useState<string>("aguardando_assinatura");

  // anexar
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dataAssinatura, setDataAssinatura] = useState<string>(new Date().toISOString().slice(0, 10));
  const [obsAnexo, setObsAnexo] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // cancelar
  const [motivoCancel, setMotivoCancel] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [b, c, m, a, mm] = await Promise.all([
      (supabase.from("bases_clientes" as any) as any)
        .select("id,nome,razao_social,cnpj,responsavel_nome,email_responsavel,telefone_responsavel")
        .eq("id", baseId).maybeSingle(),
      (supabase.from("base_contratos" as any) as any).select("*").eq("base_cliente_id", baseId).order("created_at", { ascending: false }),
      (supabase.from("base_modelos_contrato" as any) as any).select("id,nome,conteudo_html,ativo,padrao").eq("ativo", true).order("padrao", { ascending: false }).order("nome"),
      (supabase.from("base_assinaturas" as any) as any).select("*").eq("base_cliente_id", baseId).maybeSingle(),
      (supabase.from("modulos_loja" as any) as any).select("modulo_id, ativo, lojas!inner(base_cliente_id)").eq("ativo", true).eq("lojas.base_cliente_id", baseId),
    ]);
    setBase((b.data as any) || null);
    setContratos((c.data as any) || []);
    setModelos((m.data as any) || []);
    setAssinatura((a.data as any) || null);

    const modIds = Array.from(new Set(((mm.data as any[]) || []).map((x) => x.modulo_id))).filter(Boolean);
    if (modIds.length) {
      const { data: ms } = await (supabase.from("modulos_sistema" as any) as any).select("id,nome").in("id", modIds);
      setModulosNomes(((ms as any[]) || []).map((x) => x.nome));
    } else {
      setModulosNomes([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [baseId]);

  // Default modelo padrão when opening gerar
  useEffect(() => {
    if (openGerar && modelos.length && !modeloId) {
      const padrao = modelos.find((x) => x.padrao) || modelos[0];
      setModeloId(padrao.id);
    }
  }, [openGerar, modelos, modeloId]);

  const dadosRender = useMemo<DadosContratoSaaS>(() => ({
    base_nome: base?.nome,
    razao_social: base?.razao_social,
    cnpj: base?.cnpj,
    responsavel_nome: base?.responsavel_nome,
    email_responsavel: base?.email_responsavel,
    telefone_responsavel: base?.telefone_responsavel,
    plano: assinatura?.plano,
    valor_implantacao: assinatura?.valor_implantacao,
    valor_mensal: assinatura?.valor_mensal,
    dia_vencimento: assinatura?.dia_vencimento,
    lojas_incluidas: assinatura?.lojas_incluidas,
    usuarios_incluidos: assinatura?.usuarios_incluidos,
    armazenamento_incluido_mb: assinatura?.armazenamento_incluido_mb,
    armazenamento_adicional_mb: assinatura?.armazenamento_adicional_mb,
    data_inicio: dataInicio || assinatura?.data_inicio,
    data_fim: dataFim || null,
    modulos_contratados: modulosNomes,
  }), [base, assinatura, modulosNomes, dataInicio, dataFim]);

  const gerarContrato = async () => {
    if (!modeloId) { toast.error("Selecione um modelo"); return; }
    const modelo = modelos.find((x) => x.id === modeloId);
    if (!modelo) { toast.error("Modelo inválido"); return; }
    const html = renderContratoSaasTemplate(modelo.conteudo_html, dadosRender);

    const payload: any = {
      base_cliente_id: baseId,
      assinatura_id: assinatura?.id ?? null,
      modelo_id: modeloId,
      tipo_contrato: tipoContrato,
      status: statusInicial,
      plano: assinatura?.plano ?? null,
      valor_implantacao: assinatura?.valor_implantacao ?? null,
      valor_mensal: assinatura?.valor_mensal ?? null,
      dia_vencimento: assinatura?.dia_vencimento ?? null,
      lojas_incluidas: assinatura?.lojas_incluidas ?? null,
      usuarios_incluidos: assinatura?.usuarios_incluidos ?? null,
      armazenamento_incluido_mb: assinatura?.armazenamento_incluido_mb ?? null,
      armazenamento_adicional_mb: assinatura?.armazenamento_adicional_mb ?? null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      conteudo_html: html,
      criado_por: user?.id,
      atualizado_por: user?.id,
    };

    const { data, error } = await (supabase.from("base_contratos" as any) as any).insert(payload).select("id,numero_contrato").single();
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(baseId, "contrato_gerado",
      `Contrato ${(data as any).numero_contrato} gerado (${TIPOS.find((t) => t.value === tipoContrato)?.label})`,
      { contrato_id: (data as any).id, modelo_id: modeloId, tipo: tipoContrato, status: statusInicial }, user?.id);
    toast.success(`Contrato ${(data as any).numero_contrato} gerado`);
    setOpenGerar(false);
    setModeloId(""); setTipoContrato("contrato_inicial"); setDataFim("");
    load();
  };

  const baixarAnexo = async (contrato: Contrato) => {
    if (!contrato.arquivo_assinado_url) return;
    const path = contrato.arquivo_assinado_url;
    const { data, error } = await supabase.storage.from("contratos-saas").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const anexarAssinado = async () => {
    if (!openAnexar) return;
    if (!arquivo) { toast.error("Selecione um arquivo"); return; }
    const maxMb = 25;
    if (arquivo.size > maxMb * 1024 * 1024) { toast.error(`Arquivo excede ${maxMb} MB`); return; }
    setUploading(true);
    try {
      const ext = arquivo.name.split(".").pop() || "bin";
      const path = `${baseId}/${openAnexar.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("contratos-saas").upload(path, arquivo, {
        contentType: arquivo.type, upsert: false,
      });
      if (upErr) { toast.error(upErr.message); return; }

      const { error: updErr } = await (supabase.from("base_contratos" as any) as any).update({
        arquivo_assinado_url: path,
        data_assinatura: dataAssinatura,
        status: "anexado_manual",
        observacoes: obsAnexo || openAnexar.observacoes,
        atualizado_por: user?.id,
      }).eq("id", openAnexar.id);
      if (updErr) { toast.error(updErr.message); return; }

      await registrarHistorico(baseId, "contrato_anexado_manual",
        `Contrato ${openAnexar.numero_contrato} marcado como anexado manualmente`,
        { contrato_id: openAnexar.id, arquivo: arquivo.name, data_assinatura: dataAssinatura }, user?.id);

      toast.success("Contrato anexado");
      setOpenAnexar(null); setArquivo(null); setObsAnexo("");
      load();
    } finally {
      setUploading(false);
    }
  };

  const cancelarContrato = async () => {
    if (!openCancelar) return;
    const { error } = await (supabase.from("base_contratos" as any) as any).update({
      status: "cancelado",
      observacoes: motivoCancel
        ? `${openCancelar.observacoes ? openCancelar.observacoes + "\n" : ""}Cancelado: ${motivoCancel}`
        : openCancelar.observacoes,
      atualizado_por: user?.id,
    }).eq("id", openCancelar.id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(baseId, "contrato_cancelado",
      `Contrato ${openCancelar.numero_contrato} cancelado`,
      { contrato_id: openCancelar.id, motivo: motivoCancel || null }, user?.id);
    toast.success("Contrato cancelado");
    setOpenCancelar(null); setMotivoCancel("");
    load();
  };

  const enviarParaAssinatura = async (c: Contrato) => {
    if (c.status === "cancelado" || c.status === "assinado" || c.status === "anexado_manual") {
      toast.error("Este contrato não pode ser enviado para assinatura.");
      return;
    }
    const token = c.assinatura_token || (crypto as any).randomUUID();
    const path = `/contrato-saas/${token}`;
    const url = `${window.location.origin}${path}`;
    const { error } = await (supabase.from("base_contratos" as any) as any).update({
      assinatura_token: token,
      assinatura_url: path,
      status: "enviado_para_assinatura",
      data_envio_assinatura: new Date().toISOString(),
      atualizado_por: user?.id,
    }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(baseId, "contrato_enviado_assinatura",
      `Contrato ${c.numero_contrato} enviado para assinatura digital`,
      { contrato_id: c.id, numero_contrato: c.numero_contrato, url: path }, user?.id);
    setLinkAssinatura({ url, numero: c.numero_contrato });
    load();
    if (openVisualizar?.id === c.id) setOpenVisualizar({ ...openVisualizar, status: "enviado_para_assinatura", assinatura_token: token, assinatura_url: path });
  };

  const copiarLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const imprimirVisualizar = () => {
    if (!openVisualizar?.conteudo_html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${openVisualizar.numero_contrato}</title>
      <style>body{font-family:'DM Sans',system-ui,sans-serif;padding:32px;max-width:780px;margin:0 auto;color:#222;}
      h1,h2,h3{font-family:'Playfair Display',serif;}</style>
      </head><body>${openVisualizar.conteudo_html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-muted-foreground">
          {contratos.length} contrato{contratos.length === 1 ? "" : "s"} • Base: <strong>{baseNome}</strong>
        </div>
        <Button size="sm" onClick={() => setOpenGerar(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Gerar contrato
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/50 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Nº</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Plano</th>
              <th className="text-left px-3 py-2">Mensal</th>
              <th className="text-left px-3 py-2">Início</th>
              <th className="text-left px-3 py-2">Assinatura</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>}
            {!loading && contratos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">
                Nenhum contrato gerado para esta base.
              </td></tr>
            )}
            {contratos.map((c) => (
              <tr key={c.id} className="border-t hover:bg-secondary/30">
                <td className="px-3 py-2 font-mono text-[12px]">{c.numero_contrato}</td>
                <td className="px-3 py-2 capitalize text-[12px]">{c.tipo_contrato?.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">
                  <Badge className={`${statusColor[c.status] || ""} border-0 text-[10px]`}>
                    {statusLabel[c.status] || c.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-[12px]">{c.plano || "—"}</td>
                <td className="px-3 py-2 text-[12px]">
                  {c.valor_mensal != null
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.valor_mensal))
                    : "—"}
                </td>
                <td className="px-3 py-2 text-[12px]">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-[12px]">{c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Visualizar" onClick={() => setOpenVisualizar(c)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {c.arquivo_assinado_url && (
                      <Button size="sm" variant="ghost" title="Baixar arquivo" onClick={() => baixarAnexo(c)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {c.status !== "cancelado" && c.status !== "assinado" && (
                      <Button size="sm" variant="ghost" title="Anexar assinado" onClick={() => { setOpenAnexar(c); setObsAnexo(c.observacoes || ""); }}>
                        <Upload className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {c.status !== "cancelado" && (
                      <Button size="sm" variant="ghost" title="Cancelar" onClick={() => setOpenCancelar(c)}>
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Gerar */}
      <Dialog open={openGerar} onOpenChange={(o) => { if (!o) setOpenGerar(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-4 h-4" /> Gerar contrato — {baseNome}
            </DialogTitle>
          </DialogHeader>
          {modelos.length === 0 ? (
            <div className="text-[13px] text-muted-foreground py-4">
              Nenhum modelo ativo encontrado. Cadastre um em{" "}
              <a className="text-primary underline" href="/sistema/gestao-bases/modelos-contrato">Modelos de Contrato</a>.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Modelo *</Label>
                <Select value={modeloId} onValueChange={setModeloId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}{m.padrao ? " (padrão)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipoContrato} onValueChange={setTipoContrato}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data início</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Status inicial</Label>
                <Select value={statusInicial} onValueChange={setStatusInicial}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="aguardando_assinatura">Aguardando assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!assinatura && (
                <div className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  A base ainda não possui assinatura cadastrada — os valores serão preenchidos como "—" no contrato.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGerar(false)}>Cancelar</Button>
            <Button onClick={gerarContrato} disabled={modelos.length === 0}>Gerar contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar */}
      <Dialog open={!!openVisualizar} onOpenChange={(o) => { if (!o) setOpenVisualizar(null); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4" /> {openVisualizar?.numero_contrato}
              {openVisualizar && (
                <Badge className={`${statusColor[openVisualizar.status] || ""} border-0 text-[10px]`}>
                  {statusLabel[openVisualizar.status] || openVisualizar.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {openVisualizar && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px] mb-3">
                <div><span className="text-muted-foreground">Tipo:</span> {openVisualizar.tipo_contrato?.replace(/_/g, " ")}</div>
                <div><span className="text-muted-foreground">Plano:</span> {openVisualizar.plano || "—"}</div>
                <div><span className="text-muted-foreground">Mensal:</span> {openVisualizar.valor_mensal != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(openVisualizar.valor_mensal)) : "—"}</div>
                <div><span className="text-muted-foreground">Início:</span> {openVisualizar.data_inicio ? new Date(openVisualizar.data_inicio).toLocaleDateString("pt-BR") : "—"}</div>
              </div>
              <div className="border rounded-md p-5 bg-white prose prose-sm max-w-none text-[12.5px]" >
                <div dangerouslySetInnerHTML={{ __html: openVisualizar.conteudo_html || "<em>Contrato sem conteúdo.</em>" }} />
              </div>
              <DialogFooter className="gap-2 pt-3">
                <Button variant="outline" onClick={() => setOpenVisualizar(null)}>Fechar</Button>
                <Button variant="outline" onClick={imprimirVisualizar} className="gap-1.5"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
                {openVisualizar.status !== "cancelado" && openVisualizar.status !== "assinado" && (
                  <Button onClick={() => { setOpenAnexar(openVisualizar); setObsAnexo(openVisualizar.observacoes || ""); setOpenVisualizar(null); }} className="gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Anexar assinado
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Anexar */}
      <Dialog open={!!openAnexar} onOpenChange={(o) => { if (!o) { setOpenAnexar(null); setArquivo(null); setObsAnexo(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Anexar contrato assinado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-[12px] text-muted-foreground">
              Contrato: <strong className="text-foreground">{openAnexar?.numero_contrato}</strong>
            </div>
            <div>
              <Label>Arquivo (PDF, imagem)</Label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                className="text-[12px] block w-full"
              />
              <div className="text-[10.5px] text-muted-foreground mt-1">Tamanho máximo: 25 MB</div>
            </div>
            <div>
              <Label>Data de assinatura</Label>
              <Input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={obsAnexo} onChange={(e) => setObsAnexo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenAnexar(null); setArquivo(null); }}>Cancelar</Button>
            <Button onClick={anexarAssinado} disabled={uploading || !arquivo}>{uploading ? "Enviando…" : "Anexar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!openCancelar} onOpenChange={(o) => { if (!o) { setOpenCancelar(null); setMotivoCancel(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancelar contrato</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[13px]">
            <div>Contrato: <strong>{openCancelar?.numero_contrato}</strong></div>
            <div>
              <Label>Motivo / observação</Label>
              <Textarea rows={3} value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              O contrato não será apagado — apenas marcado como cancelado.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenCancelar(null); setMotivoCancel(""); }}>Voltar</Button>
            <Button onClick={cancelarContrato} className="bg-red-600 hover:bg-red-700">Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

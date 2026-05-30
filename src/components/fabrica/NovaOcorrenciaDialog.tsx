import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  criarOcorrencia,
  TIPO_OCORRENCIA_LABEL,
  SETOR_LABEL,
  PRIORIDADE_LABEL,
  TipoOcorrencia,
  SetorOcorrencia,
  PrioridadeOcorrencia,
} from "@/lib/fabrica/ocorrencias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId?: string | null;
  defaultTipo?: TipoOcorrencia;
  defaultSetor?: SetorOcorrencia;
  defaultPrioridade?: PrioridadeOcorrencia;
  defaultTitulo?: string;
  defaultDescricao?: string;
  pecaId?: string | null;
  almoxarifadoItemId?: string | null;
  volumeId?: string | null;
  moduloId?: string | null;
  onCreated?: (id: string) => void;
}

export function NovaOcorrenciaDialog({
  open, onOpenChange, pedidoId,
  defaultTipo, defaultSetor, defaultPrioridade,
  defaultTitulo, defaultDescricao,
  pecaId, almoxarifadoItemId, volumeId, moduloId,
  onCreated,
}: Props) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [selPedido, setSelPedido] = useState<string>("");
  const [tipo, setTipo] = useState<TipoOcorrencia>(defaultTipo || "outro");
  const [setor, setSetor] = useState<SetorOcorrencia>(defaultSetor || "fabrica");
  const [prioridade, setPrioridade] = useState<PrioridadeOcorrencia>(defaultPrioridade || "normal");
  const [titulo, setTitulo] = useState(defaultTitulo || "");
  const [descricao, setDescricao] = useState(defaultDescricao || "");
  const [quantidade, setQuantidade] = useState<string>("");
  const [previsao, setPrevisao] = useState<string>("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelPedido(pedidoId || "");
    setTipo(defaultTipo || "outro");
    setSetor(defaultSetor || "fabrica");
    setPrioridade(defaultPrioridade || "normal");
    setTitulo(defaultTitulo || "");
    setDescricao(defaultDescricao || "");
    setQuantidade("");
    setPrevisao("");
    setObs("");
    if (!pedidoId) {
      (supabase as any).from("pedidos")
        .select("id, codigo, cliente:clientes(nome)")
        .order("created_at", { ascending: false }).limit(200)
        .then(({ data }: any) => setPedidos(data || []));
    }
  }, [open, pedidoId, defaultTipo, defaultSetor, defaultPrioridade, defaultTitulo, defaultDescricao]);

  async function salvar() {
    if (!selPedido) { toast.error("Selecione o pedido"); return; }
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    setSalvando(true);
    try {
      const oc = await criarOcorrencia({
        pedido_id: selPedido,
        tipo_ocorrencia: tipo,
        setor_responsavel: setor,
        prioridade,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        peca_id: pecaId ?? undefined,
        almoxarifado_item_id: almoxarifadoItemId ?? undefined,
        volume_id: volumeId ?? undefined,
        modulo_id: moduloId ?? undefined,
        quantidade_afetada: quantidade ? Number(quantidade) : undefined,
        data_previsao_resolucao: previsao || undefined,
        observacoes: obs || undefined,
      });
      toast.success(`Ocorrência ${oc.codigo} criada`);
      onCreated?.(oc.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar ocorrência");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova ocorrência</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!pedidoId && (
            <div className="sm:col-span-2">
              <Label>Pedido *</Label>
              <Select value={selPedido} onValueChange={setSelPedido}>
                <SelectTrigger><SelectValue placeholder="Selecione o pedido" /></SelectTrigger>
                <SelectContent>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo || p.id.slice(0, 8)} — {p.cliente?.nome || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOcorrencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_OCORRENCIA_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Setor responsável *</Label>
            <Select value={setor} onValueChange={(v) => setSetor(v as SetorOcorrencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SETOR_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeOcorrencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantidade afetada</Label>
            <Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Peça PORTA-001 chegou avariada" />
          </div>

          <div className="sm:col-span-2">
            <Label>Descrição *</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>

          <div>
            <Label>Previsão de resolução</Label>
            <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-1">Criar ocorrência</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

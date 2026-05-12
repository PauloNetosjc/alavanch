-- Reset CRM stages to the new structure
DELETE FROM public.crm_estagios;
INSERT INTO public.crm_estagios (nome, ordem, cor, is_ganho, is_perdido, ativo) VALUES
  ('Lead Agendado',     1, '#7E4FA0', false, false, true),
  ('Novo Orçamento',    2, '#3B82F6', false, false, true),
  ('Retorno (7 dias)',  3, '#F59E0B', false, false, true),
  ('Retorno Agendado',  4, '#10B981', false, false, true),
  ('Retorno 30 dias +', 5, '#EF4444', false, false, true),
  ('Concluído',         6, '#16A34A', true,  false, true),
  ('Perdido',           7, '#6B7280', false, true,  true);

-- Extend leads with CRM linkage
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS crm_estagio_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_apresentacao date,
  ADD COLUMN IF NOT EXISTS hora_apresentacao time,
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_perda text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid;

UPDATE public.leads
   SET crm_estagio_id = (SELECT id FROM public.crm_estagios WHERE nome = 'Lead Agendado' LIMIT 1)
 WHERE crm_estagio_id IS NULL;

-- Trigger: set default CRM stage for new orçamentos to "Novo Orçamento"
CREATE OR REPLACE FUNCTION public.orcamento_set_default_estagio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est uuid;
BEGIN
  IF NEW.estagio_id IS NULL THEN
    SELECT id INTO v_est FROM public.crm_estagios WHERE nome = 'Novo Orçamento' LIMIT 1;
    NEW.estagio_id := v_est;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orc_default_estagio ON public.orcamentos;
CREATE TRIGGER trg_orc_default_estagio BEFORE INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.orcamento_set_default_estagio();

-- Trigger: when orçamento is created for a cliente that has an open lead, archive the lead
CREATE OR REPLACE FUNCTION public.archive_lead_after_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.leads
     SET orcamento_id = NEW.id,
         arquivado = true,
         updated_at = now()
   WHERE cliente_id = NEW.cliente_id
     AND arquivado = false
     AND orcamento_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_lead_after_orc ON public.orcamentos;
CREATE TRIGGER trg_archive_lead_after_orc AFTER INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.archive_lead_after_orcamento();
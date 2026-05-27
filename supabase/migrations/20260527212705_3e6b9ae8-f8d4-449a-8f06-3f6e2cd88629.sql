
-- 1) Remove as policies cíclicas
DROP POLICY IF EXISTS contratos_anon_via_assinatura ON public.contratos;
DROP POLICY IF EXISTS contratos_select_public_by_token ON public.contratos;
DROP POLICY IF EXISTS solic_anon_via_validation ON public.solicitacoes_assinatura;

-- 2) Funções SECURITY DEFINER (bypassam RLS, evitam recursão)
CREATE OR REPLACE FUNCTION public.contrato_has_active_anon_solic(_contrato_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.solicitacoes_assinatura s
     WHERE s.contrato_id = _contrato_id
       AND s.token IS NOT NULL
       AND s.status NOT IN ('cancelado'::assinatura_status, 'expirado'::assinatura_status)
  );
$$;

CREATE OR REPLACE FUNCTION public.solic_belongs_to_validated_contrato(_solic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.solicitacoes_assinatura s
      JOIN public.contratos c ON c.id = s.contrato_id
     WHERE s.id = _solic_id
       AND c.validation_token IS NOT NULL
  );
$$;

-- 3) Recria policies anon SEM ciclo

-- contratos: anon pode ler se tiver validation_token público
-- OU se houver solicitação de assinatura ativa referenciando o contrato (via função SECURITY DEFINER).
-- A policy existente "contratos_validation_anon" (USING validation_token IS NOT NULL) é mantida;
-- adicionamos uma policy específica para o fluxo de assinatura pública.
CREATE POLICY contratos_anon_via_solic_func
  ON public.contratos
  FOR SELECT
  TO anon
  USING (public.contrato_has_active_anon_solic(id));

-- solicitacoes_assinatura: além da policy sa_select_anon (por token próprio),
-- permite leitura via token de validação do contrato (sem consultar contratos diretamente na expressão).
CREATE POLICY solic_anon_via_validation_func
  ON public.solicitacoes_assinatura
  FOR SELECT
  TO anon
  USING (public.solic_belongs_to_validated_contrato(id));

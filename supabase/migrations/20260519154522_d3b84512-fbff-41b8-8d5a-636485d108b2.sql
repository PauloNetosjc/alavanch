
-- 1) Novos campos para adendo (descrição + tipo)
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS adendo_descricao text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS adendo_tipo text; -- 'receber' | 'pagar'

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS adendo_descricao text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS adendo_tipo text;

-- 2) Atualiza trigger de geração de código: COMP -> CP, e propaga campos de adendo
CREATE OR REPLACE FUNCTION public.gerar_pedido_codigo_e_inserir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_seq int;
  v_pedido_id uuid;
  v_sigla text;
  v_pai uuid;
  v_is_adendo boolean;
  v_is_complemento boolean;
  v_origem_comp uuid;
  v_prefix text;
BEGIN
  IF NEW.status IN ('confirmado','convertido','aprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(NULLIF(l.sigla,''),'GER') INTO v_sigla
      FROM public.lojas l WHERE l.id = NEW.loja_id;
    IF v_sigla IS NULL THEN v_sigla := 'GER'; END IF;

    v_is_adendo := COALESCE(NEW.is_adendo, false);
    v_is_complemento := COALESCE(NEW.is_complemento, false);
    v_pai := NEW.pedido_origem_id;
    v_origem_comp := NEW.pedido_origem_complemento_id;

    v_prefix := CASE
      WHEN v_is_adendo THEN 'AD'
      WHEN v_is_complemento THEN 'CP'
      ELSE 'PV'
    END;

    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^'||v_prefix||'-'||v_sigla||'-[0-9]+$')
           THEN CAST(SPLIT_PART(codigo,'-',3) AS int)
           ELSE 0 END
    ),0) + 1
      INTO v_seq
      FROM public.pedidos
      WHERE codigo LIKE v_prefix || '-' || v_sigla || '-%';

    v_codigo := v_prefix || '-' || v_sigla || '-' || LPAD(v_seq::text,4,'0');

    INSERT INTO public.pedidos (
      codigo, orcamento_id, cliente_id, loja_id, valor_total, status,
      pedido_pai_id, is_adendo, is_complemento, pedido_origem_complemento_id,
      adendo_descricao, adendo_tipo
    ) VALUES (
      v_codigo, NEW.id, NEW.cliente_id, NEW.loja_id, NEW.total, 'em_producao',
      CASE WHEN v_is_adendo THEN v_pai ELSE NULL END,
      v_is_adendo,
      v_is_complemento,
      CASE WHEN v_is_complemento THEN v_origem_comp ELSE NULL END,
      NEW.adendo_descricao,
      NEW.adendo_tipo
    )
    RETURNING id INTO v_pedido_id;

    -- Adendo não cria pastas (vive dentro do pai e só vai ao financeiro).
    IF NOT v_is_adendo THEN
      INSERT INTO public.pedido_pastas (pedido_id, nome, ordem) VALUES
        (v_pedido_id,'Projetos/PDF',0),
        (v_pedido_id,'Check-in Obra',1),
        (v_pedido_id,'Fotos/Entrega',2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Bloqueia inicialização do pipeline operacional para adendos
CREATE OR REPLACE FUNCTION public.iniciar_pipeline_operacional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estagio_inicial uuid;
BEGIN
  IF COALESCE(NEW.is_adendo,false) THEN
    RETURN NEW; -- adendo não entra no operacional
  END IF;
  IF NEW.estagio_operacional_id IS NULL THEN
    SELECT id INTO v_estagio_inicial
    FROM public.pipeline_estagios
    WHERE pipeline = 'operacional' AND ordem = 1 AND ativo = true
    LIMIT 1;
    IF v_estagio_inicial IS NOT NULL THEN
      NEW.estagio_operacional_id := v_estagio_inicial;
      NEW.estagio_iniciado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Bloqueia card de pós-venda para adendos
CREATE OR REPLACE FUNCTION public.criar_card_posvenda_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_estagio uuid;
BEGIN
  IF COALESCE(NEW.is_adendo,false) THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_estagio FROM public.pipeline_estagios
   WHERE pipeline = 'pos_venda' AND ativo AND ordem = 1
   ORDER BY ordem LIMIT 1;
  IF v_estagio IS NOT NULL THEN
    INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id)
    VALUES (NEW.id, 'pos_venda', v_estagio)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 5) Adendo "a pagar" — gera saída financeira automática quando não há pagamentos formais
CREATE OR REPLACE FUNCTION public.gerar_saida_adendo_pagar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id uuid;
BEGIN
  IF NOT COALESCE(NEW.is_adendo,false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.adendo_tipo,'') <> 'pagar' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id AND tipo='saida') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo='saida' ORDER BY nome LIMIT 1;

  INSERT INTO public.lancamentos_financeiros (
    tipo, descricao, valor, data_vencimento, status,
    pedido_id, categoria_id, loja_id
  ) VALUES (
    'saida',
    'Adendo a pagar - ' || NEW.codigo || COALESCE(' - ' || NEW.adendo_descricao, ''),
    COALESCE(NEW.valor_total,0),
    CURRENT_DATE,
    'pendente',
    NEW.id, v_cat_id, NEW.loja_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerar_saida_adendo_pagar ON public.pedidos;
CREATE TRIGGER trg_gerar_saida_adendo_pagar
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_saida_adendo_pagar();

-- 6) Backfill: COMP-* -> CP-*
UPDATE public.pedidos
   SET codigo = regexp_replace(codigo, '^COMP-', 'CP-')
 WHERE codigo LIKE 'COMP-%';

-- 7) Backfill: pedidos com is_adendo=true e prefixo PV-/COMP- -> AD-{sigla}-{seq}
DO $$
DECLARE
  r record;
  v_sigla text;
  v_seq int;
  v_novo text;
BEGIN
  FOR r IN
    SELECT p.id, p.loja_id, p.codigo
      FROM public.pedidos p
     WHERE p.is_adendo = true
       AND p.codigo !~ '^AD-'
     ORDER BY p.created_at
  LOOP
    SELECT COALESCE(NULLIF(l.sigla,''),'GER') INTO v_sigla
      FROM public.lojas l WHERE l.id = r.loja_id;
    IF v_sigla IS NULL THEN v_sigla := 'GER'; END IF;

    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^AD-'||v_sigla||'-[0-9]+$')
           THEN CAST(SPLIT_PART(codigo,'-',3) AS int)
           ELSE 0 END
    ),0) + 1
      INTO v_seq
      FROM public.pedidos
      WHERE codigo LIKE 'AD-' || v_sigla || '-%';

    v_novo := 'AD-' || v_sigla || '-' || LPAD(v_seq::text,4,'0');
    UPDATE public.pedidos SET codigo = v_novo WHERE id = r.id;
  END LOOP;
END $$;

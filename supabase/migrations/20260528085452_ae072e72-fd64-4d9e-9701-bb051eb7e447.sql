
ALTER TYPE agenda_status ADD VALUE IF NOT EXISTS 'pendente_aprovacao';

CREATE OR REPLACE FUNCTION public.fn_autorizacao_aplicar_efeito_revisao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada')
     AND NEW.origem_modulo = 'revisao' AND NEW.origem_id IS NOT NULL THEN
    UPDATE public.pedido_revisoes
       SET aprovada = true,
           aprovada_em = COALESCE(aprovada_em, now())
     WHERE id = NEW.origem_id
       AND COALESCE(aprovada,false) = false;
  END IF;

  IF NEW.origem_modulo = 'agenda' AND NEW.origem_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovada' THEN
      UPDATE public.agenda_eventos SET status = 'agendado'::agenda_status WHERE id = NEW.origem_id;
    ELSIF NEW.status = 'rejeitada' THEN
      UPDATE public.agenda_eventos SET status = 'cancelado'::agenda_status, cancelado_em = now() WHERE id = NEW.origem_id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

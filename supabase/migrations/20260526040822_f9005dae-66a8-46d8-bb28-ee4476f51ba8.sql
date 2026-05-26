
CREATE TABLE IF NOT EXISTS public.user_lojas (
  user_id uuid NOT NULL,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, loja_id)
);

ALTER TABLE public.user_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia tudo" ON public.user_lojas
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Usuario ve suas lojas" ON public.user_lojas
  FOR SELECT USING (user_id = auth.uid());

-- Backfill com loja atual dos perfis
INSERT INTO public.user_lojas (user_id, loja_id)
SELECT p.user_id, p.loja_id
  FROM public.profiles p
 WHERE p.loja_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Função de checagem
CREATE OR REPLACE FUNCTION public.user_pode_acessar_loja(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin')
      OR EXISTS (SELECT 1 FROM public.user_lojas WHERE user_id = _user_id AND loja_id = _loja_id);
$$;

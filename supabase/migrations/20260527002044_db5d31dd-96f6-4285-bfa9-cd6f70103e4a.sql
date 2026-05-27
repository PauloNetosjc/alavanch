
-- Turnos
CREATE TABLE public.rh_turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_saida_almoco TIME,
  hora_volta_almoco TIME,
  hora_saida TIME NOT NULL,
  dias_semana INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0=dom .. 6=sab
  tolerancia_min INT NOT NULL DEFAULT 5,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_turnos TO authenticated;
GRANT ALL ON public.rh_turnos TO service_role;
ALTER TABLE public.rh_turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_turnos auth all" ON public.rh_turnos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Zonas autorizadas para ponto
CREATE TABLE public.rh_zonas_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id UUID REFERENCES public.rh_setores(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  raio_metros INT NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_zonas_ponto TO authenticated;
GRANT ALL ON public.rh_zonas_ponto TO service_role;
ALTER TABLE public.rh_zonas_ponto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_zonas auth all" ON public.rh_zonas_ponto FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Registros de ponto
CREATE TABLE public.rh_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida_almoco','volta_almoco','saida')),
  marcado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  selfie_url TEXT,
  origem TEXT NOT NULL DEFAULT 'sistema' CHECK (origem IN ('sistema','celular')),
  atraso_min INT NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rh_pontos_func_data ON public.rh_pontos(funcionario_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_pontos TO authenticated;
GRANT ALL ON public.rh_pontos TO service_role;
ALTER TABLE public.rh_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_pontos auth all" ON public.rh_pontos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Funcionário recebe turno
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES public.rh_turnos(id) ON DELETE SET NULL;

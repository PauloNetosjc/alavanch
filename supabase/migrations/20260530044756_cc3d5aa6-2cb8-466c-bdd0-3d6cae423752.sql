
-- Políticas do bucket privado contratos-saas (admin/staff via app autenticado)
DROP POLICY IF EXISTS "Contratos SaaS leitura autenticada" ON storage.objects;
CREATE POLICY "Contratos SaaS leitura autenticada"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos-saas');

DROP POLICY IF EXISTS "Contratos SaaS upload autenticado" ON storage.objects;
CREATE POLICY "Contratos SaaS upload autenticado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos-saas');

DROP POLICY IF EXISTS "Contratos SaaS update autenticado" ON storage.objects;
CREATE POLICY "Contratos SaaS update autenticado"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos-saas');

DROP POLICY IF EXISTS "Contratos SaaS delete autenticado" ON storage.objects;
CREATE POLICY "Contratos SaaS delete autenticado"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos-saas');

-- Seed do modelo padrão de contrato SaaS (se nenhum existir)
INSERT INTO public.base_modelos_contrato (nome, descricao, conteudo_html, ativo, padrao)
SELECT
  'Contrato Padrão SaaS',
  'Modelo padrão de contrato de prestação de serviços SaaS.',
$$<h1 style="text-align:center;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS SaaS</h1>
<p><strong>CONTRATANTE:</strong> {{razao_social}}, inscrita no CNPJ sob o nº {{cnpj}}, neste ato representada por {{responsavel_nome}}, e-mail {{email_responsavel}}, telefone {{telefone_responsavel}}.</p>
<p><strong>CONTRATADA:</strong> Forest Decor Sistemas, prestadora dos serviços de software como serviço (SaaS).</p>

<h2>1. OBJETO</h2>
<p>O presente contrato tem por objeto a licença de uso do sistema SaaS no plano <strong>{{plano}}</strong>, com os módulos contratados: {{modulos_contratados}}.</p>

<h2>2. ESCOPO INCLUÍDO</h2>
<ul>
  <li>Lojas incluídas: {{lojas_incluidas}}</li>
  <li>Usuários incluídos: {{usuarios_incluidos}}</li>
  <li>Armazenamento incluído: {{armazenamento_incluido}}</li>
  <li>Armazenamento adicional contratado: {{armazenamento_adicional}}</li>
</ul>

<h2>3. VALORES</h2>
<ul>
  <li>Valor de implantação: {{valor_implantacao}}</li>
  <li>Valor mensal: {{valor_mensal}}</li>
  <li>Dia de vencimento: {{dia_vencimento}}</li>
</ul>

<h2>4. VIGÊNCIA</h2>
<p>Início em {{data_inicio}} e término em {{data_fim}}, renovando-se automaticamente caso nenhuma das partes manifeste interesse em contrário.</p>

<h2>5. DISPOSIÇÕES GERAIS</h2>
<p>O presente instrumento substitui quaisquer acordos anteriores. Eventuais alterações deverão ocorrer por aditivo escrito.</p>

<p style="margin-top:32px;">Documento gerado em {{data_atual}}.</p>

<div style="margin-top:48px; display:flex; justify-content:space-around;">
  <div style="text-align:center;">__________________________<br/>CONTRATANTE<br/>{{responsavel_nome}}</div>
  <div style="text-align:center;">__________________________<br/>CONTRATADA<br/>Forest Decor Sistemas</div>
</div>$$,
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.base_modelos_contrato);

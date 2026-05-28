
INSERT INTO storage.buckets (id, name, public)
VALUES ('tarefas-anexos', 'tarefas-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tarefas_anexos_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tarefas-anexos');

CREATE POLICY "tarefas_anexos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tarefas-anexos');

CREATE POLICY "tarefas_anexos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tarefas-anexos');

CREATE POLICY "tarefas_anexos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tarefas-anexos');

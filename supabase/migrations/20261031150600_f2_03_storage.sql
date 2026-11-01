-- Storage: buckets e politicas (o schema storage existe no banco local e no CI mesmo sem o storage-api).
-- Convencao de caminho:
--   entregas     (privado)  {perfil_id}/{qualquer-nome}      dono escreve e le; super_admin e corretor leem
--   materiais    (privado)  {aula_id}/{qualquer-nome}        le quem le o material (RLS de materiais_aula); editor escreve
--   comprovantes (privado)  {ano}/{qualquer-nome}           financeiro le; super_admin envia; ninguem apaga (6 anos)
--   imagens      (publico)  premiados/, empresas/, capas/... leitura publica por URL; super_admin e editor escrevem
-- Limites de tamanho e tipos: PROVISORIOS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('entregas', 'entregas', false, 10485760,
   array['application/pdf', 'image/png', 'image/jpeg', 'text/plain',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('materiais', 'materiais', false, 52428800, array['application/pdf', 'application/epub+zip']),
  ('comprovantes', 'comprovantes', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg']),
  ('imagens', 'imagens', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- entregas
create policy entregas_dono_le on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy entregas_dono_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.tem_acesso('clube')));
create policy entregas_dono_troca on storage.objects for update to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'entregas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.tem_acesso('clube')));
create policy entregas_dono_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy entregas_corretor_le on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and (select private.papel_atual()) in ('super_admin', 'corretor'));

-- materiais: o exists passa pelo RLS de materiais_aula (aprovado + aula publicada + nivel, ou editor).
create policy materiais_le on storage.objects for select to authenticated
  using (bucket_id = 'materiais'
         and exists (select 1 from public.materiais_aula m where m.arquivo_path = storage.objects.name));
create policy materiais_editor_le on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_editor_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_editor_troca on storage.objects for update to authenticated
  using (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'))
  with check (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_editor_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'));

-- comprovantes: sem update nem delete (retencao fiscal).
create policy comprovantes_financeiro_le on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (select private.papel_atual()) in ('super_admin', 'auditor'));
create policy comprovantes_super_admin_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (select private.papel_atual()) = 'super_admin');

-- imagens (bucket publico: a leitura e pela URL publica; aqui so a escrita da equipe).
create policy imagens_equipe_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy imagens_equipe_troca on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (select private.papel_atual()) in ('super_admin', 'editor'))
  with check (bucket_id = 'imagens' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy imagens_equipe_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (select private.papel_atual()) in ('super_admin', 'editor'));

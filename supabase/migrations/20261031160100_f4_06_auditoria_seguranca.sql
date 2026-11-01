-- Auditoria de seguranca da plataforma-mvp (31/10/2026): tres leituras que iam alem do necessario.

-- M1) Avatar: quem nao e dono nem equipe so le a foto ligada a um perfil que ele ja pode ver.
--     Antes, qualquer Clube listava o bucket e baixava a foto de todo mundo (visitante, suspenso, ex-membro).
--     O exists roda com o RLS de quem consulta, entao herda visibilidade, suspensao e vitrine.
drop policy avatares_le on storage.objects;
create policy avatares_le on storage.objects for select to authenticated
using (
  bucket_id = 'avatares' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.papel_atual()) is not null
    or exists (select 1 from public.perfis p where p.foto_path = objects.name)
  )
);

-- B1) Parte de conexao recusada ou cancelada deixa de ver a outra pessoa por esse caminho.
drop policy perfis_conexao_le on public.perfis;
create policy perfis_conexao_le on public.perfis for select to authenticated
using (
  suspenso_em is null and exists (
    select 1 from public.conexoes c
    where c.status in ('pendente', 'aceita')
      and ((c.solicitante_id = (select auth.uid()) and c.destinatario_id = perfis.id)
        or (c.destinatario_id = (select auth.uid()) and c.solicitante_id = perfis.id))
  )
);

-- B6) Material de aula de curso so sai com o curso publicado (mesma regra de video_da_aula).
drop policy materiais_aula_membro_le on public.materiais_aula;
create policy materiais_aula_membro_le on public.materiais_aula for select to authenticated
using (
  status = 'aprovado' and exists (
    select 1 from public.aulas a
    where a.id = materiais_aula.aula_id
      and a.materiais_publicados_em is not null
      and (select public.pode_ver_conteudo(a.nivel_minimo))
      and (a.modulo_id is null or exists (
        select 1 from public.modulos m join public.cursos c on c.id = m.curso_id
        where m.id = a.modulo_id and c.publicado_em is not null))
  )
);

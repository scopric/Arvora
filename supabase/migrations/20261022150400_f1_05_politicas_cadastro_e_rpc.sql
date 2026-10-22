-- Politicas de setores e perfis (agora que private.papel_atual() existe), perfil criado no cadastro
-- e RPC de aprovacao.

-- setores: todos leem; super_admin e editor escrevem.
create policy setores_le on public.setores for select to anon, authenticated using (true);
create policy setores_equipe_insere on public.setores for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy setores_equipe_altera on public.setores for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy setores_equipe_apaga on public.setores for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));

-- perfis. A leitura de OUTROS membros (nivel Clube/Grupo) entra junto com tem_acesso(), na migration das
-- assinaturas; ate la, quem nao e dono nem equipe so enxerga perfis publicos aprovados.
create policy perfis_dono_le on public.perfis for select to authenticated
  using (id = (select auth.uid()));
create policy perfis_equipe_le on public.perfis for select to authenticated
  using ((select private.papel_atual()) is not null);
create policy perfis_publico_le on public.perfis for select to anon, authenticated
  using (visibilidade = 'publico' and publico_aprovado_em is not null and suspenso_em is null);
create policy perfis_dono_altera on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Sem politica de insert (o perfil nasce pelo gatilho) e de delete (exclusao GDPR e do servico).

-- Perfil criado quando a conta nasce. nome vem do cadastro (editavel depois); a declaracao de maioridade
-- (CON-07) e obrigatoria: sem ela a conta nao e criada.
create function private.criar_perfil() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
begin
  if coalesce(new.raw_user_meta_data ->> 'maior_18', '') <> 'true' then
    raise exception 'maior_18_obrigatorio' using errcode = 'P0001';
  end if;
  insert into public.perfis (id, nome, maior_18_em)
  values (new.id, left(coalesce(v_nome, split_part(coalesce(new.email, ''), '@', 1), 'Membro'), 120), now());
  return new;
end;
$$;
revoke all on function private.criar_perfil() from public, anon, authenticated;

create trigger criar_perfil after insert on auth.users
  for each row execute function private.criar_perfil();

-- aprovar_perfil_publico: super_admin e moderador. Liga ou desliga a aprovacao (ADM-02).
create function public.aprovar_perfil_publico(perfil uuid, aprovar boolean default true) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'moderador') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.perfis
     set publico_aprovado_em = case when aprovar then now() else null end
   where id = perfil and suspenso_em is null and visibilidade = 'publico';
  if not found then
    raise exception 'perfil_nao_aprovavel' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.aprovar_perfil_publico(uuid, boolean) from public, anon;
grant execute on function public.aprovar_perfil_publico(uuid, boolean) to authenticated;

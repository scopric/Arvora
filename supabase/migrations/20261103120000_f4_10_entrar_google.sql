-- Entrar com Google (CON-01). O OAuth nao consegue enviar metadados no cadastro, entao a conta nasce sem a
-- declaracao de maioridade (CON-07) e a pessoa declara no primeiro acesso (tela em RotaProtegida).
-- Antes: sem maior_18 a conta nao era criada. Agora: sem maior_18_em a conta existe, mas nao tem nivel
-- (nivel_atual = visitante) nem consegue pagar (registrar_aceite_checkout recusa).

alter table public.perfis alter column maior_18_em drop not null;

-- Igual a f1_05, menos o raise: sem maior_18 o perfil nasce com maior_18_em nulo. O nome do Google vem em
-- full_name/name; e so um rotulo editavel, nunca autorizacao.
create or replace function private.criar_perfil() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name',
                                       new.raw_user_meta_data ->> 'name', '')), '');
begin
  insert into public.perfis (id, nome, maior_18_em)
  values (new.id, left(coalesce(v_nome, 'Membro'), 120),
          case when new.raw_user_meta_data ->> 'maior_18' = 'true' then now() end);
  return new;
end;
$$;
revoke all on function private.criar_perfil() from public, anon, authenticated;

-- Sem declaracao, nenhum nivel: vale para tem_acesso, pode_ver_conteudo e tudo que passa por eles.
create or replace function private.nivel_atual(uid uuid) returns public.nivel_acesso
language sql stable security definer
set search_path = ''
as $$
  select coalesce(max(p.nivel), 'visitante'::public.nivel_acesso)
  from public.assinaturas a
  join public.planos p on p.id = a.plano_id
  where a.perfil_id = uid
    and a.status in ('active', 'trialing', 'past_due')
    and a.periodo_fim > now()
    and exists (select 1 from public.perfis f where f.id = uid and f.maior_18_em is not null);
$$;
revoke all on function private.nivel_atual(uuid) from public, anon, authenticated;

-- Igual a f1_21, mais a recusa de quem ainda nao declarou a maioridade.
create or replace function public.registrar_aceite_checkout(p_plano_id bigint, p_versao text) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_tipo text;
  v_id bigint;
begin
  if uid is null then
    raise exception 'nao_autenticado';
  end if;
  if not exists (select 1 from public.perfis f where f.id = uid and f.maior_18_em is not null) then
    raise exception 'maior_18_pendente';
  end if;
  select case when p.intervalo = 'unico' then 'conteudo_digital' else 'servico' end into v_tipo
  from public.planos p where p.id = p_plano_id and p.ativo;
  if v_tipo is null then
    raise exception 'plano_invalido';
  end if;
  -- teto: a funcao e chamavel direto pelo PostgREST, entao limita as linhas por usuario (20 em 10 minutos)
  if (select count(*) from private.aceites_checkout a
      where a.perfil_id = uid and a.criado_em > now() - interval '10 minutes') >= 20 then
    raise exception 'limite';
  end if;
  insert into private.aceites_checkout (perfil_id, plano_id, tipo, versao_texto)
  values (uid, p_plano_id, v_tipo, p_versao)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.registrar_aceite_checkout(bigint, text) from public, anon;
grant execute on function public.registrar_aceite_checkout(bigint, text) to authenticated;

-- A tela pergunta (maior_18_em nao sai pela API) e o titular declara. So grava se ainda estiver nulo:
-- a data da primeira declaracao nao muda.
create function public.idade_declarada() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis f where f.id = (select auth.uid()) and f.maior_18_em is not null);
$$;
revoke all on function public.idade_declarada() from public, anon;
grant execute on function public.idade_declarada() to authenticated;

create function public.declarar_maior_18() returns void
language sql security definer
set search_path = ''
as $$
  update public.perfis set maior_18_em = now() where id = (select auth.uid()) and maior_18_em is null;
$$;
revoke all on function public.declarar_maior_18() from public, anon;
grant execute on function public.declarar_maior_18() to authenticated;

-- Quem responde "nao tenho 18 anos" sai sem deixar dado (GDPR art. 8): a conta ainda sem declaracao e apagada
-- na hora, sem senha (conta do Google nao tem). So vale para quem nunca declarou, nao e da equipe e nunca
-- assinou; qualquer outra conta segue pela funcao excluir-conta.
create function public.excluir_conta_sem_declaracao() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis f where f.id = uid and f.maior_18_em is null)
     or exists (select 1 from public.equipe e where e.perfil_id = uid)
     or exists (select 1 from public.assinaturas a where a.perfil_id = uid)
     or exists (select 1 from public.clientes_stripe c where c.perfil_id = uid) then
    raise exception 'conta_nao_elegivel' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.excluir_conta_sem_declaracao() from public, anon;
grant execute on function public.excluir_conta_sem_declaracao() to authenticated;

-- Prova do aceite no checkout (Consumer Rights Act 2022, ss. 111, 119 e 120): antes de criar a sessao de pagamento,
-- guarda quem aceitou, qual plano, de que tipo e qual versao do texto. O tipo NAO vem do cliente: assinatura
-- (intervalo diferente de 'unico') e servico; curso avulso ('unico') e conteudo digital. A tabela e privada e so
-- a funcao escreve; ninguem le pela API (nem service_role): so o dono do banco, pelo painel/SQL, em disputa.
-- Apagada junto com a conta (cascade): reter a prova depois da exclusao e decisao do solicitor.
create table private.aceites_checkout (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  plano_id bigint not null references public.planos (id),
  tipo text not null check (tipo in ('servico', 'conteudo_digital')),
  versao_texto text not null check (versao_texto ~ '^[A-Za-z0-9._-]{1,32}$'),
  criado_em timestamptz not null default now()
);
create index aceites_checkout_perfil_idx on private.aceites_checkout (perfil_id, criado_em desc);
alter table private.aceites_checkout enable row level security;
revoke all on private.aceites_checkout from anon, authenticated;

create function public.registrar_aceite_checkout(p_plano_id bigint, p_versao text) returns bigint
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

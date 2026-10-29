-- Limite de chamadas por usuario e acao (janela deslizante, log de eventos).
-- public.consumir_limite(acao): registra a chamada e devolve true, ou devolve false (sem registrar) se o usuario
-- ja fez o maximo dessa acao na janela. O uid vem SO do JWT. Acoes e limites sao uma lista FECHADA dentro da
-- funcao (o cliente escolhe apenas a acao): para ajustar, nova migration. Mantenha a janela igual ao Retry-After
-- das Edge Functions.
-- Tamanho limitado por construcao: so existem 3 acoes (check na tabela) e a funcao nunca insere acima do max,
-- entao a tabela tem no maximo max linhas por (usuario, acao).
-- Retencao: dado minimo (uuid, acao, carimbo); as linhas ficam ate a proxima chamada da mesma chave (que apaga
-- as de mais de 1 dia) ou ate a conta ser apagada (cascade).
create table private.chamadas_limitadas (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  acao text not null check (acao in ('checkout', 'portal', 'excluir_senha')),
  em timestamptz not null default now()
);
create index chamadas_limitadas_chave_idx on private.chamadas_limitadas (perfil_id, acao, em desc);
alter table private.chamadas_limitadas enable row level security;
revoke all on private.chamadas_limitadas from anon, authenticated;

create function public.consumir_limite(p_acao text) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mx integer;
  janela integer;
begin
  if uid is null then
    raise exception 'nao_autenticado';
  end if;
  select l.mx, l.janela into mx, janela
  from (values ('checkout', 5, 600), ('portal', 20, 600), ('excluir_senha', 5, 3600)) l (acao, mx, janela)
  where l.acao = p_acao;
  if mx is null then
    raise exception 'parametro_invalido';
  end if;

  -- serializa por usuario+acao: sem isso duas chamadas simultaneas contariam o mesmo total e passariam juntas
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_acao, 0));

  delete from private.chamadas_limitadas
  where perfil_id = uid and acao = p_acao and em < now() - interval '1 day';

  if (select count(*) from private.chamadas_limitadas
      where perfil_id = uid and acao = p_acao
        and em > now() - make_interval(secs => janela)) >= mx then
    return false;
  end if;

  insert into private.chamadas_limitadas (perfil_id, acao) values (uid, p_acao);
  return true;
end $$;
revoke all on function public.consumir_limite(text) from public, anon;
grant execute on function public.consumir_limite(text) to authenticated;

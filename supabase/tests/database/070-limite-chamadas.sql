-- Limite de chamadas (f1_15): public.consumir_limite(acao). Transacao desfeita.
begin;
select plan(23);

create schema tt;
grant usage on schema tt to public;
create function tt.como(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
-- chama como o usuario s e volta a role dona
create function tt.c(s text, acao text) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tt.como(tt.u(s));
  r := public.consumir_limite(acao);
  reset role;
  return r;
end $$;
-- n chamadas seguidas; devolve quantas passaram
create function tt.rep(s text, acao text, n int) returns int language plpgsql as $$
declare k int := 0;
begin
  for i in 1..n loop
    if tt.c(s, acao) then k := k + 1; end if;
  end loop;
  return k;
end $$;
create function tt.n(s text, a text) returns bigint language sql as $$
  select count(*) from private.chamadas_limitadas where perfil_id = tt.u(s) and acao = a $$;

insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@exemplo.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1')) v(id);

-- 1) privilegios e entrada --------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.consumir_limite(text)', 'execute'), 'anon sem execute');
select ok(has_function_privilege('authenticated', 'public.consumir_limite(text)', 'execute'), 'authenticated executa');
set local role anon;
select throws_ok($$select public.consumir_limite('checkout')$$, '42501', null, 'anon chamando: 42501');
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$select public.consumir_limite('checkout')$$, 'P0001', 'nao_autenticado', 'sem uid: nao_autenticado');
reset role;
select tt.como(tt.u('a1'));
select throws_ok($$select public.consumir_limite('inventada')$$, 'P0001', 'parametro_invalido', 'acao desconhecida');
select throws_ok($$select public.consumir_limite(null)$$, 'P0001', 'parametro_invalido', 'acao nula');
select throws_ok($$select public.consumir_limite('checkout', 1000, 86400)$$, '42883', null, 'cliente nao escolhe max nem janela');
select throws_ok($$select * from private.chamadas_limitadas$$, '42501', null, 'authenticated nao le a tabela');
reset role;
select throws_ok($$insert into private.chamadas_limitadas (perfil_id, acao) values (tt.u('a1'), 'inventada')$$, '23514', null, 'check da tabela barra acao fora da lista');
select is((select count(*) from private.chamadas_limitadas), 0::bigint, 'entrada invalida nao grava nada');

-- 2) checkout: max 5; a tabela nao cresce ------------------------------------------------------------
select is(tt.rep('a1', 'checkout', 50), 5, 'checkout: 50 chamadas seguidas, so 5 passam');
select is(tt.n('a1', 'checkout'), 5::bigint, 'checkout: exatamente 5 linhas (tabela limitada)');

-- 3) independencia -------------------------------------------------------------------------------------
select is(tt.c('b1', 'checkout'), true, 'outro usuario nao e afetado');
select is(tt.c('a1', 'portal'), true, 'outra acao do mesmo usuario nao e afetada');

-- 4) cada acao com seu max/janela ------------------------------------------------------------------------
select is(tt.rep('b1', 'portal', 30), 20, 'portal: max 20');
select is(tt.rep('b1', 'excluir_senha', 10), 5, 'excluir_senha: max 5');
update private.chamadas_limitadas set em = now() - interval '700 seconds' where perfil_id = tt.u('b1') and acao = 'excluir_senha';
select is(tt.c('b1', 'excluir_senha'), false, 'excluir_senha: 700 s atras ainda esta na janela de 3600 s');
update private.chamadas_limitadas set em = now() - interval '4000 seconds' where perfil_id = tt.u('b1') and acao = 'excluir_senha';
select is(tt.c('b1', 'excluir_senha'), true, 'excluir_senha: passada a janela, libera');

-- 5) janela do checkout vence ---------------------------------------------------------------------------
update private.chamadas_limitadas set em = now() - interval '700 seconds' where perfil_id = tt.u('a1') and acao = 'checkout';
select is(tt.c('a1', 'checkout'), true, 'checkout: passada a janela de 600 s, volta a liberar');

-- 6) limpeza de linhas velhas, so da propria chave -----------------------------------------------------
insert into private.chamadas_limitadas (perfil_id, acao, em) values
  (tt.u('a1'), 'checkout', now() - interval '2 days'),
  (tt.u('b1'), 'checkout', now() - interval '2 days'),
  (tt.u('a1'), 'portal', now() - interval '2 days');
select tt.c('a1', 'checkout');
select is((select count(*) from private.chamadas_limitadas where perfil_id = tt.u('a1') and acao = 'checkout' and em < now() - interval '1 day'),
          0::bigint, 'linhas velhas da propria chave apagadas');
select is((select count(*) from private.chamadas_limitadas where em < now() - interval '1 day'),
          2::bigint, 'linhas velhas de outras chaves intactas');

-- 7) cascade ---------------------------------------------------------------------------------------------
delete from auth.users where id = tt.u('a1');
select is(tt.n('a1', 'checkout') + tt.n('a1', 'portal'), 0::bigint, 'apagar o usuario apaga as linhas');
select is(tt.n('b1', 'checkout') > 0, true, 'linhas de outro usuario ficam');

select * from finish();
rollback;

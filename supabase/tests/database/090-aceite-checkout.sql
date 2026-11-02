-- Prova do aceite no checkout (f1_21): public.registrar_aceite_checkout. Transacao desfeita.
-- Todos os dados abaixo sao de teste.
begin;
select plan(16);

create schema tt;
grant usage on schema tt to public;
alter default privileges in schema tt grant execute on functions to public; -- a f4_09 tirou o EXECUTE padrao de PUBLIC
create function tt.como(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000d1', 'd1@t.test', '{"nome":"X","maior_18":"true"}'::jsonb);
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste_ac', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda, ativo)
select c.id, v.p, v.p, 'clube', v.i, 'assinatura', 1, 'EUR', v.a
from public.contas_stripe c, (values
  ('price_ac_mes', 'mes', true), ('price_ac_unico', 'unico', true), ('price_ac_off', 'mes', false)) v (p, i, a)
where c.stripe_account_id = 'acct_teste_ac';
create temp table ids as
  select (select id from public.planos where stripe_price_id = 'price_ac_mes') mes,
         (select id from public.planos where stripe_price_id = 'price_ac_unico') unico,
         (select id from public.planos where stripe_price_id = 'price_ac_off') off;
grant select on ids to public;

select ok(not has_function_privilege('anon', 'public.registrar_aceite_checkout(bigint, text)', 'execute'), 'anon sem execute');
select ok(has_function_privilege('authenticated', 'public.registrar_aceite_checkout(bigint, text)', 'execute'), 'authenticated executa');
select ok(not has_table_privilege('authenticated', 'private.aceites_checkout', 'select'), 'authenticated nao le a tabela');
select ok(not has_table_privilege('authenticated', 'private.aceites_checkout', 'insert'), 'authenticated nao escreve direto');

select tt.como('00000000-0000-0000-0000-0000000000d1');
select ok((select public.registrar_aceite_checkout((select mes from ids), '2026-10')) > 0, 'grava aceite de assinatura');
select ok((select public.registrar_aceite_checkout((select unico from ids), 'v.2')) > 0, 'grava aceite de curso avulso');
select throws_ok($$select public.registrar_aceite_checkout((select off from ids), 'v1')$$, 'P0001', 'plano_invalido', 'plano inativo recusado');
select throws_ok($$select public.registrar_aceite_checkout(-1, 'v1')$$, 'P0001', 'plano_invalido', 'plano inexistente recusado');
select throws_ok($$select public.registrar_aceite_checkout((select mes from ids), 'tem espaco')$$, '23514', null, 'versao fora do formato recusada');
select throws_ok($$select public.registrar_aceite_checkout((select mes from ids), null)$$, '23502', null, 'versao nula recusada');
reset role;

select is((select tipo from private.aceites_checkout where plano_id = (select mes from ids)), 'servico', 'assinatura vira servico');
select is((select tipo from private.aceites_checkout where plano_id = (select unico from ids)), 'conteudo_digital', 'avulso vira conteudo digital');
select is((select count(*) from private.aceites_checkout where perfil_id = '00000000-0000-0000-0000-0000000000d1'), 2::bigint, 'so os 2 aceites validos ficaram');

-- teto de 20 aceites em 10 minutos por usuario (ja ha 2)
select tt.como('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$select public.registrar_aceite_checkout((select mes from ids), 'v' || i) from generate_series(1, 18) i$$, 'ate 20 aceites');
select throws_ok($$select public.registrar_aceite_checkout((select mes from ids), 'v99')$$, 'P0001', 'limite', 'o 21o e recusado');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.registrar_aceite_checkout((select mes from ids), 'v1')$$, 'P0001', 'nao_autenticado', 'sem uid recusado');
reset role;

select * from finish();
rollback;

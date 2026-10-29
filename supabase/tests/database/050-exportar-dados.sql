-- Exportacao de dados pessoais (f1_12): public.exportar_meus_dados. Transacao desfeita.
begin;
select plan(25);

create schema tt;
grant usage on schema tt to public;
create function tt.como(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  set local role authenticated;
end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
-- exportacao como o usuario s, guardada para o teste olhar depois de voltar a role dona
create function tt.exp(s text, aal text default 'aal1') returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform tt.como(tt.u(s), aal);
  r := public.exportar_meus_dados();
  reset role;
  return r;
end $$;

-- a1/b1 membros (b1 e o outro); a5 super_admin; a6 auditor; a7 sem assinatura
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@exemplo.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('a5'), ('a6'), ('a7')) v(id);
insert into public.equipe (perfil_id, papel) values (tt.u('a5'), 'super_admin'), (tt.u('a6'), 'auditor');
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe;
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
select id, 'cus_a1', tt.u('a1'), 'a1@exemplo.test' from public.contas_stripe
union all select id, 'cus_b1', tt.u('b1'), 'b1@exemplo.test' from public.contas_stripe;
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u(v.id), c.id, 'sub_' || v.id, p.id, 'active', now(), now() + interval '30 days'
from (values ('a1'), ('b1')) v(id), public.contas_stripe c, public.planos p;

-- 1) privilegios ------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.exportar_meus_dados()', 'execute'), 'anon sem execute');
select ok(has_function_privilege('authenticated', 'public.exportar_meus_dados()', 'execute'), 'authenticated executa');
set local role anon;
select throws_ok($$select public.exportar_meus_dados()$$, '42501', null, 'anon chamando: 42501');
reset role;
-- authenticated sem uid no JWT
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$select public.exportar_meus_dados()$$, 'P0001', 'nao_autenticado', 'sem uid: nao_autenticado');
reset role;

-- 2) a1 recebe so o proprio -------------------------------------------------------------------------
select set_config('tt.a', tt.exp('a1')::text, true);
select set_config('tt.b', tt.exp('b1')::text, true);
select ok(current_setting('tt.a')::jsonb ?& array['versao', 'exportado_em', 'conta', 'perfil', 'equipe', 'assinaturas', 'clientes_stripe'], 'chaves esperadas presentes');
select is(current_setting('tt.a')::jsonb -> 'versao', '1'::jsonb, 'versao 1');
select is(current_setting('tt.a')::jsonb #>> '{conta,email}', 'a1@exemplo.test', 'conta: e-mail do dono');
select is(current_setting('tt.a')::jsonb #>> '{conta,id}', tt.u('a1')::text, 'conta: id do dono');
select is(current_setting('tt.a')::jsonb #>> '{perfil,id}', tt.u('a1')::text, 'perfil: id do dono');
select ok(current_setting('tt.a')::jsonb -> 'perfil' ? 'maior_18_em' and current_setting('tt.a')::jsonb #>> '{perfil,maior_18_em}' is not null, 'perfil traz maior_18_em');
select is(jsonb_array_length(current_setting('tt.a')::jsonb -> 'assinaturas'), 1, 'a1: uma assinatura');
select is(current_setting('tt.a')::jsonb #>> '{assinaturas,0,plano,nome}', 'Clube teste', 'assinatura traz o plano');
select is(current_setting('tt.a')::jsonb #>> '{clientes_stripe,0,stripe_customer_id}', 'cus_a1', 'clientes_stripe do dono');
select is(jsonb_array_length(current_setting('tt.a')::jsonb -> 'clientes_stripe'), 1, 'a1: um customer');
select ok(current_setting('tt.a') not like '%b1@exemplo.test%' and current_setting('tt.a') not like '%' || tt.u('b1')::text || '%'
          and current_setting('tt.a') not like '%cus_b1%' and current_setting('tt.a') not like '%sub_b1%',
          'nada de b1 no export de a1');
select ok(current_setting('tt.b') not like '%a1@exemplo.test%' and current_setting('tt.b') not like '%' || tt.u('a1')::text || '%',
          'nada de a1 no export de b1');
select ok(current_setting('tt.a') not like '%eventos%' and current_setting('tt.a') not like '%valor%', 'sem eventos_stripe nem valores');

-- 3) quem le tudo por RLS recebe so o proprio -------------------------------------------------------
select ok(tt.exp('a5', 'aal2')::text not like '%' || tt.u('a1')::text || '%' and tt.exp('a5', 'aal2')::text not like '%cus_a1%'
          and tt.exp('a5', 'aal2') #>> '{conta,id}' = tt.u('a5')::text and tt.exp('a5', 'aal2') ->> 'equipe' = 'super_admin',
          'super_admin recebe so os proprios dados');
select ok(tt.exp('a6', 'aal2')::text not like '%' || tt.u('a1')::text || '%' and tt.exp('a6', 'aal2')::text not like '%sub_a1%'
          and tt.exp('a6', 'aal2') #>> '{conta,id}' = tt.u('a6')::text and jsonb_array_length(tt.exp('a6', 'aal2') -> 'assinaturas') = 0,
          'auditor recebe so os proprios dados');

-- 4) sem assinatura: lista vazia, nao null ------------------------------------------------------------
select is(tt.exp('a7') -> 'assinaturas', '[]'::jsonb, 'sem assinatura: lista vazia');
select is(tt.exp('a7') -> 'clientes_stripe', '[]'::jsonb, 'sem customer: lista vazia');
select is(tt.exp('a7') -> 'equipe', 'null'::jsonb, 'nao e equipe: equipe null');

-- 5) casos de borda: suspenso exporta, duas assinaturas, sem linha em perfis -------------------------------
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@exemplo.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a8'), ('a9'), ('aa')) v(id);
update public.perfis set suspenso_em = now() where id = tt.u('a8');
-- a9: uma assinatura ativa e uma cancelada (o segundo registro nao pode ser 'active': evita conflito com o indice futuro)
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_t_grupo', 'Grupo teste', 'grupo', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe;
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u('a9'), c.id, 'sub_a9_' || p.nivel, p.id, case when p.nivel = 'clube' then 'active' else 'canceled' end::public.status_assinatura, now(), now() + interval '30 days'
from public.contas_stripe c, public.planos p;
delete from public.perfis where id = tt.u('aa');

select ok(tt.exp('a8') #>> '{perfil,suspenso_em}' is not null, 'usuario suspenso exporta e ve a propria data de suspensao');
select is(jsonb_array_length(tt.exp('a9') -> 'assinaturas'), 2, 'duas assinaturas saem as duas');
select is(tt.exp('aa') -> 'perfil', 'null'::jsonb, 'sem linha em perfis: perfil null, sem erro');

select * from finish();
rollback;

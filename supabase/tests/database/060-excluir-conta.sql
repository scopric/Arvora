-- Exclusao de conta (GDPR art. 17): efeito de delete from auth.users (o que auth.admin.deleteUser faz) sobre o
-- titular, e o webhook depois disso. Transacao desfeita. Todos os dados sao de teste.
begin;
select plan(17);

create schema tt;
grant usage on schema tt to public;
create function tt.como(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  set local role authenticated;
end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
create function tt.conta() returns bigint language sql as $$ select id from public.contas_stripe where stripe_account_id = 'acct_teste' $$;
create function tt.ev_co(evt text, criado bigint, cus text, ref text) returns jsonb language sql as $$
  select jsonb_build_object('id', evt, 'type', 'checkout.session.completed', 'created', criado, 'data', jsonb_build_object('object',
    jsonb_build_object('id', 'cs_' || evt, 'customer', cus, 'client_reference_id', ref,
      'customer_details', jsonb_build_object('email', 'titular@exemplo.test'))))
$$;
create function tt.ev_sub(evt text, tipo text, criado bigint, sub text, st text, cus text) returns jsonb language sql as $$
  select jsonb_build_object('id', evt, 'type', tipo, 'created', criado, 'data', jsonb_build_object('object',
    jsonb_build_object('id', sub, 'object', 'subscription', 'customer', cus, 'status', st, 'cancel_at_period_end', false,
      'canceled_at', case when st = 'canceled' then criado end, 'metadata', '{}'::jsonb,
      'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('quantity', 1,
        'current_period_start', extract(epoch from now() - interval '1 day')::bigint,
        'current_period_end', extract(epoch from now() + interval '30 days')::bigint,
        'price', jsonb_build_object('id', 'price_t_clube', 'unit_amount', 1, 'currency', 'eur')))))))
$$;
-- Chama a RPC como service_role e devolve resultado OU o texto do erro (para provar o que acontece, sem abortar).
create function tt.webhook(e jsonb) returns text language plpgsql as $$
begin
  set local role service_role;
  return public.processar_evento_stripe(tt.conta(), e);
exception when others then
  return 'ERRO: ' || sqlerrm;
end $$;

-- a1 = titular com assinatura ativa (sub_x) e customer; b1 = da equipe (so para provar a cascata); c1 = outro titular
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('c1')) v(id);
insert into public.equipe (perfil_id, papel) values (tt.u('b1'), 'auditor');
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
values (tt.conta(), 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR');
select tt.webhook(tt.ev_co('evt_c1', 100, 'cus_a1', tt.u('a1')::text));
select tt.webhook(tt.ev_sub('evt_s1', 'customer.subscription.created', 200, 'sub_x', 'active', 'cus_a1'));
select tt.webhook(tt.ev_co('evt_c2', 100, 'cus_c1', tt.u('c1')::text));
reset role;

select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), true, 'antes: titular tem acesso');
reset role;
select is((select count(*)::int from public.assinaturas where perfil_id = tt.u('a1')), 1, 'antes: 1 assinatura do titular');

-- 1) o delete -------------------------------------------------------------------------------------------
delete from auth.users where id in (tt.u('a1'), tt.u('b1'));
select is((select count(*)::int from public.perfis where id in (tt.u('a1'), tt.u('b1'))), 0, 'perfis do titular e da equipe somem');
select is((select count(*)::int from public.equipe where perfil_id = tt.u('b1')), 0, 'equipe some em cascata');
select is((select count(*)::int from public.perfis where id = tt.u('c1')), 1, 'outro titular intacto');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_x'), 1, 'assinatura continua (retencao fiscal)');
select ok((select perfil_id is null from public.assinaturas where stripe_subscription_id = 'sub_x'), 'assinatura com perfil_id nulo');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_x' and status = 'active'
           and plano_id is not null and periodo_fim is not null), 1, 'linha da assinatura intacta, fora o perfil_id');
select ok((select perfil_id is null from public.clientes_stripe where stripe_customer_id = 'cus_a1'), 'clientes_stripe com perfil_id nulo');
select is((select email from public.clientes_stripe where stripe_customer_id = 'cus_a1'), 'titular@exemplo.test',
          'clientes_stripe retem o e-mail (dado retido por obrigacao legal, a validar pelo solicitor)');
select is((select perfil_id from public.clientes_stripe where stripe_customer_id = 'cus_c1'), tt.u('c1'), 'customer de outro titular intacto');

-- 2) acesso do uuid apagado -----------------------------------------------------------------------------
select is(private.nivel_atual(tt.u('a1'))::text, 'visitante', 'uuid apagado: nivel visitante');
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), false, 'uuid apagado (JWT ainda valido): tem_acesso(clube) falso');
reset role;

-- 3) webhook depois da exclusao: customer com perfil_id nulo --------------------------------------------
select is(tt.webhook(tt.ev_sub('evt_d1', 'customer.subscription.deleted', 300, 'sub_x', 'canceled', 'cus_a1')),
          'ignorado_orfao', 'subscription.deleted de customer sem perfil: sem excecao, ignorado_orfao');
select is(tt.webhook(tt.ev_sub('evt_u1', 'customer.subscription.updated', 400, 'sub_x', 'canceled', 'cus_a1')),
          'ignorado_orfao', 'subscription.updated de customer sem perfil: sem excecao, ignorado_orfao');
reset role;
select is((select count(*)::int from public.eventos_stripe where event_id in ('evt_d1', 'evt_u1') and processado_em is not null),
          2, 'os dois eventos ficam processados (o Stripe nao reenvia)');
select ok((select perfil_id is null and status = 'canceled' and plano_id is not null and conta_stripe_id is not null
                   from public.assinaturas where stripe_subscription_id = 'sub_x'),
          'assinatura orfa passa a refletir o ciclo de vida do Stripe (status canceled, perfil_id segue nulo, plano e conta intactos; a f1_14 atualiza so o ciclo de vida)');

select * from finish();
rollback;

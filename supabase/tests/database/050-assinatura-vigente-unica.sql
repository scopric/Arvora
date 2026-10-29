-- f1_13: no maximo uma assinatura vigente por perfil + tratamento na RPC. Transacao desfeita.
-- Dados ficticios. Regra provisoria (por perfil) ate o cliente definir a regra comercial.
begin;
select plan(36);

create schema tt;
grant usage on schema tt to public;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
create function tt.conta(a text default 'acct_teste') returns bigint language sql as $$ select id from public.contas_stripe where stripe_account_id = a $$;
create function tt.plano(price text) returns bigint language sql as $$ select id from public.planos where stripe_price_id = price $$;
-- insere assinatura direto (como dono do banco), sem passar pela RPC
create function tt.ins(perfil text, sub text, price text, st text, conta text default 'acct_teste') returns void language sql as $$
  insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, origem, periodo_inicio, periodo_fim)
  values (tt.u(perfil), tt.conta(conta), sub, tt.plano(price), st::public.status_assinatura, 'stripe', now(), now() + interval '30 days') $$;
create function tt.ev_sub(evt text, tipo text, criado bigint, sub text, st text, price text, cus text) returns jsonb
language sql as $$
  select jsonb_build_object('id', evt, 'type', tipo, 'created', criado, 'data', jsonb_build_object('object',
    jsonb_build_object('id', sub, 'object', 'subscription', 'customer', cus, 'status', st,
      'cancel_at_period_end', false, 'canceled_at', case when st = 'canceled' then criado end, 'metadata', '{}'::jsonb,
      'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object(
        'quantity', 1, 'current_period_start', extract(epoch from now() - interval '1 day')::bigint,
        'current_period_end', extract(epoch from now() + interval '30 days')::bigint,
        'price', jsonb_build_object('id', price, 'unit_amount', 1, 'currency', 'eur')))))))
$$;
create function tt.processa(e jsonb) returns text language sql as $$ select public.processar_evento_stripe(tt.conta(), e) $$;
create function tt.foto(perfil text) returns text language sql as $$
  select md5(coalesce(string_agg(a::text, '|' order by a.id), '')) from public.assinaturas a where a.perfil_id = tt.u(perfil) $$;

insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('a2'), ('a3'), ('a4'), ('a5'), ('a6'), ('a7'), ('a8'), ('b1')) v(id);
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE'), ('acct_outra', 'Outra', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
values (tt.conta(), 'price_v1', 'Plano 1', 'clube', 'mes', 'assinatura', 1, 'EUR'),
       (tt.conta(), 'price_v1b', 'Plano 1 b', 'clube', 'ano', 'assinatura', 1, 'EUR'),
       (tt.conta('acct_outra'), 'price_o1', 'Outra conta', 'clube', 'mes', 'assinatura', 1, 'EUR');

-- 1) indice -------------------------------------------------------------------------------------------
select ok((select indisunique from pg_index where indexrelid = 'public.assinaturas_perfil_vigente_uq'::regclass), 'indice e unico');
select ok((select indpred is not null from pg_index where indexrelid = 'public.assinaturas_perfil_vigente_uq'::regclass), 'indice e parcial');

-- 2) o indice ------------------------------------------------------------------------------------------
select tt.ins('a1', 'sub_p1a', 'price_v1', 'active');
select throws_ok($$select tt.ins('a1', 'sub_p1b', 'price_v1b', 'active')$$, '23505', null, 'mesmo perfil: 23505');
select throws_ok($$select tt.ins('a1', 'sub_p1c', 'price_v1', 'past_due')$$, '23505', null, 'past_due conta como vigente');
select throws_ok($$select tt.ins('a1', 'sub_p1d', 'price_v1', 'trialing')$$, '23505', null, 'trialing conta como vigente');
select lives_ok($$select tt.ins('a1', 'sub_p1e', 'price_v1', 'canceled')$$, 'canceled nao conta');
select lives_ok($$select tt.ins('a1', 'sub_p1f', 'price_v1', 'unpaid')$$, 'unpaid nao conta');
select throws_ok($$select tt.ins('a1', 'sub_p1h', 'price_o1', 'active', 'acct_outra')$$, '23505', null, 'mesmo perfil em outra conta Stripe tambem colide (regra por perfil)');
select lives_ok($$update public.assinaturas set status = 'past_due', periodo_fim = periodo_fim + interval '1 day' where stripe_subscription_id = 'sub_p1a'$$,
                'atualizar a MESMA assinatura nao conflita');
select throws_ok($$update public.assinaturas set status = 'active' where stripe_subscription_id = 'sub_p1e'$$, '23505', null, 'reviver canceled colide com a vigente');
-- p2: past_due existente bloqueia nova active; trialing tambem
select tt.ins('a2', 'sub_p2a', 'price_v1', 'past_due');
select throws_ok($$select tt.ins('a2', 'sub_p2b', 'price_v1', 'active')$$, '23505', null, 'past_due existente bloqueia nova active');
select tt.ins('a3', 'sub_p3a', 'price_v1', 'trialing');
select throws_ok($$select tt.ins('a3', 'sub_p3b', 'price_v1', 'active')$$, '23505', null, 'trialing existente bloqueia nova active');
select lives_ok($$select tt.ins('a4', 'sub_p4a', 'price_v1', 'active'), tt.ins('a5', 'sub_p5a', 'price_v1', 'active')$$, 'perfis diferentes nao conflitam');

-- 4) RPC -----------------------------------------------------------------------------------------------
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
values (tt.conta(), 'cus_b1', tt.u('b1'), 'b1@t.test');
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_a', 'customer.subscription.created', 1000, 'sub_a', 'active', 'price_v1', 'cus_b1')), 'processado', 'sub A processada');
select set_config('tt.foto', tt.foto('b1'), true);
select is(tt.processa(tt.ev_sub('evt_b', 'customer.subscription.created', 2000, 'sub_b', 'active', 'price_v1b', 'cus_b1')),
          'conflito_assinatura_vigente', 'sub B (pagamento em dobro) devolve conflito_assinatura_vigente');
reset role;
select is(tt.foto('b1'), current_setting('tt.foto'), 'assinaturas intacta no conflito');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_b'), 0, 'sub B nao foi gravada');
select is((select erro from public.eventos_stripe where event_id = 'evt_b'), 'conflito_assinatura_vigente: sub_b x sub_a', 'erro gravado, sem dado pessoal');
select ok((select processado_em is null from public.eventos_stripe where event_id = 'evt_b'), 'reserva fica sem processado_em');
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_b', 'customer.subscription.created', 2000, 'sub_b', 'active', 'price_v1b', 'cus_b1')),
          'conflito_assinatura_vigente', 'reenvio com o conflito ainda ativo: conflito de novo');
select is(tt.processa(tt.ev_sub('evt_c', 'customer.subscription.created', 2100, 'sub_c', 'active', 'price_v1b', 'cus_b1')),
          'conflito_assinatura_vigente', 'outra duplicata (sub C) tambem conflita, sem excecao');
select is((select count(*)::int from public.eventos_stripe where event_id = 'evt_b'), 1, 'reentrega nao duplica a reserva');
select throws_ok($$select tt.processa(tt.ev_sub('evt_x', 'customer.subscription.created', 2150, 'sub_x', 'active', 'price_nao', 'cus_b1'))$$,
                 'P0001', 'Price desconhecido nesta conta: price_nao', 'dado invalido continua levantando excecao (nao vira conflito)');
select is(public.processar_evento_stripe(tt.conta(), '{"id":"evt_y","type":"invoice.paid","created":2160,"data":{"object":{"id":"in_1"}}}'),
          'ignorado_tipo', 'evento de outro tipo continua processado');
select is(tt.processa(tt.ev_sub('evt_d', 'customer.subscription.created', 2200, 'sub_d', 'canceled', 'price_v1b', 'cus_b1')),
          'processado', 'evento nao vigente (canceled) nao conflita');
select is(tt.processa(tt.ev_sub('evt_a2', 'customer.subscription.deleted', 3000, 'sub_a', 'canceled', 'price_v1', 'cus_b1')),
          'processado', 'A cancelada');
select is(tt.processa(tt.ev_sub('evt_b', 'customer.subscription.created', 2000, 'sub_b', 'active', 'price_v1b', 'cus_b1')),
          'processado', 'reenvio de B apos cancelar A: processado');
reset role;
select is((select status::text from public.assinaturas where stripe_subscription_id = 'sub_b'), 'active', 'B gravada como active');
select ok((select erro is null and processado_em is not null from public.eventos_stripe where event_id = 'evt_b'), 'erro limpo e evento processado');
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_b', 'customer.subscription.created', 2000, 'sub_b', 'active', 'price_v1b', 'cus_b1')), 'duplicado', 'replay apos processado: duplicado');
reset role;

-- 5) evento obsoleto nao e conflito (perfil c1: A cancelada, B ativa) ------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values (tt.u('c1'), 'c1@t.test', '{"nome":"X","maior_18":"true"}'::jsonb);
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email) values (tt.conta(), 'cus_c1', tt.u('c1'), 'c1@t.test');
set local role service_role;
select tt.processa(tt.ev_sub('evt_ca', 'customer.subscription.created', 5000, 'sub_ca', 'canceled', 'price_v1', 'cus_c1'));
select tt.processa(tt.ev_sub('evt_cb', 'customer.subscription.created', 5100, 'sub_cb', 'active', 'price_v1b', 'cus_c1'));
reset role;
select set_config('tt.foto', tt.foto('c1'), true);
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_co', 'customer.subscription.updated', 4000, 'sub_ca', 'active', 'price_v1', 'cus_c1')),
          'ignorado_antigo', 'evento ANTIGO da A (active) com B vigente: ignorado_antigo, nao conflito');
select is(tt.processa(tt.ev_sub('evt_ce', 'customer.subscription.updated', 5000, 'sub_ca', 'active', 'price_v1', 'cus_c1')),
          'ignorado_antigo', 'empate de created com A terminal: ignorado_antigo');
reset role;
select is(tt.foto('c1'), current_setting('tt.foto'), 'obsoletos: assinaturas intacta');
select ok((select processado_em is not null and erro is null from public.eventos_stripe where event_id = 'evt_co'), 'obsoleto fica processado, sem erro');
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_cn', 'customer.subscription.updated', 6000, 'sub_ca', 'active', 'price_v1', 'cus_c1')),
          'conflito_assinatura_vigente', 'evento NOVO da A (active) com B vigente: conflito de verdade');
reset role;
select is((select erro from public.eventos_stripe where event_id = 'evt_cn'), 'conflito_assinatura_vigente: sub_ca x sub_cb', 'erro do conflito real');

select * from finish();
rollback;

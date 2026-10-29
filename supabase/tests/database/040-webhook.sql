-- Webhook do Stripe (f1_11): public.processar_evento_stripe. Transacao desfeita.
-- FIXTURES DE TESTE: os eventos abaixo sao JSON minimos feitos a mao (valores ficticios), a trocar pelos
-- reais quando houver o 1o evento de teste do Stripe (Erros 5.2).
begin;
select plan(63);

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

-- Evento customer.subscription.* minimo. Periodo no item (formato das APIs novas, nao verificado).
create function tt.ev_sub(evt text, tipo text, criado bigint, sub text, st text,
                          price text default 'price_t_clube', valor bigint default 1, moeda text default 'eur',
                          perfil text default null, cus text default 'cus_a1', itens int default 1,
                          qtd int default 1) returns jsonb
language sql as $$
  select jsonb_build_object('id', evt, 'type', tipo, 'created', criado, 'data', jsonb_build_object('object',
    jsonb_build_object('id', sub, 'object', 'subscription', 'customer', cus, 'status', st,
      'cancel_at_period_end', false, 'canceled_at', case when st = 'canceled' then criado end,
      'metadata', case when perfil is null then '{}'::jsonb else jsonb_build_object('perfil_id', perfil) end,
      'items', jsonb_build_object('data', (select jsonb_agg(jsonb_build_object(
        'quantity', qtd, 'current_period_start', extract(epoch from now() - interval '1 day')::bigint,
        'current_period_end', extract(epoch from now() + interval '30 days')::bigint,
        'price', jsonb_build_object('id', price, 'unit_amount', valor, 'currency', moeda)))
        from generate_series(1, itens))))))
$$;
-- checkout.session.completed minimo; ref = client_reference_id (null = ausente).
create function tt.ev_co(evt text, criado bigint, cus text, ref text, meta text default null) returns jsonb
language sql as $$
  select jsonb_build_object('id', evt, 'type', 'checkout.session.completed', 'created', criado, 'data', jsonb_build_object('object',
    jsonb_strip_nulls(jsonb_build_object('id', 'cs_' || evt, 'customer', cus, 'client_reference_id', ref,
      'customer_details', jsonb_build_object('email', cus || '@t.test'),
      'metadata', case when meta is null then '{}'::jsonb else jsonb_build_object('perfil_id', meta) end))))
$$;
create function tt.processa(e jsonb) returns text language sql as $$ select public.processar_evento_stripe(tt.conta(), e) $$;
create function tt.status(sub text) returns text language sql as $$ select status::text from public.assinaturas where stripe_subscription_id = sub $$;
create function tt.contagem() returns text language sql as $$
  select (select count(*) from public.assinaturas) || '/' || (select count(*) from public.eventos_stripe) || '/' ||
         (select count(*) from public.clientes_stripe) $$;
create function tt.foto() returns text language sql as $$
  select md5(coalesce((select string_agg(p::text, '|' order by p.id) from public.planos p), '') ||
             coalesce((select string_agg(p::text, '|' order by p.id) from public.perfis p), '') ||
             coalesce((select string_agg(c::text, '|' order by c.id) from public.contas_stripe c), '') ||
             coalesce((select string_agg(e::text, '|' order by e.perfil_id) from public.equipe e), '')) $$;

-- a1=assinante (via checkout), b1=assinante (clientes_stripe pre-gravado), c1=checkout, d1/e1=dono apagado
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('c1'), ('d1'), ('e1')) v(id);
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
values (tt.conta(), 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR');
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
values (tt.conta(), 'cus_b1', tt.u('b1'), 'b1@t.test');
select set_config('tt.foto', tt.foto(), true);

-- 1) privilegios ------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.processar_evento_stripe(bigint, jsonb)', 'execute'), 'anon sem execute na RPC');
select ok(not has_function_privilege('authenticated', 'public.processar_evento_stripe(bigint, jsonb)', 'execute'), 'authenticated sem execute na RPC');
select ok(has_function_privilege('service_role', 'public.processar_evento_stripe(bigint, jsonb)', 'execute'), 'service_role executa a RPC');
set local role anon;
select throws_ok($$select public.processar_evento_stripe(1, '{}')$$, '42501', null, 'anon chamando a RPC: 42501');
reset role;
select tt.como(tt.u('a1'));
select throws_ok($$select public.processar_evento_stripe(1, '{}')$$, '42501', null, 'authenticated chamando a RPC: 42501');
reset role;

-- 2) criacao, replay e payload -----------------------------------------------------------------------
set local role service_role;
select is(tt.processa(tt.ev_co('evt_0', 900, 'cus_a1', tt.u('a1')::text)), 'processado', 'checkout de a1 grava o vinculo');
select is(tt.processa(tt.ev_sub('evt_1', 'customer.subscription.created', 1000, 'sub_a', 'active', perfil => tt.u('a1')::text)),
          'processado', 'service_role cria a assinatura');
reset role;
select is(tt.status('sub_a'), 'active', 'assinatura gravada como active');
select is((select perfil_id from public.assinaturas where stripe_subscription_id = 'sub_a'), tt.u('a1'), 'perfil vem do vinculo gravado pelo checkout');
select is((select stripe_evento_em from public.assinaturas where stripe_subscription_id = 'sub_a'), to_timestamp(1000), 'stripe_evento_em = event.created');
select ok((select periodo_fim > now() from public.assinaturas where stripe_subscription_id = 'sub_a'), 'periodo lido de items.data[0]');
select is(tt.processa(tt.ev_sub('evt_1', 'customer.subscription.created', 1000, 'sub_a', 'active', perfil => tt.u('a1')::text)),
          'duplicado', 'replay do mesmo event_id retorna duplicado');
select is((select count(*)::int from public.eventos_stripe where event_id = 'evt_1'), 1, 'replay nao duplica eventos_stripe');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_a'), 1, 'replay nao duplica assinatura');
select is((select count(*)::int from public.eventos_stripe where payload is not null), 0, 'payload fica nulo');
select ok((select bool_and(processado_em is not null) from public.eventos_stripe), 'eventos marcados como processados');

-- 3) tem_acesso conforme o status --------------------------------------------------------------------
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), true, 'active da acesso');
reset role;
select tt.processa(tt.ev_sub('evt_2', 'customer.subscription.updated', 2000, 'sub_a', 'past_due', perfil => tt.u('a1')::text));
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), true, 'past_due mantem acesso (nivel_atual)');
reset role;
select tt.processa(tt.ev_sub('evt_3', 'customer.subscription.updated', 3000, 'sub_a', 'unpaid', perfil => tt.u('a1')::text));
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), false, 'unpaid perde acesso');
reset role;

-- 4) fora de ordem -----------------------------------------------------------------------------------
select is(tt.processa(tt.ev_sub('evt_4', 'customer.subscription.updated', 2500, 'sub_a', 'active', perfil => tt.u('a1')::text)),
          'ignorado_antigo', 'evento mais antigo e ignorado');
select is(tt.status('sub_a'), 'unpaid', 'evento antigo nao sobrescreve o mais novo');
select ok((select processado_em is not null from public.eventos_stripe where event_id = 'evt_4'), 'evento antigo fica processado');
select tt.processa(tt.ev_sub('evt_5', 'customer.subscription.deleted', 5000, 'sub_a', 'canceled', perfil => tt.u('a1')::text));
select tt.processa(tt.ev_sub('evt_6', 'customer.subscription.updated', 4000, 'sub_a', 'active', perfil => tt.u('a1')::text));
select is(tt.status('sub_a'), 'canceled', 'deleted seguido de updated antigo continua canceled');
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), false, 'canceled perde acesso');
reset role;

-- 4b) mesmo created: canceled nunca e revivido, nas duas ordens ---------------------------------------
select tt.processa(tt.ev_sub('evt_m1', 'customer.subscription.deleted', 6000, 'sub_m1', 'canceled', perfil => tt.u('a1')::text, cus => 'cus_a1'));
select is(tt.processa(tt.ev_sub('evt_m2', 'customer.subscription.updated', 6000, 'sub_m1', 'active', perfil => tt.u('a1')::text, cus => 'cus_a1')),
          'ignorado_antigo', 'mesmo created: updated depois de deleted e ignorado');
select is(tt.status('sub_m1'), 'canceled', 'mesmo created, deleted antes: fica canceled');
select tt.processa(tt.ev_sub('evt_m3', 'customer.subscription.updated', 6000, 'sub_m2', 'active', perfil => tt.u('a1')::text, cus => 'cus_a1'));
select tt.processa(tt.ev_sub('evt_m4', 'customer.subscription.deleted', 6000, 'sub_m2', 'canceled', perfil => tt.u('a1')::text, cus => 'cus_a1'));
select is(tt.status('sub_m2'), 'canceled', 'mesmo created, updated antes: fica canceled');
select is((select perfil_id from public.clientes_stripe where stripe_customer_id = 'cus_a1'), tt.u('a1'), 'vinculo de cus_a1 veio do client_reference_id');

-- 5) perfil via clientes_stripe e reprocessamento de reserva -----------------------------------------
insert into public.eventos_stripe (conta_stripe_id, event_id, tipo, criado_stripe_em)
values (tt.conta(), 'evt_7', 'customer.subscription.created', to_timestamp(7000));
select is(tt.processa(tt.ev_sub('evt_7', 'customer.subscription.created', 7000, 'sub_b', 'active', cus => 'cus_b1')),
          'processado', 'reserva sem processado_em e reprocessada');
select is((select perfil_id from public.assinaturas where stripe_subscription_id = 'sub_b'), tt.u('b1'), 'perfil achado por clientes_stripe');
select ok((select processado_em is not null from public.eventos_stripe where event_id = 'evt_7'), 'reserva reprocessada fica processada');

-- 6) checkout e tipos sem efeito ---------------------------------------------------------------------
select is(tt.processa(tt.ev_co('evt_8', 8000, 'cus_c1', tt.u('c1')::text, meta => tt.u('a1')::text)),
  'processado', 'checkout.session.completed processado');
select is((select perfil_id from public.clientes_stripe where stripe_customer_id = 'cus_c1'), tt.u('c1'), 'checkout liga customer ao perfil do client_reference_id (metadata ignorada)');
select is(public.processar_evento_stripe(tt.conta(), '{"id":"evt_9","type":"invoice.paid","created":9000,"data":{"object":{"id":"in_1"}}}'),
          'ignorado_tipo', 'invoice.paid processado sem efeito');

-- 7) erros desfazem tudo -----------------------------------------------------------------------------
select set_config('tt.antes', tt.contagem(), true);
select throws_ok($$select tt.processa(tt.ev_sub('evt_e1', 'customer.subscription.created', 9100, 'sub_x', 'active', price => 'price_t_nao', cus => 'cus_b1'))$$,
                 'P0001', 'Price desconhecido nesta conta: price_t_nao', 'Price desconhecido da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e2', 'customer.subscription.created', 9100, 'sub_x', 'active', valor => 2, cus => 'cus_b1'))$$,
                 'P0001', 'valor ou moeda do Price price_t_clube divergem de planos', 'valor divergente da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e3', 'customer.subscription.created', 9100, 'sub_x', 'active', moeda => 'usd', cus => 'cus_b1'))$$,
                 'P0001', 'valor ou moeda do Price price_t_clube divergem de planos', 'moeda divergente da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e4', 'customer.subscription.created', 9100, 'sub_x', 'active', itens => 2, cus => 'cus_b1'))$$,
                 'P0001', 'assinatura sub_x deve ter exatamente 1 item', 'mais de 1 item da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e5', 'customer.subscription.created', 9100, 'sub_x', 'active', perfil => tt.u('c1')::text, cus => 'cus_nao'))$$,
                 'P0001', 'cliente_desconhecido: customer cus_nao sem vinculo em clientes_stripe', 'customer desconhecido da erro mesmo com metadata.perfil_id valido');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_x'), 0, 'customer desconhecido: nenhuma assinatura');
select is((select count(*)::int from public.clientes_stripe where stripe_customer_id = 'cus_nao'), 0, 'customer desconhecido: nenhum vinculo');
select throws_ok($$select tt.processa(tt.ev_co('evt_e15', 9100, 'cus_nao', null, meta => tt.u('c1')::text))$$,
                 'P0001', 'evento_malformado: client_reference_id', 'checkout sem client_reference_id da erro (metadata nao serve)');
select throws_ok($$select tt.processa(tt.ev_co('evt_e16', 9100, 'cus_nao', 'nao-e-uuid'))$$,
                 'P0001', 'evento_malformado: client_reference_id', 'checkout com client_reference_id invalido da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e6', 'customer.subscription.created', 9100, 'sub_x', 'active', qtd => 2, cus => 'cus_b1'))$$,
                 'P0001', 'quantity deve ser 1 na assinatura sub_x (veio 2)', 'quantity 2 da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e7', 'customer.subscription.created', 9100, 'sub_x', 'active', cus => 'cus_b1') #- '{data,object,items,data,0,price}')$$,
                 'P0001', 'item sem price na assinatura sub_x (formato antigo com plan nao suportado)', 'item sem price da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e8', 'customer.subscription.created', 9100, 'sub_x', 'pausado_novo', cus => 'cus_b1'))$$,
                 'P0001', 'status_stripe_desconhecido: pausado_novo na assinatura sub_x', 'status desconhecido da erro');
select throws_ok($$select tt.processa(jsonb_set(tt.ev_sub('evt_e10', 'customer.subscription.created', 9100, 'sub_x', 'active', cus => 'cus_b1'), '{created}', '"abc"'))$$,
                 'P0001', 'evento_malformado: created ausente ou nao numerico no evento evt_e10', 'created nao numerico da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e11', 'customer.subscription.created', 9100, 'sub_x', 'active', cus => 'cus_b1') - 'created')$$,
                 'P0001', 'evento_malformado: created ausente ou nao numerico no evento evt_e11', 'created ausente da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e12', 'customer.subscription.created', 9100, 'sub_x', 'active', perfil => tt.u('a1')::text, cus => 'cus_b1'))$$,
                 'P0001', 'perfil_divergente: metadata.perfil_id difere de clientes_stripe no customer cus_b1', 'metadata divergente de clientes_stripe da erro');
select throws_ok($$select tt.processa(tt.ev_sub('evt_e13', 'customer.subscription.updated', 9100, 'sub_b', 'active', perfil => tt.u('c1')::text, cus => 'cus_c1'))$$,
                 'P0001', 'perfil_divergente: assinatura sub_b ja pertence a outro perfil', 'evento nao troca o perfil_id da assinatura');
select throws_ok($$select tt.processa(tt.ev_co('evt_e14', 9100, 'cus_b1', tt.u('a1')::text))$$,
                 'P0001', 'perfil_divergente: customer cus_b1 ja ligado a outro perfil', 'checkout nao troca o perfil do Customer');
select is(tt.contagem(), current_setting('tt.antes'), 'erros nao gravam nenhuma linha (assinaturas/eventos/clientes)');

-- 7b) dono apagado (GDPR): ignorado_orfao, assinatura intacta, sem religar --------------------------
select tt.processa(tt.ev_co('evt_d0', 10000, 'cus_d1', tt.u('d1')::text));
select is(tt.processa(tt.ev_sub('evt_d1', 'customer.subscription.created', 10100, 'sub_d', 'active', cus => 'cus_d1')), 'processado', 'd1 assina');
delete from auth.users where id = tt.u('d1');
select set_config('tt.foto', tt.foto(), true);  -- o delete acima e do teste, nao da RPC
select ok((select perfil_id is null from public.assinaturas where stripe_subscription_id = 'sub_d'), 'perfil apagado: assinatura fica com perfil_id nulo');
select set_config('tt.sub_d', (select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_d'), true);
select is(tt.processa(tt.ev_sub('evt_d2', 'customer.subscription.updated', 10200, 'sub_d', 'canceled', cus => 'cus_d1')),
          'ignorado_orfao', 'evento de assinatura de perfil apagado: ignorado_orfao');
select is((select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_d'), current_setting('tt.sub_d'), 'assinatura orfa intacta');
select ok((select processado_em is not null from public.eventos_stripe where event_id = 'evt_d2'), 'evento orfao fica processado');
select is(tt.processa(tt.ev_sub('evt_d2', 'customer.subscription.updated', 10200, 'sub_d', 'canceled', cus => 'cus_d1')),
          'duplicado', 'replay do evento orfao: duplicado');
select is(tt.processa(tt.ev_sub('evt_d3', 'customer.subscription.created', 10300, 'sub_d2', 'active', cus => 'cus_d1')),
          'ignorado_orfao', 'customer ligado a perfil apagado: ignorado_orfao');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_d2'), 0, 'customer orfao nao cria assinatura');
-- assinatura orfa com customer ainda ligado a perfil vivo: nao religa
select tt.processa(tt.ev_co('evt_x0', 11000, 'cus_e1', tt.u('e1')::text));
select tt.processa(tt.ev_sub('evt_x1', 'customer.subscription.created', 11100, 'sub_e', 'active', cus => 'cus_e1'));
update public.assinaturas set perfil_id = null where stripe_subscription_id = 'sub_e';
select set_config('tt.sub_e', (select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_e'), true);
select is(tt.processa(tt.ev_sub('evt_x2', 'customer.subscription.updated', 11200, 'sub_e', 'past_due', cus => 'cus_e1')),
          'ignorado_orfao', 'assinatura orfa: ignorado_orfao mesmo com customer ligado');
select is((select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_e'), current_setting('tt.sub_e'), 'assinatura orfa nao e religada');

-- 8) nunca escreve em planos, perfis, contas_stripe, equipe -----------------------------------------
select is(tt.foto(), current_setting('tt.foto'), 'planos, perfis, contas_stripe e equipe intactos');

select * from finish();
rollback;

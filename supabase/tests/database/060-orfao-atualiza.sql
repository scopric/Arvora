-- f1_14: assinatura ORFA (dono apagou a conta) tem o ciclo de vida atualizado; o retorno segue 'ignorado_orfao'. Transacao desfeita.
-- Dados ficticios. a1 = assinante vivo (controle), b1 = dono apagado (vinculo e assinatura orfaos: casos a e b juntos),
-- b2 = vinculo vivo mas assinatura orfa (so caso b), b3 = dono apagado sem assinatura (so caso a).
begin;
select plan(37);

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

create function tt.resto(sub text) returns text language sql as $$
  select md5((to_jsonb(a) - array['status', 'periodo_inicio', 'periodo_fim', 'cancela_no_fim', 'cancelada_em',
                                  'stripe_evento_em', 'atualizado_em'])::text)
  from public.assinaturas a where stripe_subscription_id = sub $$;
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('b2'), ('b3'), ('b4'), ('b5')) v(id);
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
values (tt.conta(), 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR');

set local role service_role;
select tt.processa(tt.ev_co('evt_c_a1', 900, 'cus_a1', tt.u('a1')::text));
select tt.processa(tt.ev_sub('evt_s_a1', 'customer.subscription.created', 1000, 'sub_a1', 'active', cus => 'cus_a1'));
select tt.processa(tt.ev_co('evt_c_o1', 900, 'cus_o1', tt.u('b1')::text));
select tt.processa(tt.ev_sub('evt_s_o1', 'customer.subscription.created', 1000, 'sub_o1', 'active', cus => 'cus_o1'));
select tt.processa(tt.ev_co('evt_c_o2', 900, 'cus_o2', tt.u('b2')::text));
select tt.processa(tt.ev_sub('evt_s_o2', 'customer.subscription.created', 1000, 'sub_o2', 'active', cus => 'cus_o2'));
select tt.processa(tt.ev_co('evt_c_o3', 900, 'cus_o3', tt.u('b3')::text));
reset role;
delete from auth.users where id in (tt.u('b1'), tt.u('b3'));       -- vinculo e assinatura passam a ter perfil_id nulo
update public.assinaturas set perfil_id = null where stripe_subscription_id = 'sub_o2';  -- so a assinatura fica orfa

select ok((select perfil_id is null from public.assinaturas where stripe_subscription_id = 'sub_o1'), 'o1: assinatura orfa');
select ok((select perfil_id is null from public.clientes_stripe where stripe_customer_id = 'cus_o1'), 'o1: vinculo orfao');
select set_config('tt.foto', tt.foto(), true);
select set_config('tt.resto_o1', tt.resto('sub_o1'), true);
select set_config('tt.resto_o2', tt.resto('sub_o2'), true);

-- casos (a)+(b): cancelamento da orfa ------------------------------------------------------------------
select is(tt.processa(tt.ev_sub('evt_o1', 'customer.subscription.deleted', 2000, 'sub_o1', 'canceled', cus => 'cus_o1')),
          'ignorado_orfao', 'orfa cancelada: retorno segue ignorado_orfao');
select is(tt.status('sub_o1'), 'canceled', 'orfa passa a canceled');
select is((select cancelada_em from public.assinaturas where stripe_subscription_id = 'sub_o1'), to_timestamp(2000), 'cancelada_em vem do evento');
select is((select stripe_evento_em from public.assinaturas where stripe_subscription_id = 'sub_o1'), to_timestamp(2000), 'stripe_evento_em = created do evento');
select ok((select periodo_fim > now() from public.assinaturas where stripe_subscription_id = 'sub_o1'), 'periodo vem do evento');
select ok((select perfil_id is null from public.assinaturas where stripe_subscription_id = 'sub_o1'), 'perfil_id segue nulo');
select is(tt.resto('sub_o1'), current_setting('tt.resto_o1'), 'plano_id, conta_stripe_id, origem e demais campos intactos');
select is(tt.contagem(), '3/8/4', 'sem assinatura nem vinculo novos (so o evento e reservado)');
select ok((select processado_em is not null and erro is null from public.eventos_stripe where event_id = 'evt_o1'), 'evento processado, sem erro');
select is(tt.processa(tt.ev_sub('evt_o1', 'customer.subscription.deleted', 2000, 'sub_o1', 'canceled', cus => 'cus_o1')),
          'duplicado', 'replay: duplicado');

-- ordem: antigo e empate com terminal nao reativam ---------------------------------------------------
select is(tt.processa(tt.ev_sub('evt_o1_old', 'customer.subscription.updated', 1500, 'sub_o1', 'active', cus => 'cus_o1')),
          'ignorado_orfao', 'evento antigo da orfa: ignorado_orfao');
select is(tt.status('sub_o1'), 'canceled', 'evento antigo nao reativa a orfa');
select tt.processa(tt.ev_sub('evt_o1_tie', 'customer.subscription.updated', 2000, 'sub_o1', 'active', cus => 'cus_o1'));
select is(tt.status('sub_o1'), 'canceled', 'empate de created com terminal nao reativa a orfa');
select is((select stripe_evento_em from public.assinaturas where stripe_subscription_id = 'sub_o1'), to_timestamp(2000), 'evento obsoleto nao mexe em stripe_evento_em');

-- caso (b) isolado: vinculo vivo, assinatura orfa ----------------------------------------------------
select is(tt.processa(tt.ev_sub('evt_o2', 'customer.subscription.updated', 3000, 'sub_o2', 'past_due', cus => 'cus_o2')),
          'ignorado_orfao', 'caso b: ignorado_orfao');
select is(tt.status('sub_o2'), 'past_due', 'caso b: status atualizado');
select ok((select perfil_id is null from public.assinaturas where stripe_subscription_id = 'sub_o2'), 'caso b: perfil segue nulo (nao religa)');
select is(tt.resto('sub_o2'), current_setting('tt.resto_o2'), 'caso b: resto da linha intacto');
select tt.processa(tt.ev_sub('evt_o2_tie', 'customer.subscription.updated', 3000, 'sub_o2', 'trialing', cus => 'cus_o2'));
select is(tt.status('sub_o2'), 'trialing', 'empate com status nao terminal aplica (mesma regra do upsert)');
select ok((select bool_and(processado_em is not null and erro is null) from public.eventos_stripe where event_id like 'evt_o%'), 'eventos orfaos processados, sem erro');

-- caso (a) isolado: vinculo orfao, subscription inexistente -> nada criado -----------------------------
select is(tt.processa(tt.ev_sub('evt_o3', 'customer.subscription.created', 4000, 'sub_o3', 'active', cus => 'cus_o3')),
          'ignorado_orfao', 'caso a: ignorado_orfao');
select is((select count(*)::int from public.assinaturas where stripe_subscription_id = 'sub_o3'), 0, 'caso a: nao cria assinatura orfa');
select is((select count(*)::int from public.clientes_stripe), 4, 'vinculos: nenhum criado nem removido');
select is((select count(*)::int from public.assinaturas), 3, 'assinaturas: so as 3 do inicio');

-- validacoes anteriores ao ramo orfao seguem valendo -----------------------------------------------
select throws_ok($$select tt.processa(tt.ev_sub('evt_o4', 'customer.subscription.updated', 5000, 'sub_o1', 'active', price => 'price_t_nao', cus => 'cus_o1'))$$,
                 'P0001', 'Price desconhecido nesta conta: price_t_nao', 'orfa: Price desconhecido ainda da erro');

-- vinculo orfao + assinatura de membro VIVO: o evento do customer orfao nao altera a linha do vivo ---------
set local role service_role;
select tt.processa(tt.ev_co('evt_c_b4', 900, 'cus_b4', tt.u('b4')::text));
select tt.processa(tt.ev_sub('evt_s_b4', 'customer.subscription.created', 1000, 'sub_b4', 'active', cus => 'cus_b4'));
reset role;
select set_config('tt.linha_b4', (select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_b4'), true);
set local role service_role;
select is(tt.processa(tt.ev_sub('evt_b4', 'customer.subscription.deleted', 6000, 'sub_b4', 'canceled', cus => 'cus_o3')),
          'ignorado_orfao', 'vinculo orfao + assinatura de membro vivo: ignorado_orfao');
reset role;
select is((select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_b4'), current_setting('tt.linha_b4'),
          'assinatura do membro vivo: linha inteira intacta');
select tt.como(tt.u('b4'));
select is(public.tem_acesso('clube'), true, 'tem_acesso do membro vivo nao muda');
reset role;

-- mesma stripe_subscription_id orfa em OUTRA conta: o evento desta conta nao altera a linha ---------------
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_outra', 'Outra', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_t_outra', 'Clube outra', 'clube', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe where stripe_account_id = 'acct_outra';
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, origem, periodo_inicio, periodo_fim, stripe_evento_em)
select null, c.id, 'sub_outra', p.id, 'active', 'stripe', now(), now() + interval '30 days', to_timestamp(1000)
from public.contas_stripe c join public.planos p on p.conta_stripe_id = c.id where c.stripe_account_id = 'acct_outra';
select tt.processa(tt.ev_co('evt_c_b5', 900, 'cus_b5', tt.u('b5')::text));
select set_config('tt.foto', tt.foto(), true);
select set_config('tt.linha_outra', (select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_outra'), true);
select throws_ok($$select tt.processa(tt.ev_sub('evt_o5', 'customer.subscription.deleted', 7000, 'sub_outra', 'canceled', cus => 'cus_b5'))$$,
                 'P0001', 'perfil_divergente: assinatura sub_outra ja pertence a outro perfil', 'orfa de outra conta + vinculo vivo: nao entra no ramo orfao, da erro');
select is((select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_outra'), current_setting('tt.linha_outra'), 'orfa de outra conta intacta (erro)');
select is(tt.processa(tt.ev_sub('evt_o6', 'customer.subscription.deleted', 7000, 'sub_outra', 'canceled', cus => 'cus_o3')),
          'ignorado_orfao', 'orfa de outra conta + vinculo orfao: ignorado_orfao');
select is((select md5(a::text) from public.assinaturas a where stripe_subscription_id = 'sub_outra'), current_setting('tt.linha_outra'), 'orfa de outra conta intacta (ignorado)');

-- acesso e demais tabelas ---------------------------------------------------------------------------
select tt.como(tt.u('a1'));
select is(public.tem_acesso('clube'), true, 'tem_acesso do assinante vivo nao muda');
reset role;
select is(tt.status('sub_a1'), 'active', 'assinatura viva intacta');
select is(tt.foto(), current_setting('tt.foto'), 'planos, perfis, contas_stripe e equipe intactos');

select * from finish();
rollback;

-- Financeiro (f1_19/f1_20): verticais, assinaturas_status, pagamentos, itens, receitas_externas, reembolsos,
-- cambio_bce e o webhook gravando pagamentos e estornos. Eventos sao JSON minimos feitos a mao (formato real
-- NAO VERIFICADO). Transacao desfeita.
begin;
select plan(53);

-- O seed de desenvolvimento (supabase/seed.sql) nao entra no teste: apagado aqui, dentro da transacao desfeita no fim.
truncate public.verticais, public.edicoes, public.temas, public.categorias_rede, public.espacos, public.empresas,
  public.documentos_legais, public.planos cascade;
delete from auth.users where email like '%@exemplo.invalid';
delete from public.contas_stripe where stripe_account_id = 'acct_exemplo_local';

create schema tt;
grant usage on schema tt to public;
create function tt.como(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  set local role authenticated;
end $$;
create function tt.anonimo() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
create function tt.n(q text) returns int language plpgsql as $$
declare n int;
begin execute 'select count(*)::int from (' || q || ') x' into n; return n; end $$;
create function tt.afeta(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function tt.conta() returns bigint language sql as $$ select id from public.contas_stripe where stripe_account_id = 'acct_teste' $$;
create function tt.plano(p text) returns bigint language sql as $$ select id from public.planos where stripe_price_id = p $$;

-- Equipe: 51=super_admin, ed=editor, c0=corretor, d0=moderador, a0=auditor (nenhum com assinatura).
-- Membros: c1=clube, b1/b2=grupo, f1=logado sem assinatura (visitante).
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb, now()
from (values ('51'), ('ed'), ('c0'), ('d0'), ('a0'), ('c1'), ('b1'), ('b2'), ('f1')) v(id);
insert into public.equipe (perfil_id, papel) values
  (tt.u('51'), 'super_admin'), (tt.u('ed'), 'editor'), (tt.u('c0'), 'corretor'),
  (tt.u('d0'), 'moderador'), (tt.u('a0'), 'auditor');
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
values (tt.conta(), 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR'),
       (tt.conta(), 'price_t_grupo', 'Grupo teste', 'grupo', 'mes', 'assinatura', 1, 'EUR');
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u(s), tt.conta(), 'sub_' || s, tt.plano(p), 'active', now() - interval '1 day', now() + interval '30 days'
from (values ('c1', 'price_t_clube'), ('b1', 'price_t_grupo'), ('b2', 'price_t_grupo')) v(s, p);

create function tt.wh(e jsonb) returns text language plpgsql as $$
begin
  set local role service_role;
  return public.processar_evento_stripe(tt.conta(), e);
end $$;
create function tt.ev(evt text, tipo text, criado bigint, obj jsonb) returns jsonb language sql as $$
  select jsonb_build_object('id', evt, 'type', tipo, 'created', criado, 'data', jsonb_build_object('object', obj)) $$;
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
values (tt.conta(), 'cus_b1', tt.u('b1'), 'b1@t.test');

-- 1) verticais -----------------------------------------------------------------------------------------
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$insert into public.verticais (slug, nome) values ('v', 'V')$$, '42501', null, 'editor nao cria vertical');
reset role;
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$insert into public.verticais (slug, nome) values ('v', 'V')$$, '42501', null, 'super_admin sem aal2 nao cria vertical');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$insert into public.verticais (slug, nome, ativa) values ('v', 'V', true), ('oculta', 'O', false)$$, 'super_admin aal2 cria vertical');
reset role;
select tt.anonimo();
select is(tt.n('select 1 from public.verticais'), 1, 'anon le so verticais ativas');
reset role;

-- 2) historico de status --------------------------------------------------------------------------------
select is((select count(*)::int from public.assinaturas_status s join public.assinaturas a on a.id = s.assinatura_id
           where a.stripe_subscription_id = 'sub_b1'), 1, 'insert de assinatura gera historico');
update public.assinaturas set status = 'past_due' where stripe_subscription_id = 'sub_b1';
update public.assinaturas set cancela_no_fim = true where stripe_subscription_id = 'sub_b1';
select is((select count(*)::int from public.assinaturas_status s join public.assinaturas a on a.id = s.assinatura_id
           where a.stripe_subscription_id = 'sub_b1'), 2, 'so mudanca de status ou plano entra no historico');
update public.assinaturas set status = 'active', cancela_no_fim = false where stripe_subscription_id = 'sub_b1';
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.assinaturas_status'), 0, 'membro nao le historico');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select ok(tt.n('select 1 from public.assinaturas_status') >= 3, 'auditor le historico');
reset role;

-- 3) webhook: assinatura guarda stripe_criada_em ---------------------------------------------------------
select is(tt.wh(tt.ev('evt_s1', 'customer.subscription.updated', 5000, jsonb_build_object(
  'id', 'sub_b1', 'customer', 'cus_b1', 'status', 'active', 'created', 1000, 'cancel_at_period_end', false,
  'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('quantity', 1,
    'current_period_start', extract(epoch from now())::bigint, 'current_period_end', extract(epoch from now() + interval '30 days')::bigint,
    'price', jsonb_build_object('id', 'price_t_grupo', 'unit_amount', 1, 'currency', 'eur'))))))), 'processado', 'subscription.updated processado');
reset role;
select is((select stripe_criada_em from public.assinaturas where stripe_subscription_id = 'sub_b1'), to_timestamp(1000),
          'stripe_criada_em = subscription.created');

-- 4) webhook: invoice.paid grava pagamento e itens; replay nao duplica ------------------------------------
select is(tt.wh(tt.ev('evt_i1', 'invoice.paid', 6000, jsonb_build_object(
  'id', 'in_1', 'customer', 'cus_b1', 'currency', 'eur', 'amount_paid', 1230, 'customer_email', 'b1@t.test',
  'total_taxes', jsonb_build_array(jsonb_build_object('amount', 230)),
  'parent', jsonb_build_object('subscription_details', jsonb_build_object('subscription', 'sub_b1')),
  'status_transitions', jsonb_build_object('paid_at', 6000),
  'lines', jsonb_build_object('has_more', false, 'data', jsonb_build_array(
    jsonb_build_object('amount', 1230, 'description', 'Grupo', 'taxes', jsonb_build_array(jsonb_build_object('amount', 230)),
                       'pricing', jsonb_build_object('price_details', jsonb_build_object('price', 'price_t_grupo')))))))),
  'processado', 'invoice.paid processado');
reset role;
select is((select bruto_centavos || '/' || vat_centavos || '/' || moeda || '/' || (perfil_id = tt.u('b1'))::text
           from public.pagamentos where stripe_invoice_id = 'in_1'), '1230/230/EUR/true', 'pagamento com bruto, VAT, moeda e perfil');
select is((select assinatura_id from public.pagamentos where stripe_invoice_id = 'in_1'),
          (select id from public.assinaturas where stripe_subscription_id = 'sub_b1'), 'pagamento ligado a assinatura');
select is((select plano_id from public.pagamentos_itens i join public.pagamentos p on p.id = i.pagamento_id where p.stripe_invoice_id = 'in_1'),
          tt.plano('price_t_grupo'), 'item classificado pelo Price (formato novo)');
select is(tt.wh(tt.ev('evt_i1', 'invoice.paid', 6000, '{"id":"in_1"}')), 'duplicado', 'replay do evento: duplicado');
reset role;
select is(tt.wh(tt.ev('evt_i1b', 'invoice.paid', 6001, jsonb_build_object('id', 'in_1', 'customer', 'cus_b1', 'currency', 'eur',
  'amount_paid', 1230, 'lines', jsonb_build_object('data', '[]'::jsonb)))), 'processado', 'outro evento da mesma invoice nao duplica');
reset role;
select is((select count(*)::int from public.pagamentos where stripe_invoice_id = 'in_1'), 1, 'um pagamento por invoice');
select is((select count(*)::int from public.pagamentos_itens), 1, 'itens nao duplicam');
select throws_ok($$select tt.wh(tt.ev('evt_i2', 'invoice.paid', 6100, jsonb_build_object('id', 'in_2', 'customer', 'cus_x', 'currency', 'eur', 'amount_paid', 1)))$$,
                 'P0001', null, 'invoice de customer sem vinculo: erro (o Stripe reenvia)');
reset role;

-- 5) estornos ------------------------------------------------------------------------------------------
select is(tt.wh(tt.ev('evt_r1', 'charge.refunded', 7000, jsonb_build_object('id', 'ch_1', 'invoice', 'in_1', 'currency', 'eur', 'amount_refunded', 615))),
          'processado', 'reembolso parcial gravado');
reset role;
select is(tt.wh(tt.ev('evt_r2', 'charge.refunded', 7100, jsonb_build_object('id', 'ch_1', 'invoice', 'in_1', 'currency', 'eur', 'amount_refunded', 1230))),
          'processado', 'segundo reembolso grava so o delta');
reset role;
select is(tt.wh(tt.ev('evt_r0', 'charge.refunded', 6900, jsonb_build_object('id', 'ch_1', 'invoice', 'in_1', 'currency', 'eur', 'amount_refunded', 615))),
          'ignorado_antigo', 'evento antigo fora de ordem nao duplica estorno');
reset role;
select is((select sum(valor_centavos)::int || '/' || sum(vat_centavos)::int from public.reembolsos), '1230/230',
          'soma dos estornos = bruto; VAT proporcional');
select throws_ok($$select tt.wh(tt.ev('evt_r9', 'charge.refunded', 7200, jsonb_build_object('id', 'ch_9', 'invoice', 'in_nao', 'currency', 'eur', 'amount_refunded', 1)))$$,
                 'P0001', null, 'estorno sem pagamento: erro visivel');
reset role;
select is(tt.wh(tt.ev('evt_d1', 'charge.dispute.closed', 7300, jsonb_build_object('id', 'dp_1', 'payment_intent', 'pi_x', 'status', 'won', 'currency', 'eur', 'amount', 1))),
          'ignorado_tipo', 'disputa ganha nao vira estorno');
reset role;

-- 6) leitura de pagamentos e reembolsos -----------------------------------------------------------------
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.pagamentos'), 1, 'dono le o proprio pagamento');
select is(tt.n('select 1 from public.pagamentos_itens'), 1, 'dono le os itens do proprio pagamento');
select is(tt.n('select 1 from public.reembolsos'), 0, 'dono nao le reembolsos (financeiro)');
select throws_ok($$insert into public.pagamentos (conta_stripe_id, stripe_invoice_id, cliente_email, moeda, bruto_centavos, pago_em) values (1, 'x', 'x', 'EUR', 1, now())$$,
                 '42501', null, 'membro nao grava pagamento');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n('select 1 from public.pagamentos'), 0, 'outro membro nao le');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select is(tt.n('select 1 from public.reembolsos'), 2, 'auditor le reembolsos');
select throws_ok($$insert into public.cambio_bce (data, moeda, taxa, fonte_url) values ('2026-01-09', 'BRL', 6, 'https://x')$$,
                 '42501', null, 'auditor so le: nao lanca cambio');
reset role;
select tt.como(tt.u('a0'), 'aal1');
select is(tt.n('select 1 from public.pagamentos'), 0, 'auditor sem aal2 nao le');
reset role;

-- 7) receitas_externas, estorno manual, cambio -----------------------------------------------------------
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path)
  values (current_date, 'pix', 'assinatura', 'Cliente', 'BRL', 10000, '2026/x.pdf')$$, '42501', null, 'super_admin sem aal2 nao lanca receita');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, cliente_email, moeda, bruto_centavos, comprovante_path)
  values (current_date, 'pix', 'assinatura', 'Cliente', 'cli@x.test', 'BRL', 10000, '2026/x.pdf')$$, 'super_admin aal2 lanca receita externa');
select throws_ok($$delete from public.receitas_externas$$, '42501', null, 'receita externa nao se apaga');
select throws_ok($$update public.receitas_externas set bruto_centavos = 1$$, '42501', null, 'valor nao se altera (so anulacao)');
select lives_ok($$insert into public.reembolsos (tipo, receita_externa_id, moeda, valor_centavos, devolvido_em)
  select 'reembolso', id, 'BRL', 4000, now() from public.receitas_externas$$, 'super_admin estorna receita externa');
select throws_ok($$insert into public.reembolsos (tipo, receita_externa_id, moeda, valor_centavos, devolvido_em)
  select 'reembolso', id, 'BRL', 7000, now() from public.receitas_externas$$, 'P0001', 'estorno_maior_que_pagamento', 'estorno acima do bruto barrado');
select throws_ok($$insert into public.reembolsos (tipo, receita_externa_id, moeda, valor_centavos, devolvido_em)
  select 'reembolso', id, 'EUR', 1, now() from public.receitas_externas$$, 'P0001', 'moeda_divergente', 'moeda do estorno = moeda da receita');
select throws_ok($$insert into public.reembolsos (tipo, pagamento_id, moeda, valor_centavos, devolvido_em)
  select 'reembolso', id, 'EUR', 1, now() from public.pagamentos$$, '42501', null, 'estorno de pagamento Stripe so pelo webhook');
select throws_ok($$update public.receitas_externas set motivo_anulacao = null$$, 'P0001', 'motivo_obrigatorio', 'anular exige motivo');
select is(tt.afeta($q$update public.receitas_externas set motivo_anulacao = 'lancado em duplicidade'$q$), 1, 'anula com motivo');
select throws_ok($$update public.receitas_externas set motivo_anulacao = 'de novo'$$, 'P0001', 'ja_anulado', 'nao anula duas vezes');
select lives_ok($$insert into public.cambio_bce (data, moeda, taxa, fonte_url) values ('2026-01-09', 'BRL', 6.1, 'https://www.ecb.europa.eu/teste')$$,
                'super_admin informa taxa do BCE');
select throws_ok($$insert into public.cambio_bce (data, moeda, taxa, fonte_url) values ('2026-01-09', 'EUR', 1, 'https://x')$$,
                 '23514', null, 'EUR nao entra em cambio_bce');
reset role;
select ok((select anulado_por = tt.u('51') and anulado_em is not null and lancado_por = tt.u('51') from public.receitas_externas),
          'lancado_por e anulado_por vem da sessao');
select is(private.cambio_em('BRL', '2026-01-11'), 6.1::numeric, 'cambio do dia 11 sem cotacao usa a ultima anterior');
select is(private.cambio_em('EUR', '2026-01-11'), 1::numeric, 'EUR vale 1');
select tt.anonimo();
select throws_ok($$select 1 from public.cambio_bce$$, '42501', null, 'anon nao le cambio');
reset role;

-- 8) job do payload -------------------------------------------------------------------------------------
update public.eventos_stripe set payload = '{"x":1}', criado_em = now() - interval '91 days' where event_id = 'evt_s1';
update public.eventos_stripe set payload = '{"x":1}' where event_id = 'evt_i1';
select is(private.limpar_payload_stripe(), 1, 'job zera so payload com mais de 90 dias');
select is((select count(*)::int from public.eventos_stripe where payload is not null), 1, 'payload recente fica');
select is((select count(*)::int from cron.job where jobname = 'limpa-payload-stripe'), 1, 'job do payload agendado no pg_cron');

select * from finish();
rollback;

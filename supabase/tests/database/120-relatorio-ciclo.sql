-- Relatorio do Ciclo (f1_22): ciclo_de, clientes_ativos, relatorio_ciclo, fechar/reabrir/marcar enviado e
-- conceder_acesso_manual. Ciclo de teste: 10/09/2026 a 09/10/2026 (ja terminado). Valores ficticios.
begin;
select plan(45);

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

-- b2: assinatura ativa no ultimo instante do Ciclo (historico ajustado para antes do fim)
update public.assinaturas_status s set desde = '2026-09-01T00:00:00Z'
from public.assinaturas a where a.id = s.assinatura_id and a.stripe_subscription_id = 'sub_b2';
insert into public.pagamentos (conta_stripe_id, stripe_invoice_id, perfil_id, cliente_email, moeda, bruto_centavos, vat_centavos, pago_em)
values (tt.conta(), 'in_c1', tt.u('c1'), 'c1@t.test', 'EUR', 1230, 230, '2026-09-15T12:00:00Z'),
       (tt.conta(), 'in_x', null, 'X@x.test', 'EUR', 500, 0, '2026-09-16T12:00:00Z');
insert into public.reembolsos (conta_stripe_id, stripe_id, tipo, pagamento_id, moeda, valor_centavos, devolvido_em)
select tt.conta(), 're_x', 'reembolso', id, 'EUR', 500, '2026-09-20T12:00:00Z' from public.pagamentos where stripe_invoice_id = 'in_x';
insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, cliente_email, moeda, bruto_centavos, comprovante_path, lancado_por)
values ('2026-09-12', 'pix', 'ingresso', 'Cliente externo', 'Ext@x.test', 'BRL', 6100, '2026/a.pdf', tt.u('51'));
insert into public.cambio_bce (data, moeda, taxa, fonte_url) values ('2026-10-08', 'BRL', 6.1, 'https://www.ecb.europa.eu/teste');

-- 1) ciclo_de: dia 10 a dia 9 em Europe/Dublin (IST = UTC+1 em outubro) ------------------------------------
select is(public.ciclo_de('2026-10-09T23:30:00Z'), daterange('2026-10-10', '2026-11-10'), '23:30 UTC do dia 9 ja e dia 10 em Dublin');
select is(public.ciclo_de('2026-10-09T22:30:00Z'), daterange('2026-09-10', '2026-10-10'), '22:30 UTC do dia 9 ainda e o Ciclo anterior');
select is(public.ciclo_de('2026-01-05T12:00:00Z'), daterange('2025-12-10', '2026-01-10'), 'antes do dia 10 vira o Ciclo do mes anterior');

-- 2) permissoes ------------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
select throws_ok($$select public.relatorio_ciclo('2026-09-10')$$, '42501', null, 'membro nao ve o relatorio');
select throws_ok($$select * from public.clientes_ativos('2026-09-10')$$, '42501', null, 'membro nao ve clientes ativos');
reset role;
select tt.como(tt.u('a0'), 'aal1');
select throws_ok($$select public.relatorio_ciclo('2026-09-10')$$, '42501', null, 'auditor sem aal2 nao ve');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$select public.relatorio_ciclo('2026-09-10')$$, '42501', null, 'editor nao ve');
reset role;
select tt.anonimo();
select throws_ok($$select public.relatorio_ciclo('2026-09-10')$$, '42501', null, 'anon nao ve');
reset role;

-- 3) numeros ---------------------------------------------------------------------------------------------
select tt.como(tt.u('a0'), 'aal2');
select set_config('tt.r', public.relatorio_ciclo('2026-09-10')::text, true);
select throws_ok($$select public.relatorio_ciclo('2026-09-11')$$, 'P0001', null, 'Ciclo comeca no dia 10');
select is((select count(*)::int from public.clientes_ativos('2026-09-10')), 3, 'auditor ve clientes ativos');
reset role;
create function tt.r(p text) returns text language sql as $$ select current_setting('tt.r')::jsonb #>> string_to_array(p, ',') $$;
select is(tt.r('receita,stripe'), '1730', 'receita Stripe (EUR)');
select is(tt.r('receita,externa'), '1000', 'receita externa convertida pela taxa do dia 9 (BRL 6100 / 6.1)');
select is(tt.r('deducoes,vat'), '230', 'VAT deduzido');
select is(tt.r('deducoes,estornos'), '500', 'estornos deduzidos');
select is(tt.r('receita_base'), '2000', 'receita base = bruta - VAT - (estornos - VAT dos estornos)');
select is(tt.r('clientes_ativos,quantidade'), '3', 'clientes ativos: assinatura ativa no fim + pagante + receita externa');
select ok(current_setting('tt.r') like '%"chave": "ext@x.test"%' and current_setting('tt.r') not like '%x@x.test%',
          'estornado por inteiro no Ciclo nao conta; e-mail em minusculas');
select is(tt.r('cambio,taxas,0,data'), '2026-10-08', 'cambio: ultima taxa antes do dia 9, com data');
select is(tt.r('faixa,faixa'), '1', 'faixa pela contagem (provisoria)');
select is(tt.r('faixa,percentual'), null, 'percentual nao inventado');
select is(tt.r('ciclo,estado'), 'rascunho', 'estado rascunho antes de fechar');
select is(jsonb_array_length(current_setting('tt.r')::jsonb -> 'linhas'), 4, 'linhas: 2 pagamentos, 1 externa, 1 estorno');

-- 4) fechar, travar, reabrir, nova versao -----------------------------------------------------------------
select tt.como(tt.u('a0'), 'aal2');
select throws_ok($$select public.fechar_ciclo('2026-09-10')$$, '42501', null, 'auditor nao fecha');
reset role;
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$select public.fechar_ciclo('2026-09-10')$$, '42501', null, 'super_admin sem aal2 nao fecha');
reset role;
select tt.como(tt.u('51'), 'aal2');
select throws_ok($$select public.fechar_ciclo('2026-10-10')$$, 'P0001', 'ciclo_em_andamento', 'Ciclo em andamento nao fecha');
select is((select versao from public.fechar_ciclo('2026-09-10')), 1, 'fecha na versao 1');
select throws_ok($$select public.fechar_ciclo('2026-09-10')$$, 'P0001', 'ciclo_ja_fechado', 'nao fecha duas vezes');
select throws_ok($$insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path)
  values ('2026-09-20', 'pix', 'ingresso', 'Atrasado', 'EUR', 100, '2026/b.pdf')$$, 'P0001', 'ciclo_fechado', 'Ciclo fechado nao recebe lancamento');
select throws_ok($$select public.reabrir_ciclo('2026-09-10', '')$$, 'P0001', 'motivo_obrigatorio', 'reabrir exige motivo');
select lives_ok($$select public.reabrir_ciclo('2026-09-10', 'faltou um Pix de evento')$$, 'super_admin reabre com motivo');
select lives_ok($$insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path)
  values ('2026-09-20', 'pix', 'ingresso', 'Atrasado', 'EUR', 100, '2026/b.pdf')$$, 'reaberto aceita o lancamento');
select is((select versao from public.fechar_ciclo('2026-09-10')), 2, 'fecha de novo na versao 2');
select lives_ok($$select public.marcar_relatorio_enviado('2026-09-10', 2)$$, 'marca enviado');
select throws_ok($$select public.marcar_relatorio_enviado('2026-09-10', 2)$$, 'P0002', null, 'enviado so uma vez');
reset role;
select is((select motivo_reemissao from public.relatorios_ciclo where versao = 2), 'faltou um Pix de evento', 'versao 2 guarda o motivo');
select is((select (dados->>'receita_base') from public.relatorios_ciclo where versao = 2), '2100', 'versao 2 inclui o lancamento novo');
select is((select (dados->>'receita_base') from public.relatorios_ciclo where versao = 1), '2000', 'versao 1 congelada');
select ok((select csv_sha256 = encode(sha256(convert_to(dados->>'csv', 'UTF8')), 'hex') from public.relatorios_ciclo where versao = 2),
          'sha256 confere com o csv guardado');
select ok((select count(*) from public.log_admin where tabela = 'relatorios_ciclo') >= 3, 'fechar e reabrir ficam no log');
select tt.como(tt.u('a0'), 'aal2');
select is(tt.n('select 1 from public.relatorios_ciclo'), 2, 'auditor le as versoes');
select throws_ok($$update public.relatorios_ciclo set dados = '{}'$$, '42501', null, 'ninguem altera relatorio direto');
reset role;

-- 5) acesso manual ---------------------------------------------------------------------------------------
insert into public.receitas_externas (recebido_em, origem, tipo_receita, plano_id, perfil_id, cliente_nome, moeda, bruto_centavos, comprovante_path, lancado_por)
values (current_date, 'transferencia', 'assinatura', tt.plano('price_t_clube'), tt.u('f1'), 'F1', 'EUR', 100, '2026/c.pdf', tt.u('51'));
select set_config('tt.rec', (select id::text from public.receitas_externas where perfil_id = tt.u('f1')), true);
select tt.como(tt.u('a0'), 'aal2');
select throws_ok($$select public.conceder_acesso_manual(tt.u('f1'), tt.plano('price_t_clube'), current_setting('tt.rec')::bigint, now() + interval '30 days')$$,
                 '42501', null, 'auditor nao concede acesso');
reset role;
select tt.como(tt.u('51'), 'aal2');
select throws_ok($$select public.conceder_acesso_manual(tt.u('b1'), tt.plano('price_t_clube'), current_setting('tt.rec')::bigint, now() + interval '30 days')$$,
                 'P0001', 'receita_invalida', 'receita de outra pessoa nao serve');
select ok(public.conceder_acesso_manual(tt.u('f1'), tt.plano('price_t_clube'), current_setting('tt.rec')::bigint, now() + interval '30 days') > 0,
          'super_admin concede acesso manual');
reset role;
select tt.como(tt.u('f1'));
select is(public.tem_acesso('clube'), true, 'acesso manual vale para tem_acesso');
reset role;

select * from finish();
rollback;

-- Assinaturas da F1: RLS de planos/clientes_stripe/assinaturas/eventos_stripe/contas_stripe e
-- tem_acesso/pode_ver_conteudo. Transacao desfeita; papel e aal simulados com set_config.
-- Todos os dados abaixo sao de teste (valores ficticios, nada vem de migration).
begin;
select plan(54);

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
create function tt.afeta(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function tt.n(q text) returns int language plpgsql as $$
declare n int;
begin execute 'select count(*)::int from (' || q || ') x' into n; return n; end $$;

-- c2=clube ativo em plano desativado (grandfathering), ed=editor, a=clube ativo, b=grupo, c=cancelado, d=past_due, e=clube vencido, f=sem assinatura, s=super_admin (equipe, sem plano), u=auditor
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || id)::uuid, id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('c1'), ('d1'), ('e1'), ('f1'), ('51'), ('a2'), ('ed'), ('c2')) v(id);
insert into public.equipe (perfil_id, papel) values
  ('00000000-0000-0000-0000-000000000051', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'auditor'),
  ('00000000-0000-0000-0000-0000000000ed', 'editor');

insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda, ativo)
select c.id, v.p, v.n, v.nv::public.nivel_acesso, 'mes', 'assinatura', 1, 'EUR', v.at
from public.contas_stripe c, (values
  ('price_t_clube', 'Clube teste', 'clube', true),
  ('price_t_grupo', 'Grupo teste', 'grupo', true),
  ('price_t_velho', 'Plano inativo', 'clube', false)) v(p, n, nv, at);

-- ids de perfis: sufixo hex a1,b1... (uuid valido)
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
create function tt.assina(s text, price text, st public.status_assinatura, fim interval, sub text) returns void
language sql as $$
  insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
  select tt.u(s), p.conta_stripe_id, sub, p.id, st, now() - interval '10 days', now() + fim
  from public.planos p where p.stripe_price_id = price $$;
select tt.assina('a1', 'price_t_clube', 'active', interval '10 days', 'sub_a');
select tt.assina('b1', 'price_t_grupo', 'active', interval '10 days', 'sub_b');
select tt.assina('c1', 'price_t_grupo', 'canceled', interval '10 days', 'sub_c');
select tt.assina('d1', 'price_t_clube', 'past_due', interval '10 days', 'sub_d');
select tt.assina('e1', 'price_t_clube', 'active', interval '-1 day', 'sub_e');
select tt.assina('c2', 'price_t_velho', 'active', interval '10 days', 'sub_g');
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
select c.id, 'cus_' || s, tt.u(s), s || '@t.test' from public.contas_stripe c, (values ('a1'), ('b1')) v(s);
insert into public.eventos_stripe (conta_stripe_id, event_id, tipo, criado_stripe_em)
select id, 'evt_1', 'invoice.paid', now() from public.contas_stripe;

-- 1) estrutura ---------------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class
            where oid in ('public.planos'::regclass, 'public.clientes_stripe'::regclass, 'public.assinaturas'::regclass,
                          'public.eventos_stripe'::regclass, 'public.contas_stripe'::regclass)),
          'RLS ligado nas 5 tabelas novas');
select is((select count(*)::int from public.planos where stripe_price_id not like 'price\_t\_%'), 0,
          'planos nasce vazio: nenhum plano vem de migration');
select ok(not has_function_privilege('anon', 'private.nivel_atual(uuid)', 'execute'), 'anon sem execute em nivel_atual');
select ok(not has_function_privilege('authenticated', 'private.nivel_atual(uuid)', 'execute'), 'authenticated sem execute em nivel_atual');
select ok(has_function_privilege('anon', 'public.tem_acesso(public.nivel_acesso)', 'execute'), 'anon executa tem_acesso');
select ok(has_function_privilege('anon', 'public.pode_ver_conteudo(public.nivel_acesso)', 'execute'), 'anon executa pode_ver_conteudo');
select ok(not has_table_privilege('authenticated', 'public.assinaturas', 'insert')
      and not has_table_privilege('authenticated', 'public.assinaturas', 'update')
      and not has_table_privilege('authenticated', 'public.eventos_stripe', 'insert')
      and not has_table_privilege('authenticated', 'public.clientes_stripe', 'update'),
          'usuarios sem grant de escrita em assinaturas, eventos e clientes');
select throws_ok($$insert into public.assinaturas (plano_id, conta_stripe_id, status, origem, periodo_inicio, periodo_fim)
  select p.id, c.id, 'active', 'stripe', now(), now() from public.planos p, public.contas_stripe c limit 1$$, '23514', null, 'origem stripe exige subscription id');
select throws_ok($$insert into public.assinaturas (stripe_subscription_id, plano_id, status, origem, periodo_inicio, periodo_fim)
  select 'sub_orfa', id, 'active', 'stripe', now(), now() from public.planos limit 1$$, '23514', null, 'origem stripe exige conta_stripe_id');
select throws_ok($$insert into public.assinaturas (plano_id, status, origem, periodo_inicio, periodo_fim)
  select id, 'active', 'manual', now(), now() from public.planos limit 1$$, '23514', null, 'origem manual exige receita externa');
select throws_ok($$insert into public.planos (conta_stripe_id, stripe_price_id, nome, intervalo, tipo_receita, valor_centavos, moeda)
  select id, 'price_t_clube', 'dup', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe$$, '23505', null, 'stripe_price_id e unico');

-- 2) anon ---------------------------------------------------------------------------------------
select tt.anonimo();
select is((select tt.n('select 1 from public.planos')), 2, 'anon ve so os planos ativos (pagina de precos)');
select throws_ok($$select 1 from public.assinaturas$$, '42501', null, 'anon nao le assinaturas');
select throws_ok($$select 1 from public.clientes_stripe$$, '42501', null, 'anon nao le clientes_stripe');
select throws_ok($$select 1 from public.eventos_stripe$$, '42501', null, 'anon nao le eventos_stripe');
select throws_ok($$select 1 from public.contas_stripe$$, '42501', null, 'anon nao le contas_stripe');
select throws_ok($$insert into public.planos (conta_stripe_id, stripe_price_id, nome, intervalo, tipo_receita, valor_centavos, moeda)
  values (1, 'x', 'x', 'mes', 'assinatura', 1, 'EUR')$$, '42501', null, 'anon nao escreve em planos');
select is((select public.tem_acesso('visitante')), true, 'visitante tem acesso de visitante');
select is((select public.tem_acesso('clube')), false, 'sem sessao nao tem acesso de clube');
select is((select public.pode_ver_conteudo('clube')), false, 'sem sessao nao ve conteudo de clube');
reset role;

-- 3) dono --------------------------------------------------------------------------------------
select set_config('tt.conta', (select id::text from public.contas_stripe), false);
select tt.como(tt.u('a1'));
select is((select tt.n('select 1 from public.assinaturas')), 1, 'dono le so a propria assinatura');
select is((select stripe_subscription_id from public.assinaturas), 'sub_a', 'e a assinatura dele, nao a alheia');
select is((select tt.n('select 1 from public.clientes_stripe')), 1, 'dono le so o proprio cliente_stripe');
select is((select tt.n('select 1 from public.eventos_stripe')), 0, 'dono nao ve eventos_stripe');
select throws_ok($$update public.assinaturas set status = 'canceled'$$, '42501', null, 'dono nao altera assinatura');
select is((select tt.n('select 1 from public.planos')), 2, 'membro ve so planos ativos');
select is((select tt.n('select 1 from public.contas_stripe')), 0, 'membro nao le contas_stripe');
select throws_ok($$insert into public.planos (conta_stripe_id, stripe_price_id, nome, intervalo, tipo_receita, valor_centavos, moeda)
  values (current_setting('tt.conta')::bigint, 'price_t_hack', 'hack', 'mes', 'assinatura', 1, 'EUR')$$, '42501', null, 'membro nao insere plano (RLS)');
select is((select tt.afeta($q$update public.planos set valor_centavos = 0$q$)), 0, 'membro nao altera plano (0 linhas)');
select is((select tt.afeta($q$delete from public.planos$q$)), 0, 'membro nao apaga plano (0 linhas)');
reset role;
-- grandfathering: plano desativado continua legivel para quem tem assinatura nele
select tt.como(tt.u('c2'));
select is((select tt.n($q$select 1 from public.planos where stripe_price_id = 'price_t_velho'$q$)), 1,
          'membro le o proprio plano desativado (grandfathering)');
reset role;
select tt.como(tt.u('a1'));
select is((select tt.n($q$select 1 from public.planos where stripe_price_id = 'price_t_velho'$q$)), 0,
          'membro sem assinatura nele nao le plano desativado');
reset role;

-- 4) tem_acesso por situacao (PRD: sem sessao = visitante; past_due mantem; cancelado/vencido perde) -----
select tt.como(tt.u('a1'));
select is((select public.tem_acesso('clube')), true, 'clube ativo tem acesso clube');
select is((select public.tem_acesso('grupo')), false, 'clube ativo nao tem acesso grupo');
select is((select public.pode_ver_conteudo('clube')), true, 'membro pagante ve conteudo de clube');
reset role;
select tt.como(tt.u('b1'));
select is((select public.tem_acesso('grupo')), true, 'grupo ativo tem acesso grupo');
reset role;
select tt.como(tt.u('c1'));
select is((select public.tem_acesso('clube')), false, 'cancelado perde acesso');
reset role;
select tt.como(tt.u('d1'));
select is((select public.tem_acesso('clube')), true, 'past_due mantem acesso (retentativas do Stripe)');
reset role;
select tt.como(tt.u('e1'));
select is((select public.tem_acesso('clube')), false, 'periodo_fim vencido perde acesso mesmo com status active');
reset role;
select tt.como(tt.u('f1'));
select is((select public.tem_acesso('clube')), false, 'logado sem assinatura nao tem acesso');
select is((select public.pode_ver_conteudo('clube')), false, 'logado sem assinatura nao ve conteudo de clube');
reset role;

-- 5) equipe nao ganha acesso pago por papel; ve conteudo; financeiro le -------------------------------
select tt.como(tt.u('51'), 'aal2');
select is((select public.tem_acesso('clube')), false, 'super_admin sem assinatura nao tem acesso pago');
select is((select public.pode_ver_conteudo('grupo')), true, 'equipe aal2 ve conteudo');
select ok((select tt.n('select 1 from public.assinaturas') >= 5 and tt.n('select 1 from public.contas_stripe') = 1),
          'super_admin le assinaturas e contas_stripe');
reset role;
select tt.como(tt.u('51'), 'aal1');
select is((select public.pode_ver_conteudo('grupo')), false, 'equipe sem 2FA nao ve conteudo pago');
reset role;

-- editor (equipe fora do financeiro): sem policy, leitura devolve 0 linhas
select tt.como(tt.u('ed'), 'aal2');
select is((select tt.n('select 1 from public.assinaturas')), 0, 'editor nao le assinaturas');
select is((select tt.n('select 1 from public.contas_stripe')), 0, 'editor nao le contas_stripe');
select is((select tt.n('select 1 from public.eventos_stripe')), 0, 'editor nao le eventos_stripe');
reset role;

-- 6) eventos_stripe: so super_admin (aal2) ----------------------------------------------------------
select tt.como(tt.u('a2'), 'aal2');
select is((select tt.n('select 1 from public.eventos_stripe')), 0, 'auditor nao ve eventos_stripe');
select ok((select tt.n('select 1 from public.assinaturas') >= 5), 'auditor le assinaturas (financeiro)');
select is((select tt.afeta($q$update public.planos set valor_centavos = 0$q$)), 0, 'auditor nao altera plano (0 linhas)');
select is((select tt.afeta($q$delete from public.planos$q$)), 0, 'auditor nao apaga plano (0 linhas)');
reset role;
select tt.como(tt.u('51'), 'aal1');
select is((select tt.n('select 1 from public.eventos_stripe')), 0, 'super_admin sem 2FA nao ve eventos_stripe');
reset role;
select tt.como(tt.u('51'), 'aal2');
select is((select tt.n('select 1 from public.eventos_stripe')), 1, 'super_admin com 2FA ve eventos_stripe');
reset role;

select * from finish();
rollback;

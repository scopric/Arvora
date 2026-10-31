-- 2FA restritivo e log da equipe (f1_18): setores, documentos_legais, consentimentos, pedidos_gdpr, log_admin.
-- Transacao desfeita; dados de teste.
begin;
select plan(40);

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

-- 1) setores: 2FA restritivo (pendencia antiga) e log ------------------------------------------------
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$insert into public.setores (nome, slug) values ('X', 'x-teste')$$, '42501', null,
                 'super_admin sem aal2 nao insere setor');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$insert into public.setores (nome, slug) values ('X', 'x-teste')$$, 'super_admin aal2 insere setor');
reset role;
select is((select count(*)::int from public.log_admin where tabela = 'setores' and acao = 'insert' and ator_id = tt.u('51')),
          1, 'insert da equipe vai para log_admin');
select tt.como(tt.u('b1'));
select is(tt.afeta($q$update public.setores set nome = 'Y' where slug = 'x-teste'$q$), 0, 'membro nao altera setor');
reset role;
select is((select count(*)::int from public.log_admin where ator_id = tt.u('b1')), 0, 'escrita de membro nao vai para o log');

-- 2) log_admin: quem le --------------------------------------------------------------------------------
select tt.como(tt.u('51'), 'aal2');
select ok(tt.n('select 1 from public.log_admin') >= 1, 'super_admin aal2 le o log');
reset role;
select tt.como(tt.u('51'), 'aal1');
select is(tt.n('select 1 from public.log_admin'), 0, 'super_admin sem aal2 nao le o log');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select is(tt.n($q$select 1 from public.log_admin where tabela = 'setores'$q$), 0, 'auditor nao le log de setores');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.log_admin'), 0, 'membro nao le o log');
select throws_ok($$insert into public.log_admin (ator_id, acao, tabela) values (gen_random_uuid(), 'rpc', 'x')$$, '42501', null,
                 'ninguem insere no log direto');
reset role;
select tt.anonimo();
select throws_ok($$select 1 from public.log_admin$$, '42501', null, 'anon nao le o log');
reset role;

-- 3) documentos_legais ---------------------------------------------------------------------------------
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('termos', 'v1', 'pt', 'T', 'x')$$,
                 '42501', null, 'super_admin sem aal2 nao publica documento');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('termos', 'v1', 'pt', 'T', 'x')$$,
                 '42501', null, 'editor nao publica documento');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values
  ('termos', 'v1', 'pt', 'Termos (teste)', 'texto de teste'), ('match', 'v1', 'pt', 'Match (teste)', 'opt-in de teste'),
  ('hall_of_fame', 'v1', 'pt', 'HoF (teste)', 'autorizo (teste)')$$, 'super_admin aal2 publica documentos');
select throws_ok($$update public.documentos_legais set conteudo_md = 'y'$$, '42501', null, 'documento nao tem update (versao nova = linha nova)');
reset role;
select is((select sha256 from public.documentos_legais where tipo = 'termos'),
          encode(sha256(convert_to('texto de teste', 'UTF8')), 'hex'), 'sha256 calculado pelo banco');
select is((select publicado_por from public.documentos_legais where tipo = 'termos'), tt.u('51'), 'publicado_por = quem publicou');
select tt.anonimo();
select is(tt.n('select 1 from public.documentos_legais'), 3, 'anon le documentos');
reset role;

-- 4) consentimentos ------------------------------------------------------------------------------------
create function tt.doc(t text) returns bigint language sql as $$ select id from public.documentos_legais where tipo = t::public.tipo_documento $$;
select set_config('tt.doc', tt.doc('termos')::text, true);
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.consentimentos (documento_id, perfil_id, titular_email, aceito_em, evidencia)
  values (current_setting('tt.doc')::bigint, tt.u('b1'), 'falso@x.test', now() - interval '1 year', 'checkbox')$$,
  'membro registra o proprio aceite');
reset role;
select is((select titular_email from public.consentimentos where perfil_id = tt.u('b1')), 'b1@t.test', 'e-mail vem do auth.users, nao da tela');
select ok((select aceito_em > now() - interval '1 minute' from public.consentimentos where perfil_id = tt.u('b1')), 'membro nao data aceite no passado');
select tt.como(tt.u('b1'));
select throws_ok($$insert into public.consentimentos (documento_id, perfil_id, titular_email) values (current_setting('tt.doc')::bigint, tt.u('b2'), 'x@x.test')$$,
                 '42501', null, 'membro nao registra aceite de outro');
select is(tt.n('select 1 from public.consentimentos'), 1, 'membro le so os proprios');
select is(tt.afeta($q$update public.consentimentos set revogado_em = now()$q$), 1, 'membro revoga o proprio');
select throws_ok($$update public.consentimentos set revogado_em = now()$$, 'P0001', 'ja_revogado', 'revogacao e definitiva');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n('select 1 from public.consentimentos'), 0, 'outro membro nao ve');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$insert into public.consentimentos (documento_id, titular_email, titular_nome, aceito_em, evidencia)
  values (current_setting('tt.doc')::bigint, 'premiado@x.test', 'Premiado', '2025-05-01', 'formulario assinado')$$,
  'super_admin registra consentimento de premiado sem conta (com data real)');
select is(tt.n('select 1 from public.consentimentos'), 2, 'super_admin le todos');
reset role;
select is((select aceito_em::date from public.consentimentos where titular_email = 'premiado@x.test'), '2025-05-01'::date,
          'data do formulario preservada');
select tt.como(tt.u('51'), 'aal1');
select is(tt.n('select 1 from public.consentimentos'), 0, 'super_admin sem aal2 so ve os proprios (nenhum)');
reset role;
select tt.anonimo();
select throws_ok($$select 1 from public.consentimentos$$, '42501', null, 'anon nao le consentimentos');
reset role;

-- 5) pedidos_gdpr --------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.pedidos_gdpr (perfil_id, tipo) values (tt.u('b1'), 'exclusao')$$, 'membro abre pedido');
select throws_ok($$insert into public.pedidos_gdpr (perfil_id, tipo) values (tt.u('b1'), 'exclusao')$$, '23505', null,
                 'um pedido aberto por tipo');
select throws_ok($$insert into public.pedidos_gdpr (perfil_id, tipo) values (tt.u('b2'), 'exportacao')$$, '42501', null,
                 'membro nao abre pedido por outro');
select is(tt.afeta($q$update public.pedidos_gdpr set status = 'concluido'$q$), 0, 'membro nao muda status');
reset role;
select is((select prazo_em from public.pedidos_gdpr where perfil_id = tt.u('b1')),
          ((now() at time zone 'Europe/Dublin')::date + interval '1 month')::date, 'prazo = recebimento + 1 mes');
select is((select email from public.pedidos_gdpr where perfil_id = tt.u('b1')), 'b1@t.test', 'e-mail do titular gravado');
select tt.como(tt.u('51'), 'aal1');
select is(tt.afeta($q$update public.pedidos_gdpr set status = 'concluido'$q$), 0, 'super_admin sem aal2 nao atende');
reset role;
select tt.como(tt.u('51'), 'aal2');
select is(tt.afeta($q$update public.pedidos_gdpr set status = 'concluido', observacao = 'feito'$q$), 1, 'super_admin aal2 atende');
reset role;
select ok((select concluido_em is not null and atendido_por = tt.u('51') from public.pedidos_gdpr), 'conclusao carimbada');

select * from finish();
rollback;

-- Rede (f4_01): perfis_vitrine, perfis_contato, categorias_rede, network_itens, conexoes (transicoes e limite),
-- revelar_contato, buscar_membros e o Match semanal. Transacao desfeita.
begin;
select plan(42);

-- O seed de desenvolvimento (supabase/seed.sql) nao entra no teste: apagado aqui, dentro da transacao desfeita no fim.
truncate public.verticais, public.edicoes, public.temas, public.categorias_rede, public.espacos, public.empresas,
  public.documentos_legais, public.planos cascade;
delete from auth.users where email like '%@exemplo.invalid';
delete from public.contas_stripe where stripe_account_id = 'acct_exemplo_local';

create schema tt;
grant usage on schema tt to public;
alter default privileges in schema tt grant execute on functions to public; -- a f4_09 tirou o EXECUTE padrao de PUBLIC
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

insert into public.categorias_rede (nome, slug) values ('Contabilidade', 'contabilidade'), ('Investidores', 'investidores');
create function tt.cr(s text) returns bigint language sql as $$ select id from public.categorias_rede where slug = s $$;
update public.perfis set cidade = 'Dublin', setor_id = (select min(id) from public.setores) where id in (tt.u('b1'), tt.u('b2'));
insert into public.perfis_contato (perfil_id, email_contato, whatsapp) values (tt.u('b2'), 'contato.b2@x.test', '+353123456789');

-- 1) vitrine e network_itens ------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.perfis_vitrine where id <> auth.uid()'), 2, 'clube ve pela vitrine so membros ativos (f4_05)');
select throws_ok($$select maior_18_em from public.perfis_vitrine$$, '42703', null, 'vitrine nao tem colunas internas');
select throws_ok($$insert into public.network_itens (tipo, categoria_id) values ('oferece', tt.cr('contabilidade'))$$, '42501', null,
                 'clube nao declara procura/oferece');
select throws_ok($$select * from public.buscar_membros()$$, '42501', 'sem_acesso', 'clube nao busca');
select throws_ok($$insert into public.conexoes (destinatario_id, origem) values (tt.u('b1'), 'busca')$$, '42501', null, 'clube nao pede conexao');
reset role;
select tt.anonimo();
select is(tt.n('select 1 from public.perfis_vitrine'), 0, 'anon nao ve perfis so de membros');
select throws_ok($$select 1 from public.network_itens$$, '42501', null, 'anon nao le network');
reset role;
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.network_itens (tipo, categoria_id, texto) values ('procura', tt.cr('contabilidade'), 'contador em Dublin')$$,
                'grupo declara o que procura');
reset role;
select tt.como(tt.u('b2'));
select lives_ok($$insert into public.network_itens (tipo, categoria_id) values ('oferece', tt.cr('contabilidade'))$$, 'grupo declara o que oferece');
select is(tt.n('select 1 from public.network_itens'), 2, 'grupo le network dos membros');
select is((select count(*)::int from public.buscar_membros(filtro_categoria => tt.cr('contabilidade'), filtro_tipo => 'procura')), 1,
          'busca por quem procura contabilidade acha b1');
select is((select count(*)::int from public.buscar_membros(filtro_cidade => 'dublin')), 1, 'busca por cidade (sem o proprio)');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select throws_ok($$select * from public.buscar_membros()$$, '42501', 'sem_acesso', 'papel de equipe nao abre a busca');
select is(tt.n('select 1 from public.network_itens'), 2, 'moderador le network para moderar');
reset role;

-- 2) conexoes e contato ------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
select throws_ok($$insert into public.conexoes (destinatario_id, origem) values (tt.u('c1'), 'busca')$$, '42501', null,
                 'nao pede conexao a quem nao e do Grupo');
select lives_ok($$insert into public.conexoes (destinatario_id, origem, mensagem) values (tt.u('b2'), 'busca', 'ola')$$, 'grupo pede conexao');
select throws_ok($$select * from public.revelar_contato(tt.u('b2'))$$, '42501', 'sem_conexao_aceita', 'contato escondido antes do aceite');
select throws_ok($$update public.conexoes set status = 'aceita'$$, 'P0001', null, 'solicitante nao aceita o proprio pedido');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n($q$select 1 from public.notificacoes where tipo = 'conexao_recebida'$q$), 1, 'destinatario avisado');
select is(tt.afeta($q$update public.conexoes set status = 'aceita'$q$), 1, 'destinatario aceita');
reset role;
select tt.como(tt.u('b1'));
select is((select email_contato from public.revelar_contato(tt.u('b2'))), 'contato.b2@x.test', 'contato revelado apos aceite');
select is(tt.n('select 1 from public.perfis_contato'), 0, 'perfis_contato continua so do dono');
select is(tt.n($q$select 1 from public.notificacoes where tipo = 'conexao_aceita'$q$), 1, 'solicitante avisado do aceite');
select throws_ok($$insert into public.conexoes (destinatario_id, origem) values (tt.u('b2'), 'busca')$$, '23505', null, 'um par, uma linha');
select is(tt.afeta($q$update public.conexoes set status = 'cancelada'$q$), 1, 'qualquer parte desfaz a conexao');
select throws_ok($$update public.conexoes set status = 'pendente'$$, 'P0001', null, 'novo pedido so 30 dias depois');
reset role;
alter table public.conexoes disable trigger conexoes_transicao;
update public.conexoes set respondida_em = now() - interval '31 days';
alter table public.conexoes enable trigger conexoes_transicao;
select tt.como(tt.u('b2'));
select is(tt.afeta($q$update public.conexoes set status = 'pendente'$q$), 1, 'depois de 30 dias qualquer parte pede de novo');
reset role;
select is((select solicitante_id from public.conexoes), tt.u('b2'), 'quem pede de novo vira solicitante');
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.conexoes'), 0, 'terceiro nao ve a conexao');
reset role;
-- limite: 20 pedidos em 24 h
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'lote' || g || '@t.test', '{"nome":"L","maior_18":"true"}'::jsonb
from generate_series(1, 21) g;
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, tt.conta(), 'sub_lote' || g, tt.plano('price_t_grupo'), 'active', now(), now() + interval '30 days'
from generate_series(1, 21) g;
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.conexoes (destinatario_id, origem)
  select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'busca' from generate_series(1, 20) g$$, '20 pedidos passam');
select throws_ok($$insert into public.conexoes (destinatario_id, origem) values ('00000000-0000-0000-0001-000000000021', 'busca')$$,
                 'P0001', 'limite_conexoes', '21o pedido em 24 h barrado');
reset role;

-- 3) suspensao some da rede -----------------------------------------------------------------------------------
update public.perfis set suspenso_em = now() where id = tt.u('b1');
select tt.como(tt.u('b2'));
select is(tt.n($q$select 1 from public.network_itens where perfil_id = tt.u('b1')$q$), 0, 'suspenso some do network');
select is((select count(*)::int from public.buscar_membros() where id = tt.u('b1')), 0, 'suspenso some da busca');
reset role;
update public.perfis set suspenso_em = null where id = tt.u('b1');

-- 4) Match semanal -----------------------------------------------------------------------------------------------
delete from public.conexoes;
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('match', 'v1', 'pt', 'Match', 'opt-in (teste)');
select is(private.gerar_sugestoes_match('2026-11-04'), 0, 'sem opt-in: nenhuma sugestao');
insert into public.consentimentos (documento_id, perfil_id, titular_email)
select d.id, p, 'x' from public.documentos_legais d, unnest(array[tt.u('b1'), tt.u('b2'), tt.u('c1')]) p where d.tipo = 'match';
select is(private.gerar_sugestoes_match('2026-11-04'), 2, 'opt-in dos dois do Grupo: uma sugestao para cada (clube fica de fora)');
select is((select semana from public.sugestoes_match limit 1), '2026-11-02'::date, 'semana = segunda-feira');
select is((select pontuacao::int || ' ' || motivo from public.sugestoes_match where perfil_id = tt.u('b1')),
          '6 oferece Contabilidade, que você procura; mesma cidade (Dublin); mesmo setor', 'pontuacao e motivo legivel');
select is(private.gerar_sugestoes_match('2026-11-05'), 0, 'mesma semana nao duplica');
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.sugestoes_match'), 1, 'dono le as proprias sugestoes');
select throws_ok($$insert into public.sugestoes_match (perfil_id, sugerido_id, semana, pontuacao, motivo) values (tt.u('b1'), tt.u('b2'), current_date, 1, 'x')$$,
                 '42501', null, 'insert so pelo job');
update public.consentimentos set revogado_em = now() where perfil_id = auth.uid();
reset role;
select is(private.gerar_sugestoes_match('2026-11-11'), 0, 'revogou o opt-in: sai do Match');
select is((select count(*)::int from cron.job where jobname = 'match-semanal'), 1, 'job semanal agendado no pg_cron');

select * from finish();
rollback;

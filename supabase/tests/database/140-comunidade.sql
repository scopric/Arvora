-- Comunidade (f2_02): espacos, posts, comentarios, curtidas, denuncias, moderacao e suspensao. Transacao desfeita.
begin;
select plan(41);

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

insert into public.espacos (slug, titulo, nivel_minimo, ordem) values ('geral', 'Geral', 'clube', 1), ('grupo', 'Grupo', 'grupo', 2);
create function tt.esp(s text) returns bigint language sql as $$ select id from public.espacos where slug = s $$;

-- 1) quem ve os espacos --------------------------------------------------------------------------------
select tt.anonimo();
select throws_ok($$select 1 from public.espacos$$, '42501', null, 'anon nao ve a comunidade');
reset role;
select tt.como(tt.u('f1'));
select is(tt.n('select 1 from public.espacos'), 0, 'logado sem assinatura nao ve espacos');
reset role;
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.espacos'), 1, 'clube ve so o Geral');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.espacos'), 2, 'grupo ve Geral e Grupo');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select is(tt.n('select 1 from public.espacos'), 2, 'moderador aal2 ve os espacos');
select throws_ok($$insert into public.espacos (slug, titulo, nivel_minimo) values ('x', 'X', 'clube')$$, '42501', null, 'moderador nao cria espaco');
reset role;

-- 2) posts ---------------------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.posts (espaco_id, corpo) values (tt.esp('grupo'), 'oi')$$, '42501', null, 'clube nao posta no Grupo');
select lives_ok($$insert into public.posts (espaco_id, corpo) values (tt.esp('geral'), 'post do clube')$$, 'clube posta no Geral');
select is((select autor_id from public.posts), tt.u('c1'), 'autor = quem esta logado');
reset role;
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.posts (espaco_id, corpo) values (tt.esp('grupo'), 'post do grupo')$$, 'grupo posta no Grupo');
select is(tt.n('select 1 from public.posts'), 2, 'grupo le os dois espacos');
select is(tt.afeta($q$update public.posts set corpo = 'hack' where espaco_id = tt.esp('geral')$q$), 0, 'nao edita post alheio');
select is(tt.afeta($q$update public.posts set corpo = 'editado' where espaco_id = tt.esp('grupo')$q$), 1, 'edita o proprio dentro do prazo');
reset role;
select ok((select editado_em is not null from public.posts where corpo = 'editado'), 'edicao marcada');
update public.posts set criado_em = now() - interval '1 hour' where corpo = 'editado';
select tt.como(tt.u('b1'));
select is(tt.afeta($q$update public.posts set corpo = 'tarde' where espaco_id = tt.esp('grupo')$q$), 0, 'depois de 15 min nao edita');
reset role;
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.posts'), 1, 'clube nao le post do Grupo');
select lives_ok($$insert into public.comentarios (post_id, corpo) select id, 'comentario' from public.posts$$, 'clube comenta no Geral');
select lives_ok($$insert into public.curtidas (post_id) select id from public.posts$$, 'clube curte no Geral');
reset role;
select set_config('tt.pg', (select id::text from public.posts where espaco_id = tt.esp('grupo')), true);
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.comentarios (post_id, corpo) values (current_setting('tt.pg')::bigint, 'x')$$, '42501', null,
                 'clube nao comenta em post do Grupo');
reset role;
-- clube cancelado perde a escrita e a leitura
update public.assinaturas set status = 'canceled' where stripe_subscription_id = 'sub_c1';
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.posts'), 0, 'cancelado perde a leitura');
select throws_ok($$insert into public.posts (espaco_id, corpo) values (tt.esp('geral'), 'x')$$, '42501', null, 'cancelado nao posta');
reset role;
update public.assinaturas set status = 'active' where stripe_subscription_id = 'sub_c1';

-- 3) denuncia e moderacao ----------------------------------------------------------------------------------
select tt.como(tt.u('b2'));
select throws_ok($$insert into public.denuncias (motivo) values ('spam')$$, 'P0001', 'denuncia_sem_alvo', 'denuncia exige alvo');
select lives_ok($$insert into public.denuncias (post_id, motivo, texto) select id, 'spam', 'propaganda' from public.posts where espaco_id = tt.esp('geral')$$,
                'membro denuncia post');
select is(tt.n('select 1 from public.denuncias'), 1, 'denunciante le a propria');
select throws_ok($$select public.moderar_conteudo('post', 1, true)$$, '42501', null, 'membro nao modera');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.denuncias'), 0, 'outro membro nao ve a denuncia');
reset role;
select tt.como(tt.u('f1'));
select throws_ok($$insert into public.denuncias (perfil_denunciado_id, motivo) values (tt.u('b1'), 'x')$$, '42501', null, 'sem assinatura nao denuncia');
reset role;
select tt.como(tt.u('d0'), 'aal1');
select is(tt.n('select 1 from public.denuncias'), 0, 'moderador sem aal2 nao ve a fila');
select throws_ok($$select public.moderar_conteudo('post', 1, true)$$, '42501', null, 'moderador sem aal2 nao modera');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select is(tt.n('select 1 from public.denuncias where status = ''aberta'''), 1, 'moderador ve a fila');
select lives_ok($$select public.moderar_conteudo('post', post_id, true) from public.denuncias$$, 'moderador oculta o post');
select lives_ok($$select public.resolver_denuncia(id, true) from public.denuncias$$, 'moderador resolve a denuncia');
select is(tt.n('select 1 from public.posts where oculto_em is not null'), 1, 'moderador continua vendo o oculto');
select throws_ok($$select public.suspender_perfil(tt.u('51'), true)$$, 'P0001', 'perfil_da_equipe', 'nao suspende equipe');
select lives_ok($$select public.suspender_perfil(tt.u('c1'), true)$$, 'moderador suspende perfil');
reset role;
select is((select count(*)::int from public.log_admin where ator_id = tt.u('d0') and tabela in ('posts', 'denuncias', 'perfis')), 3,
          'ocultar, resolver e suspender ficam no log');
select tt.como(tt.u('b2'));
select is(tt.n($q$select 1 from public.posts where espaco_id = tt.esp('geral')$q$), 0, 'post oculto some para o membro');
select is(tt.n('select 1 from public.comentarios'), 0, 'comentarios do post oculto somem');
reset role;
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.posts (espaco_id, corpo) values (tt.esp('geral'), 'x')$$, '42501', null, 'suspenso nao posta');
select is(tt.afeta($q$delete from public.posts$q$), 0, 'post oculto pela moderacao fica (prova da moderacao); o autor nao o apaga');
reset role;
select tt.como(tt.u('b1'));
select is(tt.afeta($q$delete from public.posts$q$), 1, 'autor apaga o proprio post visivel, mesmo fora do prazo de edicao');
reset role;

select * from finish();
rollback;

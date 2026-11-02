-- Correcoes criticas (f4_08): tarefa so do Grupo, live so do Grupo, check de aula ao vivo e espacos de referencia. Transacao desfeita.
begin;
select plan(8);

-- Espacos criados pela migration: conferidos antes de qualquer limpeza do seed.
select is((select count(*)::int from public.espacos where slug in ('geral', 'grupo')), 2, 'espacos de referencia existem');

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
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;

-- Membros: c1=clube, b1=grupo.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb, now() from (values ('c1'), ('b1')) v(id);
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select c.id, p.pr, p.n, p.nv::public.nivel_acesso, 'mes', 'assinatura', 1, 'EUR'
from public.contas_stripe c, (values ('price_t_clube', 'Clube teste', 'clube'), ('price_t_grupo', 'Grupo teste', 'grupo')) p(pr, n, nv)
where c.stripe_account_id = 'acct_teste';
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u(s), (select id from public.contas_stripe where stripe_account_id = 'acct_teste'), 'sub_' || s,
       (select id from public.planos where stripe_price_id = p), 'active', now() - interval '1 day', now() + interval '30 days'
from (values ('c1', 'price_t_clube'), ('b1', 'price_t_grupo')) v(s, p);

insert into public.verticais (slug, nome, aceita_entregas) values ('v', 'V', true);
-- aula gravada de nivel clube com tarefa
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, materiais_publicados_em)
select id, 'gravada', 'Clube', 'aula-clube', 'clube', now() from public.verticais;
insert into public.exercicios (aula_id, ordem, enunciado_md, prazo_dias) select id, 1, 'Faca.', 7 from public.aulas;
-- live do grupo, ja aberta
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em, duracao_min, agendada_em, materiais_publicados_em)
select id, 'ao_vivo', 'Viva', 'viva', 'grupo', now() + interval '1 minute', 60, now(), now() from public.verticais;
insert into public.transmissoes (aula_id, url, abre_min_antes) select id, 'https://zoom.exemplo/sala', 15 from public.aulas where slug = 'viva';

-- 1) tarefa e so do Grupo, mesmo em aula nivel clube
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values ((select id from public.exercicios), tt.u('c1'), 'x')$$,
                 '42501', null, 'clube nao entrega tarefa de aula nivel clube');
reset role;
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values ((select id from public.exercicios), tt.u('b1'), 'x')$$,
                'grupo entrega tarefa de aula nivel clube');
reset role;

-- 2) link da live: clube barrado, grupo recebe
select tt.como(tt.u('c1'));
select throws_ok($$select public.link_transmissao((select id from public.aulas where slug = 'viva'))$$, '42501', 'sem_acesso', 'clube nao recebe o link da live');
reset role;
select tt.como(tt.u('b1'));
select is(public.link_transmissao((select id from public.aulas where slug = 'viva')), 'https://zoom.exemplo/sala', 'grupo recebe o link da live');
reset role;

-- 3) aula ao vivo so com nivel grupo
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em)
                   select id, 'ao_vivo', 'Live clube', 'live-clube', 'clube', now() from public.verticais$$, '23514', null, 'live nivel clube e barrada');
select lives_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em)
                  select id, 'ao_vivo', 'Live grupo', 'live-grupo', 'grupo', now() from public.verticais$$, 'live nivel grupo passa');
select throws_ok($$update public.aulas set nivel_minimo = 'clube' where slug = 'viva'$$, '23514', null, 'nao rebaixa live para clube');

select * from finish();
rollback;

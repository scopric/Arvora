-- Correcoes criticas (f4_08): tarefa so do Grupo, live so do Grupo, check de aula ao vivo e espacos de referencia. Transacao desfeita.
begin;
select plan(15);

-- Espacos criados pela migration: conferidos antes de qualquer limpeza do seed.
select is((select count(*)::int from public.espacos where slug in ('geral', 'grupo')), 2, 'espacos de referencia existem');

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
create function tt.afeta(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;

-- Membros: c1=clube, b1=grupo; ed=editor (equipe, sem assinatura).
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb, now() from (values ('c1'), ('b1'), ('ed')) v(id);
insert into public.equipe (perfil_id, papel) values (tt.u('ed'), 'editor');
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
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, duracao_min, materiais_publicados_em)
select id, 'gravada', 'Clube', 'aula-clube', 'clube', 30, now() from public.verticais;
insert into public.exercicios (aula_id, ordem, enunciado_md, prazo_dias) select id, 1, 'Faca.', 7 from public.aulas where slug = 'aula-clube';
create function tt.ex() returns bigint language sql as $$ select e.id from public.exercicios e join public.aulas a on a.id = e.aula_id where a.slug = 'aula-clube' $$;
-- live do grupo, ja aberta
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em, duracao_min, agendada_em, materiais_publicados_em)
select id, 'ao_vivo', 'Viva', 'viva', 'grupo', now() + interval '1 minute', 60, now(), now() from public.verticais;
insert into public.transmissoes (aula_id, url, abre_min_antes) select id, 'https://zoom.exemplo/sala', 15 from public.aulas where slug = 'viva';

-- 1) tarefa e so do Grupo, mesmo em aula nivel clube
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex(), tt.u('c1'), 'x')$$,
                 '42501', null, 'clube nao entrega tarefa de aula nivel clube');
reset role;
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex(), tt.u('b1'), 'x')$$,
                'grupo entrega tarefa de aula nivel clube');
reset role;
-- reenvio tambem exige Grupo (pode_entregar no UPDATE). O gatilho forca 'enviada' no INSERT; 'ajustar' entra por UPDATE
-- do superusuario. Troca de texto em 'ajustar' (o gatilho volta para 'enviada').
insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex(), tt.u('c1'), 'velho');  -- a do b1 ja existe (insercao acima)
update public.entregas set status = 'ajustar', corrigido_por = tt.u('ed'), corrigido_em = now(), devolutiva = 'x'
 where perfil_id in (tt.u('c1'), tt.u('b1'));
select tt.como(tt.u('c1'));
select is(tt.afeta($$update public.entregas set texto = 'novo' where perfil_id = tt.u('c1')$$), 0, 'clube nao reenvia entrega em ajustar');
reset role;
select tt.como(tt.u('b1'));
select is(tt.afeta($$update public.entregas set texto = 'novo' where perfil_id = tt.u('b1')$$), 1, 'grupo reenvia entrega em ajustar');
reset role;

-- 2) link da live: clube barrado, grupo recebe
select tt.como(tt.u('c1'));
select throws_ok($$select public.link_transmissao((select id from public.aulas where slug = 'viva'))$$, '42501', 'sem_acesso', 'clube nao recebe o link da live');
reset role;
select tt.como(tt.u('b1'));
select is(public.link_transmissao((select id from public.aulas where slug = 'viva')), 'https://zoom.exemplo/sala', 'grupo recebe o link da live');
reset role;

select tt.como(tt.u('c1'));
select throws_ok($$select public.abertura_transmissao((select id from public.aulas where slug = 'viva'))$$, '42501', 'sem_acesso', 'clube nao recebe a hora de abertura');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select is(public.link_transmissao((select id from public.aulas where slug = 'viva')), 'https://zoom.exemplo/sala', 'equipe aal2 recebe o link');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select public.link_transmissao((select id from public.aulas where slug = 'viva'))$$, '42501', null, 'anonimo nao chama link_transmissao');
reset role;

-- comunidade: Clube nao le o espaco do Grupo nem os posts dele
insert into public.espacos (slug, titulo, nivel_minimo) values ('grupo', 'Grupo', 'grupo'), ('geral', 'Geral', 'clube');
insert into public.posts (espaco_id, autor_id, corpo) select id, tt.u('b1'), 'so grupo' from public.espacos where slug = 'grupo';
select tt.como(tt.u('c1'));
select is((select count(*)::int from public.espacos where slug = 'grupo'), 0, 'clube nao le o espaco grupo');
select is((select count(*)::int from public.posts), 0, 'clube nao le posts do espaco grupo');
reset role;

-- 3) aula ao vivo so com nivel grupo
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em)
                   select id, 'ao_vivo', 'Live clube', 'live-clube', 'clube', now() from public.verticais$$, '23514', null, 'live nivel clube e barrada');
select lives_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em)
                  select id, 'ao_vivo', 'Live grupo', 'live-grupo', 'grupo', now() from public.verticais$$, 'live nivel grupo passa');
select throws_ok($$update public.aulas set nivel_minimo = 'clube' where slug = 'viva'$$, '23514', null, 'nao rebaixa live para clube');

select * from finish();
rollback;

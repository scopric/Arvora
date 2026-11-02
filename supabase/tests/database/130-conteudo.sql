-- Conteudo (f2_01): cursos, modulos, aulas, transmissoes, materiais_aula, exercicios, entregas, progresso_aula,
-- notificacoes e as RPCs aprovar_material, corrigir_entrega e link_transmissao. Transacao desfeita.
begin;
select plan(62);

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

insert into public.verticais (slug, nome, aceita_entregas, conta_como_ia) values ('vendas', 'Vendas', true, false),
                                                                                 ('mente', 'Mente', false, true);
create function tt.vert(s text) returns bigint language sql as $$ select id from public.verticais where slug = s $$;
create function tt.aula(s text) returns bigint language sql as $$ select id from public.aulas where slug = s $$;
insert into public.cursos (vertical_id, titulo, slug, nivel_minimo, publicado_em)
values (tt.vert('vendas'), 'Curso publicado', 'curso-pub', 'grupo', now()), (tt.vert('vendas'), 'Rascunho', 'curso-rasc', 'grupo', null);
insert into public.modulos (curso_id, titulo, ordem) select id, 'M1', 1 from public.cursos;
-- aulas: g-pub (grupo, publicada), c-pub (clube, publicada), rasc (rascunho), viva (ao vivo agendada daqui a 10 min),
-- longe (ao vivo agendada em 2 dias), mente (publicada, vertical sem entregas), de-curso-rasc (no curso rascunho)
insert into public.aulas (vertical_id, modulo_id, tipo, titulo, slug, nivel_minimo, inicio_em, duracao_min, video_id, agendada_em, materiais_publicados_em)
values (tt.vert('vendas'), null, 'gravada', 'G', 'g-pub', 'grupo', null, 60, 'vid_secreto', null, now()),
       (tt.vert('vendas'), null, 'gravada', 'C', 'c-pub', 'clube', null, 30, 'vid_c', null, now()),
       (tt.vert('vendas'), null, 'gravada', 'R', 'rasc', 'grupo', null, 30, 'vid_r', null, null),
       (tt.vert('vendas'), null, 'ao_vivo', 'V', 'viva', 'grupo', now() + interval '10 minutes', 60, null, now(), null),
       (tt.vert('vendas'), null, 'ao_vivo', 'L', 'longe', 'grupo', now() + interval '2 days', 60, null, now(), null),
       (tt.vert('mente'), null, 'gravada', 'M', 'mente', 'grupo', null, 90, null, null, now()),
       (tt.vert('vendas'), (select m.id from public.modulos m join public.cursos c on c.id = m.curso_id where c.slug = 'curso-rasc'),
        'gravada', 'DC', 'de-curso-rasc', 'grupo', null, 10, null, null, now());
insert into public.transmissoes (aula_id, url, url_reserva) values (tt.aula('viva'), 'https://zoom.exemplo/principal', 'https://meet.exemplo/reserva'),
                                                                     (tt.aula('longe'), 'https://zoom.exemplo/longe', null);
insert into public.materiais_aula (aula_id, tipo, conteudo_md) values (tt.aula('g-pub'), 'resumo', 'resumo'), (tt.aula('g-pub'), 'ebook', 'ebook');
insert into public.exercicios (aula_id, ordem, enunciado_md, aceita_arquivo) values (tt.aula('g-pub'), 1, 'Exercicio 1', true),
                                                                                     (tt.aula('mente'), 1, 'Exercicio Mente', false),
                                                                                     (tt.aula('c-pub'), 1, 'Exercicio Clube', false);
create function tt.ex(s text) returns bigint language sql as $$ select e.id from public.exercicios e where e.aula_id = tt.aula(s) $$;

-- 1) estrutura -------------------------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.cursos'::regclass, 'public.modulos'::regclass,
  'public.aulas'::regclass, 'public.transmissoes'::regclass, 'public.materiais_aula'::regclass, 'public.exercicios'::regclass,
  'public.entregas'::regclass, 'public.progresso_aula'::regclass, 'public.notificacoes'::regclass)), 'RLS ligado nas tabelas de conteudo');
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug) values (1, 'ao_vivo', 'x', 'x-x')$$, '23514', null,
                 'aula ao vivo exige inicio_em');
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug, materiais_publicados_em) select id, 'gravada', 'x', 'x-y', now() from public.verticais limit 1$$,
                 '23514', null, 'publicar materiais exige duracao (AUL-06)');

-- 2) anon ------------------------------------------------------------------------------------------------
select tt.anonimo();
select is(tt.n('select 1 from public.cursos'), 1, 'anon ve so curso publicado');
select is(tt.n('select 1 from public.aulas'), 5, 'anon ve aulas agendadas ou publicadas (fora rascunho e aula de curso rascunho)');
select throws_ok($$select video_id from public.aulas$$, '42501', null, 'anon nao le video_id');
select throws_ok($$select 1 from public.transmissoes$$, '42501', null, 'anon nao le transmissoes');
select throws_ok($$select 1 from public.materiais_aula$$, '42501', null, 'anon nao le materiais');
select throws_ok($$select public.link_transmissao(1)$$, '42501', null, 'anon nao pede link');
reset role;

-- 3) clube x grupo -----------------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select is(tt.n('select 1 from public.materiais_aula'), 0, 'clube nao ve material de aula do grupo');
select is(tt.n($q$select 1 from public.exercicios where aula_id = tt.aula('c-pub')$q$), 1, 'clube ve exercicio de aula do clube');
select throws_ok($$select public.link_transmissao(tt.aula('viva'))$$, '42501', 'sem_acesso', 'clube nao recebe link da live do grupo');
select is(tt.n('select 1 from public.transmissoes'), 0, 'membro nao le transmissoes direto');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.materiais_aula'), 0, 'material em rascunho nao aparece para o grupo');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select lives_ok($$select public.aprovar_material(id) from public.materiais_aula where tipo = 'resumo'$$, 'editor aprova material');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.materiais_aula'), 1, 'grupo ve so o material aprovado');
select is(public.link_transmissao(tt.aula('viva')), 'https://zoom.exemplo/principal', 'grupo recebe o link principal na janela');
select throws_ok($$select public.link_transmissao(tt.aula('longe'))$$, 'P0001', 'ainda_nao_abriu', 'antes da janela: sem link');
select is(tt.n('select 1 from public.aulas where slug = ''rasc'''), 0, 'membro nao ve rascunho');
reset role;
-- editar o material volta para rascunho
select tt.como(tt.u('ed'), 'aal2');
select is(tt.afeta($q$update public.materiais_aula set conteudo_md = 'novo' where tipo = 'resumo'$q$), 1, 'editor edita material');
select is((select status::text from public.materiais_aula where tipo = 'resumo'), 'rascunho', 'edicao volta para rascunho');
select throws_ok($$update public.materiais_aula set status = 'aprovado'$$, '42501', null, 'status so por aprovar_material');
select lives_ok($$update public.transmissoes set usar_reserva = true where aula_id = tt.aula('viva')$$, 'editor troca para o link reserva');
reset role;
select tt.como(tt.u('b1'));
select is(public.link_transmissao(tt.aula('viva')), 'https://meet.exemplo/reserva', 'link reserva entregue');
reset role;

-- 4) escrita da equipe e 2FA ---------------------------------------------------------------------------------
select tt.como(tt.u('ed'), 'aal1');
select throws_ok($$insert into public.cursos (vertical_id, titulo, slug) values (tt.vert('vendas'), 'X', 'x-sem-2fa')$$, '42501', null,
                 'editor sem aal2 nao cria curso');
select is(tt.afeta($q$update public.aulas set titulo = 'hack'$q$), 0, 'editor sem aal2 nao altera aula');
select is(tt.n('select 1 from public.aulas where slug = ''rasc'''), 0, 'equipe sem aal2 nao ve rascunho');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug) values (tt.vert('vendas'), 'gravada', 'X', 'x-mod')$$, '42501', null,
                 'moderador nao cria aula');
select is(tt.n('select 1 from public.aulas where slug = ''rasc'''), 1, 'qualquer equipe aal2 ve rascunho');
select throws_ok($$select public.aprovar_material(1)$$, '42501', null, 'moderador nao aprova material');
reset role;
select tt.como(tt.u('b1'));
select throws_ok($$insert into public.aulas (vertical_id, tipo, titulo, slug) values (tt.vert('vendas'), 'gravada', 'X', 'x-membro')$$, '42501', null,
                 'membro nao cria aula');
reset role;
select ok((select count(*) from public.log_admin where tabela = 'materiais_aula') >= 2, 'escritas do editor no log');

-- 5) entregas ------------------------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex('g-pub'), tt.u('c1'), 'x')$$, '42501', null,
                 'clube nao entrega tarefa de aula do grupo');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex('g-pub'), tt.u('ed'), 'x')$$, '42501', null,
                 'equipe sem assinatura nao entrega');
reset role;
select tt.como(tt.u('b1'));
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex('mente'), tt.u('b1'), 'x')$$, '42501', null,
                 'vertical sem entregas ligadas bloqueia (dado de saude)');
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, texto) values (tt.ex('g-pub'), tt.u('b2'), 'x')$$, '42501', null,
                 'grupo nao entrega em nome de outro');
select throws_ok($$insert into public.entregas (exercicio_id, perfil_id, arquivo_path) values (tt.ex('g-pub'), tt.u('b1'), 'outro/arq.pdf')$$, '23514', null,
                 'arquivo tem de estar na pasta do dono');
select lives_ok($$insert into public.entregas (exercicio_id, perfil_id, texto, arquivo_path)
  values (tt.ex('g-pub'), tt.u('b1'), 'minha resposta', tt.u('b1')::text || '/resp.pdf')$$, 'grupo envia entrega');
select is(tt.afeta($q$update public.entregas set texto = 'mudei'$q$), 0, 'enviada nao se edita (so em ajustar)');
select throws_ok($$update public.entregas set status = 'aprovada'$$, '42501', null, 'dono nao muda status');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n('select 1 from public.entregas'), 0, 'outro membro nao ve a entrega');
reset role;
select tt.como(tt.u('c0'), 'aal1');
select is(tt.n('select 1 from public.entregas'), 0, 'corretor sem aal2 nao ve a fila');
select throws_ok($$select public.corrigir_entrega(1, 'aprovada', 'ok')$$, '42501', null, 'corretor sem aal2 nao corrige');
reset role;
select tt.como(tt.u('c0'), 'aal2');
select is(tt.n('select 1 from public.entregas'), 1, 'corretor aal2 ve a fila');
select throws_ok($$select public.corrigir_entrega(id, 'ajustar', '') from public.entregas$$, 'P0001', 'devolutiva_obrigatoria', 'ajuste exige devolutiva');
select lives_ok($$select public.corrigir_entrega(id, 'ajustar', 'refaca o item 2') from public.entregas$$, 'corretor pede ajuste');
select throws_ok($$update public.entregas set devolutiva = 'x'$$, '42501', null, 'corretor so corrige pela RPC');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$select public.corrigir_entrega(1, 'aprovada', 'ok')$$, '42501', null, 'editor nao corrige entrega');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.notificacoes where titulo = 'Sua entrega precisa de ajuste'$q$), 1, 'membro e avisado no sino');
select is(tt.afeta($q$update public.entregas set texto = 'refeito'$q$), 1, 'em ajustar o dono reenvia');
select is((select status::text || '/' || (corrigido_por is null)::text from public.entregas), 'enviada/true', 'reenvio volta para enviada');
reset role;

-- 6) progresso e notificacoes -------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select throws_ok($$insert into public.progresso_aula (perfil_id, aula_id, percentual) values (tt.u('c1'), tt.aula('g-pub'), 10)$$, '42501', null,
                 'clube nao grava progresso em aula do grupo');
select lives_ok($$insert into public.progresso_aula (perfil_id, aula_id, percentual) values (tt.u('c1'), tt.aula('c-pub'), 100)$$,
                'clube grava progresso em aula do clube');
select ok((select concluida_em is not null from public.progresso_aula), '100% marca concluida');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.progresso_aula'), 0, 'progresso de outro nao aparece');
reset role;
update public.aulas set materiais_publicados_em = now() where slug = 'rasc';
select is((select count(*)::int from public.notificacoes where tipo = 'aula_publicada' and link = '/aulas/rasc'), 2,
          'publicar materiais avisa so quem tem o nivel (os dois do grupo)');
select set_config('tt.nn', (select count(*)::text from public.notificacoes), true);
update public.aulas set agendada_em = now() where slug = 'c-pub';
select is((select count(*)::text from public.notificacoes), current_setting('tt.nn'), 'agendar nao avisa ninguem');
select is((select count(*)::int from public.notificacoes where link = '/aulas/de-curso-rasc'), 0, 'aula de curso nao publicado nao avisa');
select tt.como(tt.u('b1'));
select is(tt.afeta($q$update public.notificacoes set lida_em = now()$q$), (select count(*)::int from public.notificacoes where perfil_id = tt.u('b1')), 'dono marca as proprias como lidas');
select throws_ok($$insert into public.notificacoes (perfil_id, tipo, titulo) values (tt.u('b1'), 'sistema', 'x')$$, '42501', null,
                 'membro nao cria notificacao');
reset role;
-- 7) horas do Ciclo (rateio de IA) ------------------------------------------------------------------------------
select is(private.horas_ciclo(lower(public.ciclo_de(now())), 'grupo', true), 1.5, 'horas de IA do Ciclo (aula da vertical IA)');
select ok(private.horas_ciclo(lower(public.ciclo_de(now())), 'clube', false) = 0.5, 'clube conta so aulas de nivel clube');

select * from finish();
rollback;

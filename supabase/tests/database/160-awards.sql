-- Brazilian Awards e Directory (f3_01): empresas, edicoes, categorias, indicados, premiados (consentimento,
-- convite, pedido de alteracao), patrocinadores, agenda, temas, videos, videos_citados, salvos. Transacao desfeita.
begin;
select plan(52);

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

insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('hall_of_fame', 'v1', 'pt', 'HoF', 'autorizo (teste)');
insert into public.consentimentos (documento_id, titular_email, titular_nome, evidencia)
select id, 'premiado@x.test', 'Premiada', 'formulario (teste)' from public.documentos_legais;
create function tt.cons() returns bigint language sql as $$ select id from public.consentimentos where titular_email = 'premiado@x.test' $$;
insert into public.edicoes (slug, nome, ano, pais, cidade, durante_inicio, durante_fim, publicada_em) values
  ('dublin-2025', 'Dublin 2025', 2025, 'IE', 'Dublin', now() - interval '400 days', now() - interval '399 days', now()),
  ('dublin-2027', 'Dublin 2027', 2027, 'IE', 'Dublin', now() + interval '300 days', now() + interval '301 days', null);
create function tt.ed(s text) returns bigint language sql as $$ select id from public.edicoes where slug = s $$;
insert into public.categorias_premio (edicao_id, nome, slug) values (tt.ed('dublin-2025'), 'Empreendedora', 'empreendedora'),
                                                                     (tt.ed('dublin-2027'), 'Empreendedora', 'empreendedora');
create function tt.cat(s text) returns bigint language sql as $$ select id from public.categorias_premio where edicao_id = tt.ed(s) $$;
insert into public.premiados (edicao_id, categoria_id, nome, slug, historia, consentimento_id, convite_email, publicado_em)
values (tt.ed('dublin-2025'), tt.cat('dublin-2025'), 'Premiada', 'premiada', 'historia', tt.cons(), 'B1@T.test', now()),
       (tt.ed('dublin-2025'), tt.cat('dublin-2025'), 'Sem consentimento', 'sem-cons', 'x', null, null, null);

-- 1) estrutura e consentimento ---------------------------------------------------------------------------
select throws_ok($$update public.premiados set publicado_em = now() where slug = 'sem-cons'$$, 'P0001', 'consentimento_ausente_ou_revogado',
                 'publicar exige consentimento');
select throws_ok($$insert into public.premiados (edicao_id, categoria_id, nome, slug) values (tt.ed('dublin-2025'), tt.cat('dublin-2027'), 'X', 'x')$$,
                 '23503', null, 'categoria tem de ser da mesma edicao');
select is(public.fase(e), 'depois', 'fase calculada pelas datas') from public.edicoes e where slug = 'dublin-2025';
select is(public.fase(e), 'antes', 'edicao futura: antes') from public.edicoes e where slug = 'dublin-2027';

-- 2) anon: vitrine ---------------------------------------------------------------------------------------
select tt.anonimo();
select is(tt.n('select 1 from public.edicoes'), 1, 'anon ve so edicao publicada');
select is(tt.n('select 1 from public.premiados'), 1, 'anon ve so premiado publicado');
select throws_ok($$select convite_email from public.premiados$$, '42501', null, 'anon nao le convite_email');
select throws_ok($$select perfil_id from public.premiados$$, '42501', null, 'anon nao le perfil_id do premiado');
select throws_ok($$select 1 from public.consentimentos$$, '42501', null, 'anon nao le consentimentos');
reset role;
select tt.como(tt.u('b2'));
select throws_ok($$select convite_email from public.premiados$$, '42501', null, 'membro nao le convite_email');
select throws_ok($$select alteracao_pendente from public.premiados$$, '42501', null, 'membro nao le alteracao_pendente');
select throws_ok($$select public.premiado_privado(id) from public.premiados where slug = 'premiada'$$, '42501', null,
                 'outro membro nao le colunas privadas');
reset role;

-- 3) convite e "Meu Award" -------------------------------------------------------------------------------
select is((select perfil_id from public.premiados where slug = 'premiada'), null, 'antes da confirmacao: sem vinculo');
update auth.users set email_confirmed_at = null where id = tt.u('b1');
update auth.users set email_confirmed_at = now() where id = tt.u('b1');
select is((select perfil_id from public.premiados where slug = 'premiada'), tt.u('b1'), 'e-mail confirmado igual ao convite liga o premiado');
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.premiados where perfil_id = auth.uid()'), 1, 'premiado le a propria linha por perfil_id');
select is(tt.afeta($q$update public.premiados set historia = 'direto'$q$), 0, 'premiado nao edita direto');
select throws_ok($$select public.pedir_alteracao_premiado(id, '{"nome":"x"}') from public.premiados where perfil_id = auth.uid()$$,
                 'P0001', 'campos_invalidos', 'so historia, redes, materia_url e foto_path');
select lives_ok($$select public.pedir_alteracao_premiado(id, '{"historia":"nova historia"}') from public.premiados where perfil_id = auth.uid()$$,
                'premiado pede alteracao');
select is((select public.premiado_privado(id) ->> 'convite_email' from public.premiados where perfil_id = auth.uid()), null,
          'premiado nao ve o convite_email nem pela RPC');
select is((select public.premiado_privado(id) #>> '{alteracao_pendente,historia}' from public.premiados where perfil_id = auth.uid()),
          'nova historia', 'premiado ve a propria alteracao pendente');
reset role;
select tt.anonimo();
select is((select historia from public.premiados), 'historia', 'pagina publica nao muda antes da aprovacao');
reset role;
select tt.como(tt.u('ed'), 'aal1');
select throws_ok($$select public.aprovar_alteracao_premiado(1, true)$$, '42501', null, 'editor sem aal2 nao aprova');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select is((select public.premiado_privado(id) ->> 'convite_email' from public.premiados where slug = 'premiada'), 'B1@T.test', 'editor ve o convite');
select lives_ok($$select public.aprovar_alteracao_premiado(id, true) from public.premiados where slug = 'premiada'$$, 'editor aprova alteracao');
reset role;
select is((select historia || '/' || (alteracao_em is null)::text from public.premiados where slug = 'premiada'), 'nova historia/true',
          'alteracao aplicada e limpa');

-- 4) revogar consentimento despublica -------------------------------------------------------------------------
select tt.como(tt.u('51'), 'aal2');
select is(tt.afeta($q$update public.consentimentos set revogado_em = now() where titular_email = 'premiado@x.test'$q$), 1, 'equipe registra a revogacao');
reset role;
select is((select publicado_em from public.premiados where slug = 'premiada'), null, 'revogou: premiado despublicado');
select throws_ok($$update public.premiados set publicado_em = now() where slug = 'premiada'$$, 'P0001', 'consentimento_ausente_ou_revogado',
                 'nao republica com consentimento revogado');

-- 5) escrita da equipe ---------------------------------------------------------------------------------------
select tt.como(tt.u('d0'), 'aal2');
select throws_ok($$insert into public.edicoes (slug, nome, ano, pais, cidade, durante_inicio, durante_fim) values ('x-1', 'X', 2030, 'IE', 'Cork', now(), now() + interval '1 day')$$,
                 '42501', null, 'moderador nao cria edicao');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select lives_ok($$insert into public.patrocinadores (edicao_id, nome) values (tt.ed('dublin-2025'), 'Patrocinador'), (tt.ed('dublin-2027'), 'Futuro')$$,
                'editor cadastra patrocinadores');
select lives_ok($$insert into public.temas (nome, slug) values ('Tributacao', 'tributacao')$$, 'editor cadastra tema');
select lives_ok($$insert into public.videos (tipo, titulo, slug, video_id, trailer_video_id, nivel_minimo, publicado_em)
  values ('talk', 'Talk', 'talk-1', 'vid_talk', 'trailer', 'grupo', now()), ('original', 'Rascunho', 'orig-1', 'vid_o', null, 'clube', null)$$,
  'editor cadastra videos');
select lives_ok($$insert into public.videos_citados (video_id, premiado_id) select v.id, p.id from public.videos v, public.premiados p where v.slug = 'talk-1' and p.slug = 'premiada'$$,
                'editor liga video ao premiado');
reset role;
select tt.anonimo();
select is(tt.n('select 1 from public.patrocinadores'), 1, 'patrocinador de edicao nao publicada nao aparece');
select is(tt.n('select 1 from public.videos'), 1, 'anon ve so video publicado');
select throws_ok($$select video_id from public.videos$$, '42501', null, 'anon nao le video_id (so o trailer)');
select is(tt.n('select 1 from public.videos_citados'), 0, 'citacao de premiado despublicado nao aparece');
reset role;

-- 6) empresas (Directory) ------------------------------------------------------------------------------------
select tt.como(tt.u('f1'));
select throws_ok($$insert into public.empresas (nome, slug, setor_id) select 'E', 'e-f1', id from public.setores limit 1$$, '42501', null,
                 'sem assinatura nao cadastra empresa');
reset role;
select tt.como(tt.u('c1'));
select lives_ok($$insert into public.empresas (nome, slug, setor_id, site) select 'Empresa C1', 'empresa-c1', id, 'https://c1.exemplo' from public.setores limit 1$$,
                'clube cadastra a propria empresa');
select is((select status::text || '/' || (dono_perfil_id = tt.u('c1'))::text from public.empresas), 'pendente/true', 'nasce pendente e do dono');
reset role;
select tt.anonimo();
select is(tt.n('select 1 from public.empresas'), 0, 'pendente nao aparece no Directory');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select lives_ok($$select public.aprovar_empresa(id, true) from public.empresas$$, 'moderador aprova');
reset role;
select tt.anonimo();
select is(tt.n('select 1 from public.empresas'), 1, 'aprovada aparece');
select throws_ok($$select dono_perfil_id from public.empresas$$, '42501', null, 'anon nao le o dono');
select throws_ok($$select site from public.empresas$$, '42501', null, 'anon ve so o resumo (sem site)');
reset role;
select tt.como(tt.u('c1'));
select is(tt.afeta($q$update public.empresas set descricao = 'nova'$q$), 1, 'dono edita');
reset role;
select is((select status::text from public.empresas), 'pendente', 'edicao do dono volta para pendente');
select tt.como(tt.u('b2'));
select is(tt.afeta($q$update public.empresas set descricao = 'hack'$q$), 0, 'outro membro nao edita');
select throws_ok($$update public.empresas set status = 'publicada'$$, '42501', null, 'status so pela RPC');
reset role;

-- 7) salvos --------------------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
select lives_ok($$insert into public.salvos (video_id) select id from public.videos where slug = 'talk-1'$$, 'membro salva video publicado');
select throws_ok($$insert into public.salvos (video_id) values ((select max(id) + 100 from public.temas))$$, '42501', null, 'nao salva o que nao ve');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n('select 1 from public.salvos'), 0, 'salvos sao do dono');
reset role;

select * from finish();
rollback;

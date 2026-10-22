-- RLS da F1 (identidade): setores, perfis, equipe. Roda com `supabase test db`, tudo dentro de uma
-- transacao desfeita. Sem dbdev/helpers: o papel e o aal do JWT sao simulados com set_config.
begin;
select plan(61);

create schema tt;
grant usage on schema tt to public;
-- Troca para a pessoa/papel: aal 'aal1' ou 'aal2'. Volta ao superusuario com `reset role`.
create function tt.como(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  set local role authenticated;
end $$;
create function tt.afeta(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function tt.anonimo() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

-- Usuarios (o gatilho cria o perfil). a/b = membros; mod/edi/sup/aud = equipe.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@t.test', '{"nome":"Ana","maior_18":"true"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@t.test', '{"nome":"Bia","maior_18":"true"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'mod@t.test', '{"nome":"Moderador","maior_18":"true"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'edi@t.test', '{"nome":"Editor","maior_18":"true"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'sup@t.test', '{"nome":"Super","maior_18":"true"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'aud@t.test', '{"nome":"Auditor","maior_18":"true"}');
insert into public.equipe (perfil_id, papel) values
  ('00000000-0000-0000-0000-0000000000d1', 'moderador'),
  ('00000000-0000-0000-0000-0000000000d2', 'editor'),
  ('00000000-0000-0000-0000-0000000000d3', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000d4', 'auditor');
insert into public.setores (nome, slug) values ('Tecnologia', 'tecnologia');

-- 1) estrutura -------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.setores'::regclass), 'RLS ligado em setores');
select ok((select relrowsecurity from pg_class where oid = 'public.perfis'::regclass), 'RLS ligado em perfis');
select ok((select relrowsecurity from pg_class where oid = 'public.equipe'::regclass), 'RLS ligado em equipe');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
          0, 'nenhuma tabela de public sem RLS');
select ok(not has_table_privilege('anon', 'public.equipe', 'select'), 'anon sem acesso a equipe');
select ok(not has_table_privilege('anon', 'public.perfis', 'insert'), 'anon nao insere em perfis');
select ok(not has_function_privilege('anon', 'private.papel_atual()', 'execute'), 'anon sem execute em papel_atual');
select ok(not has_function_privilege('anon', 'public.aprovar_perfil_publico(uuid, boolean)', 'execute'),
          'anon sem execute em aprovar_perfil_publico');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon sem uso do schema private');
select ok(not has_column_privilege('authenticated', 'public.perfis', 'maior_18_em', 'select'),
          'maior_18_em nao sai pela API');

-- 2) cadastro --------------------------------------------------------------------------------
select is((select nome from public.perfis where id = '00000000-0000-0000-0000-00000000000a'), 'Ana',
          'perfil criado pelo gatilho com o nome do cadastro');
select ok((select maior_18_em is not null from public.perfis where id = '00000000-0000-0000-0000-00000000000a'),
          'maioridade registrada');
select throws_ok($$insert into auth.users (id, email, raw_user_meta_data)
                   values (gen_random_uuid(), 'x@t.test', '{"nome":"X"}')$$,
                 'P0001', 'maior_18_obrigatorio', 'cadastro sem declarar 18 anos e recusado');
select throws_ok($$insert into auth.users (id, email, raw_user_meta_data)
                   values (gen_random_uuid(), 'y@t.test', '{"nome":"Y","maior_18":"false"}')$$,
                 'P0001', 'maior_18_obrigatorio', 'maior_18 diferente de true e recusado');

-- 3) perfis: dono e terceiros ----------------------------------------------------------------
select tt.como('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.perfis), 1, 'membro ve so o proprio perfil (outros sao privados)');
select lives_ok($$update public.perfis set cidade = 'Dublin', pais = 'IE', bio = 'ola'
                  where id = '00000000-0000-0000-0000-00000000000a'$$, 'dono edita o proprio perfil');
select is((select tt.afeta($q$update public.perfis set nome = 'Hack'
            where id = '00000000-0000-0000-0000-00000000000b'$q$)), 0,
          'dono nao altera perfil de outro (0 linhas)');
select throws_ok($$update public.perfis set suspenso_em = null where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'dono nao altera suspenso_em');
select throws_ok($$update public.perfis set publico_aprovado_em = now() where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'dono nao se autoaprova');
select throws_ok($$update public.perfis set maior_18_em = now() where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'dono nao altera maior_18_em');
select throws_ok($$update public.perfis set id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'dono nao altera id');
select throws_ok($$insert into public.perfis (id, nome, maior_18_em)
                   values (gen_random_uuid(), 'Fantasma', now())$$,
                 '42501', null, 'ninguem insere perfil direto');
select throws_ok($$delete from public.perfis where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'dono nao apaga o perfil pela API');
select throws_ok($$update public.perfis set pais = 'ie' where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '23514', null, 'check de pais');
select throws_ok($$update public.perfis set linkedin_url = 'javascript:alert(1)' where id = '00000000-0000-0000-0000-00000000000a'$$,
                 '23514', null, 'linkedin_url so aceita https do linkedin');
reset role;

-- 4) perfil publico: aprovacao, reaprovacao, suspensao ---------------------------------------
select tt.como('00000000-0000-0000-0000-00000000000b');
select lives_ok($$update public.perfis set visibilidade = 'publico', slug = 'bia' where id = '00000000-0000-0000-0000-00000000000b'$$,
                'B torna o perfil publico');
reset role;
select tt.anonimo();
select is((select count(*)::int from public.perfis), 0, 'anon nao ve perfil publico ainda nao aprovado');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d1', 'aal1');
select throws_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$,
                 '42501', 'sem_permissao', 'moderador sem 2FA (aal1) nao aprova');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d2', 'aal2');
select throws_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$,
                 '42501', 'sem_permissao', 'editor nao aprova perfil');
reset role;
select tt.como('00000000-0000-0000-0000-00000000000a', 'aal2');
select throws_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$,
                 '42501', 'sem_permissao', 'membro comum nao aprova perfil, mesmo com aal2');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d1', 'aal2');
select lives_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$,
                'moderador com 2FA aprova');
select throws_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000a')$$,
                 'P0002', 'perfil_nao_aprovavel', 'perfil privado nao e aprovavel');
reset role;
select tt.anonimo();
select is((select count(*)::int from public.perfis), 1, 'anon ve o perfil publico aprovado');
select is((select nome from public.perfis where slug = 'bia'), 'Bia', 'anon le as colunas publicas');
select throws_ok($$select maior_18_em from public.perfis$$, '42501', null, 'anon nao le maior_18_em');
select throws_ok($$select suspenso_em from public.perfis$$, '42501', null, 'anon nao le suspenso_em');
reset role;
select tt.como('00000000-0000-0000-0000-00000000000b');
select lives_ok($$update public.perfis set bio = 'mudei' where id = '00000000-0000-0000-0000-00000000000b'$$,
                'B edita a bio');
reset role;
select ok((select publico_aprovado_em is null from public.perfis where id = '00000000-0000-0000-0000-00000000000b'),
         'editar campo publico derruba a aprovacao');
select tt.anonimo();
select is((select count(*)::int from public.perfis), 0, 'anon deixa de ver o perfil ate nova aprovacao');
reset role;
-- reaprova, depois suspende (suspender_perfil entra na F4; aqui a coluna e escrita pelo dono do banco)
select tt.como('00000000-0000-0000-0000-0000000000d1', 'aal2');
select lives_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$, 'reaprovado');
reset role;
update public.perfis set suspenso_em = now() where id = '00000000-0000-0000-0000-00000000000b';
select tt.anonimo();
select is((select count(*)::int from public.perfis), 0, 'perfil suspenso some para o publico');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d1', 'aal2');
select throws_ok($$select public.aprovar_perfil_publico('00000000-0000-0000-0000-00000000000b')$$,
                 'P0002', 'perfil_nao_aprovavel', 'perfil suspenso nao e aprovavel');
reset role;

-- 5) equipe le tudo, mas so com 2FA ------------------------------------------------------------
select tt.como('00000000-0000-0000-0000-0000000000d4', 'aal2');
select is((select count(*)::int from public.perfis), 6, 'equipe com 2FA le todos os perfis');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d4', 'aal1');
select is((select count(*)::int from public.perfis), 1, 'equipe sem 2FA le so o proprio perfil');
select is((select private.papel_atual()), null, 'papel_atual e nulo em aal1');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d4', 'aal2');
select is((select private.papel_atual()), 'auditor'::public.papel_equipe, 'papel_atual le do banco em aal2');
reset role;

-- 6) equipe (tabela) ---------------------------------------------------------------------------
select tt.como('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.equipe), 0, 'membro comum nao ve ninguem da equipe');
select throws_ok($$insert into public.equipe (perfil_id, papel) values ('00000000-0000-0000-0000-00000000000a', 'super_admin')$$,
                 '42501', null, 'membro nao se promove');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d2', 'aal2');
select is((select count(*)::int from public.equipe), 1, 'equipe nao-super ve so a propria linha');
select throws_ok($$insert into public.equipe (perfil_id, papel) values ('00000000-0000-0000-0000-00000000000a', 'editor')$$,
                 '42501', null, 'editor nao concede papel');
select is((select tt.afeta($q$update public.equipe set papel = 'super_admin'
            where perfil_id = '00000000-0000-0000-0000-0000000000d2'$q$)), 0,
          'editor nao se promove a super_admin (0 linhas)');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d3', 'aal1');
select throws_ok($$insert into public.equipe (perfil_id, papel) values ('00000000-0000-0000-0000-00000000000a', 'editor')$$,
                 '42501', null, 'super_admin sem 2FA nao concede papel');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d3', 'aal2');
select lives_ok($$insert into public.equipe (perfil_id, papel) values ('00000000-0000-0000-0000-00000000000a', 'corretor')$$,
                'super_admin com 2FA concede papel');
select is((select count(*)::int from public.equipe), 5, 'super_admin com 2FA le toda a equipe');
select lives_ok($$delete from public.equipe where perfil_id = '00000000-0000-0000-0000-00000000000a'$$,
                'super_admin com 2FA retira papel');
reset role;

-- 7) setores -----------------------------------------------------------------------------------
select tt.anonimo();
select is((select count(*)::int from public.setores), 1, 'anon le setores');
select throws_ok($$insert into public.setores (nome, slug) values ('X', 'x')$$, '42501', null, 'anon nao escreve em setores');
reset role;
select tt.como('00000000-0000-0000-0000-00000000000a');
select throws_ok($$insert into public.setores (nome, slug) values ('X', 'x')$$, '42501', null, 'membro nao escreve em setores');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d2', 'aal1');
select throws_ok($$insert into public.setores (nome, slug) values ('X', 'x')$$, '42501', null, 'editor sem 2FA nao escreve em setores');
reset role;
select tt.como('00000000-0000-0000-0000-0000000000d2', 'aal2');
select lives_ok($$insert into public.setores (nome, slug) values ('Saude', 'saude')$$, 'editor com 2FA escreve em setores');
select throws_ok($$insert into public.setores (nome, slug) values ('Dup', 'saude')$$, '23505', null, 'slug de setor e unico');
reset role;

select * from finish();
rollback;

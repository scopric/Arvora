-- setores.nome_en (f1_16): coluna, check, leitura publica e escrita so da equipe (aal2). Transacao desfeita.
-- Todos os dados abaixo sao de teste.
begin;
select plan(10);

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
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;

-- c1=membro comum, 51=super_admin
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('c1'), ('51')) v(id);
insert into public.equipe (perfil_id, papel) values (tt.u('51'), 'super_admin');

insert into public.setores (nome, slug) values ('Setor teste', 'setor-teste-nome-en');

select has_column('public', 'setores', 'nome_en', 'coluna nome_en existe');
select is((select nome_en from public.setores where slug = 'setor-teste-nome-en'), null, 'nome_en e nulo por padrao');
select is((select count(*)::int from public.setores
           where slug in ('alimentacao-e-bebidas', 'beleza-e-estetica', 'construcao-e-reformas', 'educacao',
                          'limpeza-e-servicos-domesticos', 'saude-e-bem-estar', 'tecnologia', 'outro')
             and nome_en is null), 0, 'setores iniciais existentes tem nome_en preenchido');
select throws_ok($$update public.setores set nome_en = '' where slug = 'setor-teste-nome-en'$$, '23514', null, 'check rejeita nome_en vazio');
select throws_ok($$update public.setores set nome_en = '   ' where slug = 'setor-teste-nome-en'$$, '23514', null, 'check rejeita nome_en so com espacos');

select tt.anonimo();
select is((select count(*)::int from (select nome, nome_en from public.setores) x) > 0, true, 'anon le nome_en');
reset role;

select tt.como(tt.u('c1'));
select is((select count(*)::int from (select nome, nome_en from public.setores) x) > 0, true, 'authenticated le nome_en');
select is(tt.afeta($q$update public.setores set nome_en = 'Hack' where slug = 'setor-teste-nome-en'$q$), 0,
          'usuario comum nao escreve em setores (0 linhas)');
reset role;

select tt.como(tt.u('51'), 'aal1');
select is(tt.afeta($q$update public.setores set nome_en = 'Sem 2FA' where slug = 'setor-teste-nome-en'$q$), 0,
          'equipe sem aal2 nao escreve em setores');
reset role;

select tt.como(tt.u('51'), 'aal2');
select is(tt.afeta($q$update public.setores set nome_en = 'Test sector' where slug = 'setor-teste-nome-en'$q$), 1,
          'super_admin com aal2 atualiza nome_en');
reset role;

select * from finish();
rollback;

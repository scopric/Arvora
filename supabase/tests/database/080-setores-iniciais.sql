-- Setores iniciais (f1_17): os 8 slugs, nomes, ordem, idempotencia e leitura/escrita. Transacao desfeita.
-- Todos os dados abaixo sao de teste.
begin;
select plan(9);

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

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', 'c1@t.test', '{"nome":"X","maior_18":"true"}'::jsonb);

create temp table esperados(slug text, ordem int) on commit drop;
insert into esperados values ('alimentacao-e-bebidas', 1), ('beleza-e-estetica', 2), ('construcao-e-reformas', 3),
  ('educacao', 4), ('limpeza-e-servicos-domesticos', 5), ('saude-e-bem-estar', 6), ('tecnologia', 7), ('outro', 99);
grant select on esperados to anon, authenticated;

select set_eq($$select slug from public.setores where slug in (select slug from esperados)$$,
              $$select slug from esperados$$, 'existem os 8 slugs iniciais');
select is((select count(*)::int from public.setores s join esperados e using (slug)
           where length(trim(s.nome)) > 0 and length(trim(s.nome_en)) > 0), 8, 'todos tem nome e nome_en');
select results_eq($$select s.slug from public.setores s join esperados e using (slug) order by s.ordem$$,
                  $$select slug from esperados order by ordem$$, 'ordem esperada');

-- Reexecuta o insert da migration com nome diferente: nao duplica nem sobrescreve o nome.
insert into public.setores (nome, slug, ordem, nome_en) values ('Outro nome', 'tecnologia', 7, 'Technology')
on conflict (slug) do update set nome_en = coalesce(public.setores.nome_en, excluded.nome_en);
select is((select count(*)::int from public.setores s join esperados e using (slug)), 8, 'reinsercao nao duplica');
select is((select nome from public.setores where slug = 'tecnologia'), 'Tecnologia', 'reinsercao nao sobrescreve nome');

select tt.anonimo();
select is((select count(*)::int from public.setores s join esperados e using (slug)), 8, 'anon le os setores');
reset role;

select tt.como('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.setores s join esperados e using (slug)), 8, 'authenticated le os setores');
select throws_ok($$insert into public.setores (nome, slug) values ('X', 'tt-x')$$, '42501', null, 'usuario comum nao insere');
select is(tt.afeta($q$update public.setores set nome = 'Hack' where slug = 'outro'$q$), 0, 'usuario comum nao altera');
reset role;

select * from finish();
rollback;

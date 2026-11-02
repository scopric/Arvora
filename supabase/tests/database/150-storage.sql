-- Storage (f2_03): buckets e politicas de storage.objects, testadas direto na tabela (o storage-api aplica o
-- mesmo RLS). Transacao desfeita.
begin;
select plan(21);

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

insert into public.verticais (slug, nome, aceita_entregas) values ('vendas', 'Vendas', true);
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, duracao_min, materiais_publicados_em)
select id, 'gravada', 'A', 'a-st', 'grupo', 10, now() from public.verticais;
insert into public.materiais_aula (aula_id, tipo, arquivo_path, status, aprovado_por, aprovado_em)
select id, 'ebook', id || '/ebook.pdf', 'aprovado', tt.u('ed'), now() from public.aulas;
create function tt.obj(b text, n text) returns void language sql as $$ insert into storage.objects (bucket_id, name) values (b, n) $$;

select is((select string_agg(id || ':' || public::text, ',' order by id) from storage.buckets
           where id in ('entregas', 'materiais', 'comprovantes', 'imagens')),
          'comprovantes:false,entregas:false,imagens:true,materiais:false', 'buckets criados; so imagens e publico');

-- entregas
select tt.como(tt.u('b1'));
select lives_ok($$select tt.obj('entregas', tt.u('b1')::text || '/resp.pdf')$$, 'grupo envia arquivo na propria pasta');
select throws_ok($$select tt.obj('entregas', tt.u('b2')::text || '/x.pdf')$$, '42501', null, 'nao envia na pasta de outro');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'entregas'$q$), 1, 'le o proprio arquivo');
reset role;
select tt.como(tt.u('f1'));
select throws_ok($$select tt.obj('entregas', tt.u('f1')::text || '/x.pdf')$$, '42501', null, 'sem assinatura nao envia');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'entregas'$q$), 0, 'outro membro nao le');
reset role;
select tt.como(tt.u('c0'), 'aal1');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'entregas'$q$), 0, 'corretor sem aal2 nao le');
reset role;
select tt.como(tt.u('c0'), 'aal2');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'entregas'$q$), 1, 'corretor aal2 le para corrigir');
reset role;
select tt.anonimo();
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'entregas'$q$), 0, 'anon nao le');
reset role;

-- materiais
select tt.como(tt.u('b1'));
select throws_ok($$select tt.obj('materiais', '1/x.pdf')$$, '42501', null, 'membro nao envia material');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select lives_ok($$select tt.obj('materiais', (select arquivo_path from public.materiais_aula))$$, 'editor envia material');
select lives_ok($$select tt.obj('materiais', 'solto/rascunho.pdf')$$, 'editor envia arquivo ainda sem material');
reset role;
select tt.como(tt.u('ed'), 'aal1');
select throws_ok($$select tt.obj('materiais', 'solto/x.pdf')$$, '42501', null, 'editor sem aal2 nao envia');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'materiais'$q$), 1, 'grupo le so o arquivo de material aprovado e publicado');
reset role;
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'materiais'$q$), 0, 'clube nao le material do grupo');
reset role;

-- comprovantes
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$select tt.obj('comprovantes', '2026/a.pdf')$$, '42501', null, 'editor nao envia comprovante');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$select tt.obj('comprovantes', '2026/a.pdf')$$, 'super_admin envia comprovante');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'comprovantes'$q$), 1, 'auditor le comprovante');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'comprovantes'$q$), 0, 'membro nao le comprovante');
reset role;

-- imagens
select tt.como(tt.u('b1'));
select throws_ok($$select tt.obj('imagens', 'premiados/1/x.png')$$, '42501', null, 'membro nao envia imagem publica');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select lives_ok($$select tt.obj('imagens', 'premiados/1/x.png')$$, 'editor envia imagem publica');
reset role;

select * from finish();
rollback;

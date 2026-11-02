-- Auditoria de seguranca (f4_06): avatar so de perfil visivel, conexao recusada nao abre perfil,
-- material de curso nao publicado nao sai. Transacao desfeita.
begin;
select plan(10);

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

insert into public.verticais (slug, nome, aceita_entregas) values ('v', 'V', true);

-- M1) avatares ----------------------------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name) values
  ('avatares', tt.u('b1')::text || '/foto.png'),   -- membro ativo com foto_path: visivel
  ('avatares', tt.u('b2')::text || '/solta.png'),  -- arquivo sem perfil apontando: nao sai
  ('avatares', tt.u('f1')::text || '/foto.png');   -- visitante sem assinatura: fora da vitrine
update public.perfis set foto_path = id::text || '/foto.png' where id in (tt.u('b1'), tt.u('f1'));
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 1, 'M1 Clube so ve a foto de perfil que ele pode ver');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares' and name like tt.u('b1')::text || '/%'$q$), 1, 'M1 e a do membro ativo');
reset role;
update public.perfis set suspenso_em = now() where id = tt.u('b1');
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 0, 'M1 membro suspenso: foto some');
reset role;
update public.perfis set suspenso_em = null where id = tt.u('b1');
select tt.como(tt.u('f1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 1, 'M1 dono ve a propria foto');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 3, 'M1 equipe ve todas');
reset role;

-- B1) conexao recusada -----------------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
insert into public.conexoes (destinatario_id, origem) values (tt.u('b2'), 'busca');
reset role;
update public.assinaturas set status = 'canceled' where stripe_subscription_id = 'sub_b2';
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.perfis where id = tt.u('b2')$q$), 1, 'B1 pedido pendente: continua vendo');
reset role;
select tt.como(tt.u('b2'));
select is(tt.afeta($q$update public.conexoes set status = 'recusada' where destinatario_id = auth.uid()$q$), 1, 'B1 destinatario recusa');
reset role;
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.perfis where id = tt.u('b2')$q$), 0, 'B1 recusada: deixa de ver o ex-membro');
reset role;

-- B6) material de curso nao publicado ----------------------------------------------------------------------------------
insert into public.cursos (vertical_id, titulo, slug) select id, 'Curso', 'curso' from public.verticais;
insert into public.modulos (curso_id, titulo, ordem) select id, 'M', 1 from public.cursos where slug = 'curso';
insert into public.aulas (vertical_id, modulo_id, tipo, titulo, slug, nivel_minimo, duracao_min, materiais_publicados_em)
select v.id, m.id, 'gravada', 'De curso', 'de-curso', 'grupo', 30, now() from public.verticais v, public.modulos m;
insert into public.materiais_aula (aula_id, tipo, conteudo_md, status, aprovado_por)
select id, 'resumo', 'x', 'aprovado', tt.u('ed') from public.aulas where slug = 'de-curso';
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.materiais_aula m join public.aulas a on a.id = m.aula_id where a.slug = 'de-curso'$q$), 0,
          'B6 curso nao publicado: material nao sai');
reset role;
update public.cursos set publicado_em = now() where slug = 'curso';
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.materiais_aula m join public.aulas a on a.id = m.aula_id where a.slug = 'de-curso'$q$), 1,
          'B6 curso publicado: material sai');
reset role;

select * from finish();
rollback;

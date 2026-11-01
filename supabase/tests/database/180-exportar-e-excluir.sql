-- Exportacao v2 e exclusao de conta com as tabelas novas (f4_02). "Uma conta excluida nao deixa entrega nem
-- arquivo" (PRD §13 F2). Transacao desfeita.
begin;
select plan(21);

-- O seed de desenvolvimento (supabase/seed.sql) nao entra no teste: apagado aqui, dentro da transacao desfeita no fim.
truncate public.verticais, public.edicoes, public.temas, public.categorias_rede, public.espacos, public.empresas,
  public.documentos_legais, public.planos, public.pedidos_gdpr cascade;
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

insert into public.verticais (slug, nome, aceita_entregas) values ('vendas', 'Vendas', true);
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, duracao_min, materiais_publicados_em)
select id, 'gravada', 'Aula X', 'aula-x', 'grupo', 10, now() from public.verticais;
insert into public.exercicios (aula_id, ordem, enunciado_md, aceita_arquivo) select id, 1, 'E', true from public.aulas;
insert into public.espacos (slug, titulo, nivel_minimo) values ('geral', 'Geral', 'clube');
insert into public.categorias_rede (nome, slug) values ('Contabilidade', 'contabilidade');
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('termos', 'v1', 'pt', 'T', 'x');
insert into public.pagamentos (conta_stripe_id, stripe_invoice_id, perfil_id, cliente_email, moeda, bruto_centavos, pago_em)
values (tt.conta(), 'in_b1', tt.u('b1'), 'b1@t.test', 'EUR', 1230, now());
insert into storage.objects (bucket_id, name) values ('entregas', tt.u('b1')::text || '/resp.pdf');
insert into public.receitas_externas (recebido_em, origem, tipo_receita, perfil_id, cliente_nome, cliente_email, moeda, bruto_centavos, comprovante_path, lancado_por)
values (current_date, 'pix', 'assinatura', tt.u('b1'), 'Titular', 'b1@t.test', 'EUR', 100, '2026/z.pdf', tt.u('51'));

select tt.como(tt.u('b1'));
insert into public.entregas (exercicio_id, perfil_id, texto, arquivo_path)
select id, tt.u('b1'), 'resposta do titular', tt.u('b1')::text || '/resp.pdf' from public.exercicios;
insert into public.posts (espaco_id, corpo) select id, 'post do titular' from public.espacos;
insert into public.comentarios (post_id, corpo) select id, 'comentario do titular' from public.posts;
insert into public.curtidas (post_id) select id from public.posts;
insert into public.network_itens (tipo, categoria_id) select 'oferece', id from public.categorias_rede;
insert into public.conexoes (destinatario_id, origem, mensagem) values (tt.u('b2'), 'busca', 'mensagem do titular');
insert into public.progresso_aula (perfil_id, aula_id, percentual) select tt.u('b1'), id, 50 from public.aulas;
insert into public.perfis_contato (email_contato) values ('contato@x.test');
insert into public.consentimentos (documento_id, perfil_id, titular_email) select id, tt.u('b1'), 'x' from public.documentos_legais;
insert into public.pedidos_gdpr (perfil_id, tipo) values (tt.u('b1'), 'exclusao');
insert into public.denuncias (perfil_denunciado_id, motivo) values (tt.u('c1'), 'spam');
insert into public.empresas (nome, slug, setor_id) select 'Empresa B1', 'empresa-b1', min(id) from public.setores;
insert into public.salvos (aula_id) select id from public.aulas;
reset role;

-- 1) exportacao v2 ------------------------------------------------------------------------------------------
create function tt.exp(s text) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform tt.como(tt.u(s)); r := public.exportar_meus_dados(); reset role; return r; end $$;
select set_config('tt.e', tt.exp('b1')::text, true);
select ok(current_setting('tt.e')::jsonb ?& array['pagamentos', 'consentimentos', 'pedidos_gdpr', 'entregas', 'progresso_aulas',
  'posts', 'comentarios', 'curtidas', 'salvos', 'denuncias_feitas', 'network', 'conexoes', 'sugestoes_match', 'notificacoes',
  'empresas', 'premiados', 'contato'], 'export v2 traz as tabelas novas');
select is(current_setting('tt.e')::jsonb #>> '{assinaturas,0,stripe_subscription_id}', 'sub_b1', 'export traz stripe_subscription_id');
select is(current_setting('tt.e')::jsonb #>> '{entregas,0,texto}', 'resposta do titular', 'export traz a entrega');
select is(current_setting('tt.e')::jsonb #>> '{conexoes,0,mensagem}', 'mensagem do titular', 'export traz a conexao do titular');
select ok(current_setting('tt.e') not like '%' || tt.u('b2')::text || '%' and current_setting('tt.e') not like '%' || tt.u('c1')::text || '%',
          'export nao traz o id de terceiros (conexao, denuncia)');
select is(jsonb_array_length(tt.exp('b2') -> 'conexoes'), 1, 'o outro lado ve a conexao no proprio export');
select is(tt.exp('b2') #>> '{conexoes,0,mensagem}', null, 'mas nao a mensagem escrita pelo titular');

-- 2) arquivos barram a exclusao ---------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.arquivos_do_titular(uuid)', 'execute'), 'membro nao lista arquivos');
set local role service_role;
select is((select count(*)::int from public.arquivos_do_titular(tt.u('b1'))), 1, 'servico lista os arquivos do titular');
reset role;
select throws_ok($$delete from auth.users where id = tt.u('b1')$$, 'P0001', null, 'sobrou arquivo: exclusao barrada');
select is((select count(*)::int from public.perfis where id = tt.u('b1')), 1, 'nada apagado');
-- o servico remove pela API do Storage; aqui, o equivalente em SQL
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'entregas' and name like tt.u('b1')::text || '/%';
select lives_ok($$delete from auth.users where id = tt.u('b1')$$, 'sem arquivo: exclusao passa');

-- 3) o que some e o que fica -------------------------------------------------------------------------------------
select is((select count(*)::int from public.entregas) + (select count(*)::int from public.progresso_aula)
          + (select count(*)::int from public.curtidas) + (select count(*)::int from public.network_itens)
          + (select count(*)::int from public.conexoes) + (select count(*)::int from public.perfis_contato)
          + (select count(*)::int from public.salvos) + (select count(*)::int from public.notificacoes where perfil_id = tt.u('b1')),
          0, 'entregas, progresso, curtidas, network, conexoes, contato, salvos e notificacoes apagados');
select is((select count(*)::int from storage.objects where name like tt.u('b1')::text || '/%'), 0, 'nenhum arquivo do titular');
select ok((select autor_id is null from public.posts) and (select autor_id is null from public.comentarios), 'post e comentario ficam sem autoria');
select is((select titular_email from public.consentimentos where perfil_id is null), 'b1@t.test', 'prova do consentimento fica com o e-mail');
select ok((select perfil_id is null and cliente_email = 'b1@t.test' from public.pagamentos), 'pagamento retido (fiscal) sem o perfil');
select ok((select perfil_id is null from public.pedidos_gdpr), 'pedido GDPR fica como registro do atendimento');
select ok((select perfil_id is null and cliente_email = 'b1@t.test' and anulado_em is null from public.receitas_externas),
          'receita externa retida, sem o perfil e sem ser anulada');
select ok((select denunciante_id is null from public.denuncias), 'denuncia fica anonimizada');
select ok((select dono_perfil_id is null from public.empresas), 'empresa fica sem dono');

select * from finish();
rollback;

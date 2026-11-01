-- Lacunas das telas (f4_05): progresso que nao regride, caminhos seguros, abertura da sala, notificacoes pt/en,
-- autor ve o oculto, recusa de empresa com motivo, suporte do super_admin, editor e consentimento HoF, avatares,
-- denuncia unica, motivo_dados do Match e vitrine so de membros ativos. Transacao desfeita.
begin;
select plan(65);

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

insert into public.verticais (slug, nome, aceita_entregas) values ('v', 'V', true);
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, inicio_em, duracao_min, agendada_em, materiais_publicados_em)
select id, 'ao_vivo', 'Viva', 'viva', 'grupo', now() + interval '2 days', 60, now(), now() from public.verticais;
insert into public.transmissoes (aula_id, url, abre_min_antes) select id, 'https://zoom.exemplo/sala', 15 from public.aulas;
create function tt.aula() returns bigint language sql as $$ select id from public.aulas where slug = 'viva' $$;

-- 1) progresso nao regride ------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
insert into public.progresso_aula (perfil_id, aula_id, percentual) values (tt.u('b1'), tt.aula(), 100);
update public.progresso_aula set percentual = 20, posicao_seg = 5;
select is((select percentual::int || '/' || posicao_seg || '/' || (concluida_em is not null)::text from public.progresso_aula),
          '100/5/true', '1 percentual nao diminui, posicao pode voltar, concluida_em fica');
reset role;

-- 2) caminhos seguros ------------------------------------------------------------------------------------
select throws_ok($$update public.perfis set foto_path = tt.u('b1')::text || '/../x.png' where id = tt.u('b1')$$, '23514', null, '2 foto_path com .. barrado');
select throws_ok($$insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path, lancado_por)
  values (current_date, 'pix', 'ingresso', 'X', 'EUR', 1, '2026//x.pdf', tt.u('51'))$$, '23514', null, '2 comprovante com // barrado');
select throws_ok($$insert into public.materiais_aula (aula_id, tipo, arquivo_path) values (tt.aula(), 'ebook', '1\x.pdf')$$, '23514', null,
                 '2 caminho com barra invertida barrado');
select throws_ok($$insert into public.materiais_aula (aula_id, tipo, arquivo_path) values (tt.aula(), 'ebook', '/1/x.pdf')$$, '23514', null,
                 '2 caminho absoluto barrado');
select lives_ok($$insert into public.materiais_aula (aula_id, tipo, arquivo_path) values (tt.aula(), 'ebook', tt.aula() || '/ebook.pdf')$$,
                '2 caminho relativo normal passa');

-- 3) abertura da sala ------------------------------------------------------------------------------------
select tt.como(tt.u('b1'));
select is(public.abertura_transmissao(tt.aula()), (select inicio_em - interval '15 minutes' from public.aulas where slug = 'viva'),
          '3 membro do Grupo sabe quando a sala abre');
select throws_ok($$select public.link_transmissao(tt.aula())$$, 'P0001', 'ainda_nao_abriu', '3 antes da hora: sem link');
reset role;
create function tt.detalhe() returns text language plpgsql as $$
declare d text;
begin
  perform tt.como(tt.u('b1'));
  perform public.link_transmissao(tt.aula());
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $$;
select is(tt.detalhe(), (select to_char((inicio_em - interval '15 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from public.aulas where slug = 'viva'),
          '3 DETAIL do erro traz o instante de abertura');
reset role;
select tt.como(tt.u('c1'));
select throws_ok($$select public.abertura_transmissao(tt.aula())$$, '42501', 'sem_acesso', '3 Clube nao recebe a abertura da live do Grupo');
reset role;

-- 4) notificacoes pt/en e rota /conexoes ---------------------------------------------------------------------
select tt.como(tt.u('b1'));
insert into public.conexoes (destinatario_id, origem) values (tt.u('b2'), 'busca');
reset role;
select is((select titulo || '|' || titulo_en || '|' || link from public.notificacoes where tipo = 'conexao_recebida'),
          'Novo pedido de conexão|New connection request|/conexoes', '4 titulo com acento, versao em ingles e rota real');
select ok((select bool_and(titulo_en is not null) from public.notificacoes where tipo = 'aula_publicada'), '4 aviso de aula tambem em ingles');

-- 5) autor ve o proprio oculto ---------------------------------------------------------------------------------
insert into public.espacos (slug, titulo, nivel_minimo) values ('geral', 'Geral', 'clube');
select tt.como(tt.u('b1'));
insert into public.posts (espaco_id, corpo) select id, 'post do b1' from public.espacos;
reset role;
select tt.como(tt.u('d0'), 'aal2');
select lives_ok($$select public.moderar_conteudo('post', id, true) from public.posts$$, '5 moderador oculta');
reset role;
select tt.como(tt.u('b1'));
select ok((select oculto_em is not null from public.posts), '5 autor ve o proprio post oculto, com oculto_em');
reset role;
select tt.como(tt.u('b2'));
select is(tt.n('select 1 from public.posts'), 0, '5 outro membro nao ve');
reset role;

-- 7) recusa de empresa com motivo -----------------------------------------------------------------------------
select tt.como(tt.u('c1'));
insert into public.empresas (nome, slug, setor_id) select 'Emp C1', 'emp-c1', min(id) from public.setores;
reset role;
select tt.como(tt.u('d0'), 'aal2');
select lives_ok($$select public.aprovar_empresa(id, false, 'site fora do ar') from public.empresas$$, '7 moderador recusa com motivo');
select is((select motivo_recusa from public.empresas_equipe() where slug = 'emp-c1'), 'site fora do ar', '7 equipe ve o motivo');
reset role;
select tt.como(tt.u('c1'));
select is((select status::text || '|' || motivo_recusa from public.minhas_empresas()), 'rejeitada|site fora do ar', '7 dono ve o motivo');
reset role;
select tt.como(tt.u('b2'));
select throws_ok($$select motivo_recusa from public.empresas$$, '42501', null, '7 motivo nao sai no select comum');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select lives_ok($$select public.aprovar_empresa(id, true) from public.empresas$$, '7 assinatura antiga (2 argumentos) continua valendo');
select is((select motivo_recusa from public.empresas_equipe() where slug = 'emp-c1'), null, '7 aprovar limpa o motivo');
reset role;

-- 8) suporte: super_admin le customer e e-mail ------------------------------------------------------------------
insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email) values (tt.conta(), 'cus_b1', tt.u('b1'), 'b1@t.test');
select tt.como(tt.u('51'), 'aal2');
select is((select stripe_customer_id from public.clientes_stripe where perfil_id = tt.u('b1')), 'cus_b1', '8 super_admin le stripe_customer_id');
select is(public.email_do_membro(tt.u('b2')), 'b2@t.test', '8 super_admin le o e-mail do membro');
reset role;
select ok(exists (select 1 from public.log_admin where acao = 'rpc' and depois->>'rpc' = 'email_do_membro'), '8 consulta do e-mail fica no log');
select tt.como(tt.u('51'), 'aal1');
select throws_ok($$select public.email_do_membro(tt.u('b2'))$$, '42501', null, '8 sem aal2 nao le o e-mail');
select is(tt.n('select 1 from public.clientes_stripe'), 0, '8 sem aal2 nao le clientes_stripe alheio');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select throws_ok($$select public.email_do_membro(tt.u('b2'))$$, '42501', null, '8 auditor nao le o e-mail');
reset role;

-- 9) editor e consentimento hall_of_fame ------------------------------------------------------------------------
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('hall_of_fame', '1', 'pt', 'HoF', 'x'), ('marketing', '1', 'pt', 'Mkt', 'x');
select tt.como(tt.u('ed'), 'aal2');
select lives_ok($$insert into public.consentimentos (documento_id, titular_email, titular_nome, aceito_em, evidencia)
  select id, 'premiada@x.test', 'Premiada', '2025-05-01', 'formulario' from public.documentos_legais where tipo = 'hall_of_fame'$$,
  '9 editor registra consentimento HoF');
select throws_ok($$insert into public.consentimentos (documento_id, titular_email) select id, 'x@x.test' from public.documentos_legais where tipo = 'marketing'$$,
                 '42501', null, '9 editor nao registra outro tipo');
select is(tt.n('select 1 from public.consentimentos'), 1, '9 editor le so os de HoF');
reset role;
select is((select aceito_em::date from public.consentimentos where titular_email = 'premiada@x.test'), '2025-05-01'::date, '9 data do formulario preservada');
select tt.como(tt.u('ed'), 'aal1');
select throws_ok($$insert into public.consentimentos (documento_id, titular_email) select id, 'y@x.test' from public.documentos_legais where tipo = 'hall_of_fame'$$,
                 '42501', null, '9 editor sem aal2 nao registra');
reset role;

-- 10) avatares -------------------------------------------------------------------------------------------------
select is((select public::text from storage.buckets where id = 'avatares'), 'false', '10 bucket avatares privado');
select tt.como(tt.u('b1'));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('avatares', tt.u('b1')::text || '/foto.png')$$, '10 dono envia avatar');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatares', tt.u('b2')::text || '/foto.png')$$, '42501', null, '10 nao envia na pasta de outro');
select is(tt.afeta($q$update public.perfis set foto_path = auth.uid()::text || '/foto.png' where id = auth.uid()$q$), 1, '10 dono grava foto_path');
select throws_ok($$update public.perfis set foto_path = tt.u('b2')::text || '/foto.png' where id = auth.uid()$$, '23514', null, '10 foto_path so na propria pasta');
reset role;
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 1, '10 membro le avatar');
reset role;
select tt.como(tt.u('f1'));
select is(tt.n($q$select 1 from storage.objects where bucket_id = 'avatares'$q$), 0, '10 logado sem assinatura nao le avatar alheio');
reset role;
set local role service_role;
select is((select count(*)::int from public.arquivos_do_titular(tt.u('b1')) where bucket = 'avatares'), 1, '10 avatar entra na lista da exclusao');
reset role;
select throws_ok($$delete from auth.users where id = tt.u('b1')$$, 'P0001', null, '10 avatar no Storage barra a exclusao');

-- 11) denuncia unica enquanto aberta -------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select lives_ok($$insert into public.denuncias (perfil_denunciado_id, motivo) values (tt.u('b2'), 'spam')$$, '11 primeira denuncia');
select throws_ok($$insert into public.denuncias (perfil_denunciado_id, motivo) values (tt.u('b2'), 'outro')$$, '23505', null,
                 '11 mesma pessoa e mesmo alvo com denuncia aberta: 23505');
select lives_ok($$insert into public.denuncias (perfil_denunciado_id, motivo) values (tt.u('b1'), 'spam')$$, '11 outro alvo passa');
reset role;

-- 12) motivo_dados do Match --------------------------------------------------------------------------------------------
delete from public.conexoes;
insert into public.categorias_rede (nome, slug) values ('Contabilidade', 'contabilidade');
update public.perfis set cidade = 'Dublin' where id in (tt.u('b1'), tt.u('b2'));
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('match', '1', 'pt', 'M', 'x');
insert into public.consentimentos (documento_id, perfil_id, titular_email)
select d.id, p, 'x' from public.documentos_legais d, unnest(array[tt.u('b1'), tt.u('b2')]) p where d.tipo = 'match';
insert into public.network_itens (perfil_id, tipo, categoria_id) select tt.u('b1'), 'procura', id from public.categorias_rede;
insert into public.network_itens (perfil_id, tipo, categoria_id) select tt.u('b2'), 'oferece', id from public.categorias_rede;
select is(private.gerar_sugestoes_match(current_date), 2, '12 job gera as sugestoes');
select is((select motivo_dados from public.sugestoes_match where perfil_id = tt.u('b1')),
          jsonb_build_object('categoria_id', (select id from public.categorias_rede), 'tipo', 'oferece', 'mesma_cidade', true,
                             'cidade', 'Dublin', 'mesmo_setor', false), '12 motivo_dados com os ingredientes');
select ok((select motivo like '%você procura%' from public.sugestoes_match where perfil_id = tt.u('b1')), '12 motivo em pt com acento');
select is((select motivo_dados->>'tipo' from public.sugestoes_match where perfil_id = tt.u('b2')), null, '12 sem cruzamento: tipo nulo');

-- 13) vitrine so de membros ativos -----------------------------------------------------------------------------------
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from public.perfis_vitrine where id in (tt.u('51'), tt.u('f1'))$q$), 0, '13 Clube nao ve perfil sem assinatura nem de equipe');
select is(tt.n($q$select 1 from public.perfis_vitrine where id = tt.u('b2')$q$), 1, '13 Clube ve membro ativo');
select is(tt.n('select 1 from public.perfis where id = auth.uid()'), 1, '13 proprio perfil continua visivel');
reset role;
select tt.como(tt.u('b1'));
insert into public.conexoes (destinatario_id, origem) values (tt.u('b2'), 'busca');
reset role;
update public.assinaturas set status = 'canceled' where stripe_subscription_id = 'sub_b2';
select tt.como(tt.u('b1'));
select is(tt.n($q$select 1 from public.perfis where id = tt.u('b2')$q$), 1, '13 parte de conexao continua vendo o outro mesmo sem assinatura');
reset role;
select tt.como(tt.u('c1'));
select is(tt.n($q$select 1 from public.perfis where id = tt.u('b2')$q$), 0, '13 quem nao tem conexao deixa de ver o ex-membro');
reset role;

-- 14) CSV sem injecao de formula ---------------------------------------------------------------------------------------
insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path, lancado_por)
values ('2026-08-12', 'pix', 'ingresso', '=HYPERLINK("x")' || chr(13) || 'fim', 'EUR', 1000, '+2026/r.pdf', tt.u('51')),
       ('2026-08-13', 'pix', 'ingresso', '@soma', 'EUR', 500, '2026/s.pdf', tt.u('51'));
insert into public.reembolsos (tipo, receita_externa_id, moeda, valor_centavos, devolvido_em)
select 'reembolso', id, 'EUR', 300, '2026-08-20T12:00:00Z' from public.receitas_externas where comprovante_path = '2026/s.pdf';
select tt.como(tt.u('a0'), 'aal2');
select set_config('tt.csv', public.relatorio_ciclo('2026-08-10') ->> 'csv', true);
reset role;
select ok(left(current_setting('tt.csv'), 1) = chr(65279), '14 CSV comeca com BOM UTF-8');
select ok(strpos(current_setting('tt.csv'), ';''=HYPERLINK("x") fim;') > 0, '14 campo com = ganha prefixo e \r vira espaco');
select ok(strpos(current_setting('tt.csv'), ';''+2026/r.pdf') > 0, '14 referencia com + ganha prefixo');
select ok(strpos(current_setting('tt.csv'), ';''@soma;') > 0, '14 campo com @ ganha prefixo');
select ok(strpos(current_setting('tt.csv'), ';-300;') > 0 and strpos(current_setting('tt.csv'), ';''-300;') = 0, '14 numero negativo intacto');
select ok(strpos(current_setting('tt.csv'), chr(13)) = 0, '14 nenhum \r no CSV');
select is(private.csv_texto(chr(9) || 'x'), '''' || chr(9) || 'x', '14 tabulacao no inicio ganha prefixo');
select is(private.csv_texto('-x'), '''-x', '14 hifen no inicio ganha prefixo');

-- 15) ultimo super_admin ----------------------------------------------------------------------------------------------
select tt.como(tt.u('51'), 'aal2');
select throws_ok($$delete from public.equipe where perfil_id = tt.u('51')$$, 'P0001', 'ultimo_super_admin', '15 nao remove o ultimo super_admin');
select throws_ok($$update public.equipe set papel = 'editor' where perfil_id = tt.u('51')$$, 'P0001', 'ultimo_super_admin', '15 nao rebaixa o ultimo super_admin');
reset role;
set local role postgres; -- qualquer caminho que nao seja a conexao direta sem SET ROLE (o Auth conecta como supabase_auth_admin)
select throws_ok($$delete from auth.users where id = tt.u('51')$$, 'P0001', 'ultimo_super_admin', '15 exclusao da conta tambem e barrada');
reset role;
update public.equipe set papel = 'super_admin' where perfil_id = tt.u('ed');
select tt.como(tt.u('51'), 'aal2');
select is(tt.afeta($q$update public.equipe set papel = 'editor' where perfil_id = tt.u('51')$q$), 1, '15 com outro super_admin, rebaixa');
reset role;

select * from finish();
rollback;

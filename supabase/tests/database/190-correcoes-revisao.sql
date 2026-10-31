-- Correcoes da revisao (f4_03, f4_04): um bloco por achado (A1, A2, M1-M5, M7, M8, B1-B5, B8). Transacao desfeita.
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

insert into public.verticais (slug, nome, aceita_entregas) values ('v', 'V', true);
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, duracao_min, video_id, materiais_publicados_em)
select id, 'gravada', 'G', 'g', 'grupo', 10, 'VIDEO_GRUPO_SECRETO', now() from public.verticais;
insert into public.aulas (vertical_id, tipo, titulo, slug, nivel_minimo, duracao_min, video_id)
select id, 'gravada', 'R', 'r', 'grupo', 10, 'VIDEO_RASCUNHO' from public.verticais;
insert into public.videos (tipo, titulo, slug, video_id, nivel_minimo, publicado_em) values ('talk', 'T', 't', 'VIDEO_TALK_GRUPO', 'grupo', now());
create function tt.aula(s text) returns bigint language sql as $$ select id from public.aulas where slug = s $$;
create function tt.video() returns bigint language sql as $$ select id from public.videos where slug = 't' $$;

-- A1: video_id ------------------------------------------------------------------------------------------
select tt.como(tt.u('f1'));
select throws_ok($$select video_id from public.aulas$$, '42501', null, 'A1 logado sem assinatura nao le video_id de aulas');
select throws_ok($$select video_id from public.videos$$, '42501', null, 'A1 logado sem assinatura nao le video_id de videos');
select throws_ok($$select public.video_da_aula(tt.aula('g'))$$, '42501', 'sem_acesso', 'A1 RPC nega ao visitante logado');
reset role;
select tt.como(tt.u('c1'));
select throws_ok($$select video_id from public.aulas$$, '42501', null, 'A1 Clube nao le video_id');
select throws_ok($$select public.video_da_aula(tt.aula('g'))$$, '42501', 'sem_acesso', 'A1 Clube nao recebe video da aula do Grupo');
select throws_ok($$select public.video_do_video(tt.video())$$, '42501', 'sem_acesso', 'A1 Clube nao recebe video do Talk do Grupo');
reset role;
select tt.como(tt.u('b1'));
select is(public.video_da_aula(tt.aula('g')), 'VIDEO_GRUPO_SECRETO', 'A1 Grupo recebe o video da aula publicada');
select is(public.video_do_video(tt.video()), 'VIDEO_TALK_GRUPO', 'A1 Grupo recebe o video do Talk');
select throws_ok($$select public.video_da_aula(tt.aula('r'))$$, '42501', 'sem_acesso', 'A1 aula em rascunho nao entrega video ao membro');
reset role;
select tt.como(tt.u('ed'), 'aal2');
select is(public.video_da_aula(tt.aula('r')), 'VIDEO_RASCUNHO', 'A1 editor aal2 le o video do rascunho pela RPC');
select is(tt.afeta($q$update public.aulas set video_id = 'NOVO' where slug = 'r'$q$), 1, 'A1 editor continua escrevendo video_id');
reset role;
select tt.como(tt.u('ed'), 'aal1');
select throws_ok($$select public.video_da_aula(tt.aula('r'))$$, '42501', 'sem_acesso', 'A1 editor sem aal2 nao le');
reset role;
select tt.anonimo();
select throws_ok($$select public.video_da_aula(1)$$, '42501', null, 'A1 anon nao chama a RPC');
reset role;

-- A2: consentimento do proprio -----------------------------------------------------------------------------
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('hall_of_fame', '1', 'pt', 'HOF', 'x');
insert into public.consentimentos (documento_id, perfil_id, titular_email) select id, tt.u('b1'), 'x' from public.documentos_legais;
insert into public.consentimentos (documento_id, titular_email) select id, 'fulana@x.test' from public.documentos_legais;
insert into public.edicoes (slug, nome, ano, pais, cidade, durante_inicio, durante_fim, publicada_em)
values ('e', 'E', 2026, 'IE', 'Dublin', now(), now() + interval '1 day', now());
insert into public.categorias_premio (edicao_id, nome, slug) select id, 'C', 'c' from public.edicoes;
select set_config('tt.cb1', (select id::text from public.consentimentos where perfil_id = tt.u('b1')), true);
select set_config('tt.cf', (select id::text from public.consentimentos where titular_email = 'fulana@x.test'), true);
select tt.como(tt.u('ed'), 'aal2');
select throws_ok($$insert into public.premiados (edicao_id, categoria_id, nome, slug, convite_email, consentimento_id, publicado_em)
  select e.id, c.id, 'Fulana', 'fulana', 'fulana@x.test', current_setting('tt.cb1')::bigint, now()
  from public.edicoes e join public.categorias_premio c on c.edicao_id = e.id$$, 'P0001', 'consentimento_de_outra_pessoa',
  'A2 consentimento de outra pessoa nao publica');
select lives_ok($$insert into public.premiados (edicao_id, categoria_id, nome, slug, convite_email, consentimento_id, publicado_em)
  select e.id, c.id, 'Fulana', 'fulana', 'FULANA@x.test', current_setting('tt.cf')::bigint, now()
  from public.edicoes e join public.categorias_premio c on c.edicao_id = e.id$$, 'A2 consentimento pelo e-mail do convite publica');
select throws_ok($$insert into public.premiados (edicao_id, categoria_id, nome, slug, convite_email, consentimento_id)
  select e.id, c.id, 'Fulana 2', 'fulana-2', 'fulana@x.test', current_setting('tt.cf')::bigint
  from public.edicoes e join public.categorias_premio c on c.edicao_id = e.id$$, '23505', null, 'A2 um consentimento por premiado');
select throws_ok($$insert into public.indicados (edicao_id, categoria_id, nome, convite_email, consentimento_id, publicado_em)
  select e.id, c.id, 'Fulana', 'outra@x.test', current_setting('tt.cf')::bigint, now()
  from public.edicoes e join public.categorias_premio c on c.edicao_id = e.id$$, 'P0001', 'consentimento_de_outra_pessoa',
  'A2 indicado tambem exige o proprio consentimento');
reset role;
select tt.como(tt.u('b2'));
select throws_ok($$select convite_email from public.indicados$$, '42501', null, 'A2 convite_email do indicado nao sai por select');
reset role;

-- M1, M2, B1: financeiro ------------------------------------------------------------------------------------
select tt.como(tt.u('51'), 'aal2');
insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path)
values ('2026-08-12', 'pix', 'ingresso', 'Ext', 'EUR', 10000, '2026/r.pdf');
insert into public.reembolsos (tipo, receita_externa_id, moeda, valor_centavos, devolvido_em)
select 'reembolso', id, 'EUR', 10000, '2026-08-20T12:00:00Z' from public.receitas_externas where comprovante_path = '2026/r.pdf';
select throws_ok($$update public.receitas_externas set motivo_anulacao = 'lancado errado' where comprovante_path = '2026/r.pdf'$$,
                 'P0001', 'receita_com_estorno', 'M1 receita estornada nao se anula');
insert into public.receitas_externas (recebido_em, origem, tipo_receita, cliente_nome, moeda, bruto_centavos, comprovante_path)
values ('2026-07-12', 'pix', 'ingresso', 'Ext', 'BRL', 99999, '2026/b.pdf');
select throws_ok($$select public.fechar_ciclo('2026-07-10')$$, 'P0001', 'ciclo_com_pendencias', 'M2 nao fecha com cambio ausente');
reset role;
insert into public.pagamentos (conta_stripe_id, stripe_payment_intent_id, cliente_email, moeda, bruto_centavos, pago_em)
values (tt.conta(), 'pi_avulso', 'x@x.test', 'EUR', 500, '2026-06-15T12:00:00Z');
insert into public.pagamentos_itens (pagamento_id, tipo_receita, bruto_centavos) select id, 'produto_digital', 500 from public.pagamentos;
select tt.como(tt.u('51'), 'aal2');
select throws_ok($$select public.fechar_ciclo('2026-06-10')$$, 'P0001', 'ciclo_com_pendencias', 'M2 nao fecha com item sem plano');
reset role;
select tt.como(tt.u('a0'), 'aal2');
select throws_ok($$select public.classificar_item_pagamento(1, 1)$$, '42501', null, 'M2 auditor nao classifica item');
reset role;
select tt.como(tt.u('51'), 'aal2');
select lives_ok($$select public.classificar_item_pagamento(i.id, tt.plano('price_t_clube')) from public.pagamentos_itens i$$,
                'M2 super_admin classifica o item');
select is((select versao from public.fechar_ciclo('2026-06-10')), 1, 'M2 sem pendencia, fecha');
insert into public.receitas_externas (recebido_em, origem, tipo_receita, plano_id, cliente_nome, moeda, bruto_centavos, comprovante_path)
values (current_date, 'pix', 'assinatura', tt.plano('price_t_grupo'), 'Um so pagamento', 'EUR', 100, '2026/u.pdf');
select throws_ok($$select public.conceder_acesso_manual(tt.u('f1'), tt.plano('price_t_clube'), (select id from public.receitas_externas where comprovante_path = '2026/u.pdf'), now() + interval '30 days')$$,
                 'P0001', 'receita_invalida', 'B1 plano tem de ser o da receita');
select ok(public.conceder_acesso_manual(tt.u('f1'), tt.plano('price_t_grupo'), (select id from public.receitas_externas where comprovante_path = '2026/u.pdf'), now() + interval '30 days') > 0,
          'B1 concede uma vez');
select throws_ok($$select public.conceder_acesso_manual(tt.u('a0'), tt.plano('price_t_grupo'), (select id from public.receitas_externas where comprovante_path = '2026/u.pdf'), now() + interval '30 days')$$,
                 'P0001', 'receita_ja_usada', 'B1 a mesma receita nao libera segundo acesso');
reset role;

-- M3: contato --------------------------------------------------------------------------------------------
insert into public.perfis_contato (perfil_id, email_contato) values (tt.u('b2'), 'b2priv@x.test');
insert into public.conexoes (solicitante_id, destinatario_id, origem) values (tt.u('b1'), tt.u('b2'), 'busca');
select tt.como(tt.u('b2'));
select is(tt.afeta($q$update public.conexoes set status = 'aceita'$q$), 1, 'M3 conexao aceita');
reset role;
update public.assinaturas set status = 'canceled' where stripe_subscription_id = 'sub_b1';
select tt.como(tt.u('b1'));
select throws_ok($$select * from public.revelar_contato(tt.u('b2'))$$, '42501', null, 'M3 cancelou o Grupo: contato nao sai');
reset role;
update public.assinaturas set status = 'active' where stripe_subscription_id = 'sub_b1';
update public.perfis set suspenso_em = now() where id = tt.u('b2');
select tt.como(tt.u('b1'));
select throws_ok($$select * from public.revelar_contato(tt.u('b2'))$$, '42501', null, 'M3 outro suspenso: contato nao sai');
reset role;
update public.perfis set suspenso_em = null where id = tt.u('b2');
select tt.como(tt.u('b1'));
select is((select email_contato from public.revelar_contato(tt.u('b2'))), 'b2priv@x.test', 'M3 os dois no Grupo: contato sai');
reset role;

-- M4: log so com o que mudou --------------------------------------------------------------------------------
select tt.como(tt.u('d0'), 'aal2');
select lives_ok($$select public.suspender_perfil(tt.u('c1'), true)$$, 'M4 moderador suspende');
reset role;
select is((select string_agg(k, ',' order by k) from public.log_admin l, jsonb_object_keys(l.depois) k
           where l.tabela = 'perfis' and l.alvo_id = tt.u('c1')::text), 'suspenso_em', 'M4 update registra so a coluna alterada');

-- B5: sugestao some ------------------------------------------------------------------------------------------
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md) values ('match', '1', 'pt', 'M', 'x');
insert into public.consentimentos (documento_id, perfil_id, titular_email)
select d.id, p, 'x' from public.documentos_legais d, unnest(array[tt.u('b1'), tt.u('b2')]) p where d.tipo = 'match';
delete from public.conexoes;
insert into public.sugestoes_match (perfil_id, sugerido_id, semana, pontuacao, motivo) values (tt.u('b1'), tt.u('b2'), current_date, 1, 'x');
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.sugestoes_match'), 1, 'B5 sugestao visivel com os dois no Match');
reset role;
update public.consentimentos c set revogado_em = now() from public.documentos_legais d
where d.id = c.documento_id and d.tipo = 'match' and c.perfil_id = tt.u('b2');
select tt.como(tt.u('b1'));
select is(tt.n('select 1 from public.sugestoes_match'), 0, 'B5 sugerido revogou: sugestao some');
reset role;

-- B2: material aprovado nao troca o arquivo ----------------------------------------------------------------------
insert into public.materiais_aula (aula_id, tipo, arquivo_path, status, aprovado_por, aprovado_em)
values (tt.aula('g'), 'ebook', 'g/ebook.pdf', 'aprovado', tt.u('ed'), now());
insert into storage.objects (bucket_id, name) values ('materiais', 'g/ebook.pdf'), ('materiais', 'g/solto.pdf');
select tt.como(tt.u('ed'), 'aal2');
select is(tt.afeta($q$update storage.objects set metadata = '{"x":1}' where bucket_id = 'materiais' and name = 'g/ebook.pdf'$q$), 0,
          'B2 arquivo de material aprovado nao se troca');
select is(tt.afeta($q$update storage.objects set metadata = '{"x":1}' where bucket_id = 'materiais' and name = 'g/solto.pdf'$q$), 1,
          'B2 arquivo sem material aprovado se troca');
reset role;

-- B3: post com denuncia aberta ------------------------------------------------------------------------------------
insert into public.espacos (slug, titulo, nivel_minimo) values ('geral', 'Geral', 'clube');
select tt.como(tt.u('b1'));
insert into public.posts (espaco_id, corpo) select id, 'post' from public.espacos;
reset role;
select tt.como(tt.u('b2'));
insert into public.denuncias (post_id, motivo) select id, 'spam' from public.posts;
reset role;
select tt.como(tt.u('b1'));
select is(tt.afeta($q$delete from public.posts$q$), 0, 'B3 autor nao apaga post com denuncia aberta');
reset role;

-- B4 e B8: colunas fora da vitrine ----------------------------------------------------------------------------------
select tt.anonimo();
select throws_ok($$select transmissao_url from public.edicoes$$, '42501', null, 'B4 anon nao le transmissao_url');
select throws_ok($$select gravacao_video_id from public.edicoes$$, '42501', null, 'B4 anon nao le gravacao_video_id');
select throws_ok($$select publicado_por from public.documentos_legais$$, '42501', null, 'B4 anon nao le publicado_por');
select is((select fase from public.edicoes_publicas where slug = 'e'), 'durante', 'B4 anon le a fase pela view edicoes_publicas');
reset role;
insert into public.empresas (nome, slug, setor_id) select 'Emp', 'emp', min(id) from public.setores;
update public.empresas set status = 'publicada', dono_perfil_id = tt.u('b1') where slug = 'emp';
select tt.como(tt.u('b2'));
select throws_ok($$select dono_perfil_id from public.empresas$$, '42501', null, 'B8 membro nao le o dono de empresa alheia');
select is((select count(*)::int from public.minhas_empresas()), 0, 'B8 minhas_empresas so traz as do dono');
select throws_ok($$select * from public.empresas_equipe()$$, '42501', null, 'B8 membro nao usa empresas_equipe');
reset role;
select tt.como(tt.u('b1'));
select is((select dono_perfil_id from public.minhas_empresas()), tt.u('b1'), 'B8 dono ve a propria');
reset role;
select tt.como(tt.u('d0'), 'aal2');
select is((select dono_perfil_id from public.empresas_equipe() where slug = 'emp'), tt.u('b1'), 'B8 equipe ve o dono');
reset role;

-- M7 e M8: export e exclusao ----------------------------------------------------------------------------------------
insert into public.consentimentos (documento_id, titular_email) select id, 'b1@t.test' from public.documentos_legais where tipo = 'hall_of_fame';
select tt.como(tt.u('b1'));
select set_config('tt.e', public.exportar_meus_dados()::text, true);
reset role;
select ok(current_setting('tt.e')::jsonb ?& array['indicados', 'receitas_externas', 'reembolsos', 'log_equipe'], 'M7 export traz as chaves novas');
select is((select count(*)::int from jsonb_array_elements(current_setting('tt.e')::jsonb -> 'consentimentos') c where c->>'tipo' = 'hall_of_fame'), 2,
          'M7 export inclui consentimento registrado pelo e-mail');
update public.assinaturas set perfil_id = null where perfil_id = tt.u('c1');
delete from auth.users where id = tt.u('b1');
select is((select count(*)::int from public.consentimentos c join public.documentos_legais d on d.id = c.documento_id
           where d.tipo = 'match' and c.titular_email = 'b1@t.test' and c.revogado_em is not null), 1, 'M8 exclusao revoga o Match');
delete from auth.users where id = tt.u('c1');
select is((select count(*)::int from public.log_admin where alvo_id = tt.u('c1')::text or depois::text like '%' || tt.u('c1')::text || '%'), 0,
          'M4 exclusao anonimiza o log do titular');
select ok((select count(*) from public.log_admin where tabela = 'perfis' and acao = 'update' and alvo_id is null) >= 1,
          'M4 a linha do log fica (quem fez e quando), sem o titular');

select * from finish();
rollback;

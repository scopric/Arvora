-- SO DESENVOLVIMENTO LOCAL (roda no `supabase db reset`). Nunca vai para producao (Erros 6.1).
-- Os setores iniciais sao dado de referencia e vem da migration f1_17; nao recria-los aqui.
-- Tudo abaixo e FICTICIO e marcado como exemplo: pessoas, empresas, premiados, textos legais, conta Stripe e plano.
-- Conta de demonstracao (so local): demo@exemplo.invalid / senha-demo-local, nivel Grupo.

-- Conta Stripe e plano de exemplo (Price inexistente no Stripe; valor zero de proposito).
insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_exemplo_local', 'Conta de exemplo (local)', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_exemplo_grupo', 'Grupo (exemplo local)', 'grupo', 'mes', 'assinatura', 0, 'EUR'
from public.contas_stripe where stripe_account_id = 'acct_exemplo_local';

-- Usuario demo (o Auth exige os tokens como texto vazio, nao nulo).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000de00', 'authenticated', 'authenticated',
        'demo@exemplo.invalid', extensions.crypt('senha-demo-local', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{"nome":"Membro de exemplo","maior_18":"true"}', now(), now(),
        '', '', '', '');
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000de00', '00000000-0000-0000-0000-00000000de00',
        '{"sub":"00000000-0000-0000-0000-00000000de00","email":"demo@exemplo.invalid","email_verified":true}',
        'email', now(), now(), now());
update public.perfis set cidade = 'Dublin', pais = 'IE', empresa_nome = 'Empresa de exemplo',
                         setor_id = (select id from public.setores where slug = 'tecnologia'), onboarding_em = now()
where id = '00000000-0000-0000-0000-00000000de00';
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select '00000000-0000-0000-0000-00000000de00', p.conta_stripe_id, 'sub_exemplo_local', p.id, 'active', now(), now() + interval '1 year'
from public.planos p where p.stripe_price_id = 'price_exemplo_grupo';

-- Textos legais de EXEMPLO (os reais sao das Contratantes e do solicitor).
insert into public.documentos_legais (tipo, versao, idioma, titulo, conteudo_md)
select t::public.tipo_documento, 'exemplo-0', 'pt', 'Texto de exemplo: ' || t, 'TEXTO DE EXEMPLO, sem valor juridico.'
from unnest(array['termos', 'privacidade', 'cookies', 'reembolso', 'arrependimento', 'marketing', 'match', 'hall_of_fame']) t;

-- Verticais (nomes de trabalho).
insert into public.verticais (slug, nome, nome_en, ordem, aceita_entregas, conta_como_ia) values
  ('vendas-e-negociacao', 'Vendas e negociação', 'Sales and negotiation', 1, true, false),
  ('bem-estar', 'Bem-Estar (nome de trabalho)', 'Wellbeing (working name)', 2, false, false),
  ('ia-para-negocios', 'IA para negócios', 'AI for business', 3, true, true);

-- Curso com dois modulos e tres aulas gravadas.
insert into public.cursos (vertical_id, titulo, slug, descricao, nivel_minimo, ordem, publicado_em)
select id, 'Fundamentos de vendas (exemplo)', 'fundamentos-de-vendas', 'Curso de exemplo para as telas.', 'grupo', 1, now()
from public.verticais where slug = 'vendas-e-negociacao';
insert into public.modulos (curso_id, titulo, ordem)
select c.id, m.t, m.o from public.cursos c, (values ('Prospecção', 1), ('Fechamento', 2)) m(t, o)
where c.slug = 'fundamentos-de-vendas';
insert into public.aulas (modulo_id, vertical_id, tipo, titulo, slug, descricao, nivel_minimo, ordem, duracao_min,
                          video_id, trailer_video_id, materiais_publicados_em)
select m.id, c.vertical_id, 'gravada', a.t, a.s, 'Aula de exemplo.', a.n::public.nivel_acesso, a.o, a.d,
       'video-exemplo-' || a.s, 'trailer-exemplo-' || a.s, now()
from public.cursos c join public.modulos m on m.curso_id = c.id
join (values (1, 'Como achar clientes', 'como-achar-clientes', 'clube', 1, 18),
             (1, 'Primeira conversa', 'primeira-conversa', 'grupo', 2, 25),
             (2, 'Objeções comuns', 'objecoes-comuns', 'grupo', 1, 30)) a(modulo, t, s, n, o, d) on a.modulo = m.ordem
where c.slug = 'fundamentos-de-vendas';

-- Aulas semanais: uma gravada com materiais e exercicio, uma ao vivo na proxima semana.
insert into public.aulas (vertical_id, tipo, titulo, slug, descricao, nivel_minimo, inicio_em, duracao_min, video_id,
                          agendada_em, materiais_publicados_em)
select v.id, a.tipo::public.tipo_aula, a.t, a.s, 'Aula semanal de exemplo.', 'grupo', a.ini, 60, a.vid, now(), a.pub
from public.verticais v,
     (values ('gravada', 'Negociar preço (exemplo)', 'negociar-preco', now() - interval '6 days', 'video-exemplo-negociar', now()),
             ('ao_vivo', 'Live: proposta comercial (exemplo)', 'live-proposta-comercial', now() + interval '7 days', null, null))
     a(tipo, t, s, ini, vid, pub)
where v.slug = 'vendas-e-negociacao';
insert into public.transmissoes (aula_id, url, url_reserva)
select id, 'https://zoom.exemplo.invalid/sala-principal', 'https://meet.exemplo.invalid/sala-reserva'
from public.aulas where slug = 'live-proposta-comercial';
insert into public.materiais_aula (aula_id, tipo, conteudo_md, status, aprovado_por, aprovado_em)
select a.id, m.t::public.tipo_material, m.c, 'aprovado', '00000000-0000-0000-0000-00000000de00', now()
from public.aulas a, (values ('resumo', 'Resumo de exemplo.'), ('ebook', 'E-book de exemplo.'), ('exercicios', 'Exercícios de exemplo.')) m(t, c)
where a.slug = 'negociar-preco';
insert into public.exercicios (aula_id, ordem, enunciado_md, prazo_dias, aceita_arquivo)
select id, 1, 'Escreva como você responderia a um pedido de desconto (exemplo).', 7, true
from public.aulas where slug = 'negociar-preco';

-- Comunidade.
insert into public.espacos (slug, titulo, titulo_en, descricao, nivel_minimo, ordem) values
  ('geral', 'Geral', 'General', 'Espaço aberto a Clube e Grupo (proposta).', 'clube', 1),
  ('grupo', 'Grupo Árvora', 'Árvora Group', 'Espaço só do Grupo (proposta).', 'grupo', 2);
insert into public.posts (espaco_id, autor_id, corpo)
select id, '00000000-0000-0000-0000-00000000de00', 'Post de exemplo: alguém aqui já vendeu para o setor público na Irlanda?'
from public.espacos where slug = 'geral';
insert into public.comentarios (post_id, autor_id, corpo)
select id, '00000000-0000-0000-0000-00000000de00', 'Comentário de exemplo.' from public.posts;

-- Directory: empresas de exemplo publicadas.
insert into public.empresas (nome, slug, setor_id, cidade, pais, site, descricao)
select e.n, e.s, (select id from public.setores where slug = e.setor), 'Dublin', 'IE', 'https://exemplo.invalid', 'Empresa fictícia de exemplo.'
from (values ('Construtora Exemplo', 'construtora-exemplo', 'construcao-e-reformas'),
             ('Tech Exemplo', 'tech-exemplo', 'tecnologia'),
             ('Sabor Exemplo', 'sabor-exemplo', 'alimentacao-e-bebidas')) e(n, s, setor);
-- o gatilho grava como pendente; o seed publica direto (sem RPC, que exige equipe com 2FA)
update public.empresas set status = 'publicada', aprovada_em = now() where slug like '%-exemplo';

-- Brazilian Awards: edicao de exemplo com premiados ficticios (consentimento de exemplo registrado).
insert into public.edicoes (slug, nome, ano, pais, cidade, descricao, durante_inicio, durante_fim, publicada_em)
values ('exemplo-dublin-2025', 'Edição de exemplo (Dublin 2025)', 2025, 'IE', 'Dublin', 'Edição fictícia para as telas.',
        '2025-11-15T18:00:00Z', '2025-11-15T23:00:00Z', now());
insert into public.categorias_premio (edicao_id, nome, slug, ordem)
select e.id, c.n, c.s, c.o from public.edicoes e,
  (values ('Empreendedor do ano (exemplo)', 'empreendedor-do-ano', 1), ('Inovação (exemplo)', 'inovacao', 2)) c(n, s, o)
where e.slug = 'exemplo-dublin-2025';
insert into public.consentimentos (documento_id, titular_email, titular_nome, aceito_em, evidencia)
select d.id, p.e, p.n, now(), 'exemplo local'
from public.documentos_legais d,
     (values ('premiado1@exemplo.invalid', 'Premiada de exemplo'), ('premiado2@exemplo.invalid', 'Premiado de exemplo')) p(e, n)
where d.tipo = 'hall_of_fame';
insert into public.premiados (edicao_id, categoria_id, empresa_id, nome, slug, historia, redes, consentimento_id, publicado_em)
select e.id, c.id, (select id from public.empresas where slug = p.emp), p.n, p.s, 'História fictícia de exemplo.', '{}',
       (select id from public.consentimentos where titular_email = p.e), now()
from public.edicoes e
join public.categorias_premio c on c.edicao_id = e.id
join (values ('empreendedor-do-ano', 'Premiada de exemplo', 'premiada-de-exemplo', 'premiado1@exemplo.invalid', 'construtora-exemplo'),
             ('inovacao', 'Premiado de exemplo', 'premiado-de-exemplo', 'premiado2@exemplo.invalid', 'tech-exemplo'))
     p(cat, n, s, e, emp) on p.cat = c.slug
where e.slug = 'exemplo-dublin-2025';
insert into public.patrocinadores (edicao_id, nome, descricao, nivel, ordem)
select id, 'Patrocinador de exemplo', 'Patrocinador fictício.', 'ouro (exemplo)', 1 from public.edicoes where slug = 'exemplo-dublin-2025';
insert into public.agenda_evento (edicao_id, inicio_em, titulo, local)
select id, '2025-11-15T18:30:00Z', 'Cerimônia (exemplo)', 'Dublin' from public.edicoes where slug = 'exemplo-dublin-2025';

-- Biblioteca: temas e um Talk.
insert into public.temas (nome, nome_en, slug, ordem) values
  ('Abrir empresa', 'Starting a company', 'abrir-empresa', 1), ('Tributação', 'Taxes', 'tributacao', 2),
  ('Marketing', 'Marketing', 'marketing', 3), ('Internacionalização', 'Going global', 'internacionalizacao', 4);
insert into public.videos (tipo, titulo, slug, descricao, tema_id, edicao_id, video_id, trailer_video_id, duracao_min, nivel_minimo, publicado_em)
select 'talk', 'Talk de exemplo: tributação na Irlanda', 'talk-exemplo-tributacao', 'Vídeo fictício.', t.id, e.id,
       'video-exemplo-talk', 'trailer-exemplo-talk', 20, 'clube', now()
from public.temas t, public.edicoes e where t.slug = 'tributacao' and e.slug = 'exemplo-dublin-2025';
insert into public.videos_citados (video_id, premiado_id)
select v.id, p.id from public.videos v, public.premiados p where v.slug = 'talk-exemplo-tributacao' and p.slug = 'premiado-de-exemplo';

-- Rede: categorias (proposta do PRD NET-01) e o que o demo oferece.
insert into public.categorias_rede (nome, nome_en, slug, ordem) values
  ('Investidores', 'Investors', 'investidores', 1), ('Parceiros', 'Partners', 'parceiros', 2), ('Clientes', 'Clients', 'clientes', 3),
  ('Contabilidade', 'Accounting', 'contabilidade', 4), ('Tecnologia', 'Technology', 'tecnologia', 5),
  ('Imobiliário', 'Real estate', 'imobiliario', 6), ('Jurídico', 'Legal', 'juridico', 7);
insert into public.network_itens (perfil_id, tipo, categoria_id, texto)
select '00000000-0000-0000-0000-00000000de00', 'oferece', id, 'Exemplo: desenvolvimento de sites.'
from public.categorias_rede where slug = 'tecnologia';

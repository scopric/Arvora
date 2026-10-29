-- Setores iniciais: DADO DE REFERENCIA (o seletor de setor do Perfil depende deles), nao dado de
-- desenvolvimento. Antes so existiam em seed.sql, que `db push` nao carrega; o seed nao os cria mais.
-- A lista real e decisao do contratante; alterar depois por migration nova ou pela equipe.
-- Idempotente: slug existente (banco que rodou o seed antigo) nao duplica nem tem nome/ordem
-- sobrescritos (podem ter sido editados pela equipe); so recebe nome_en se ainda estiver nulo.
-- RLS, grants e politicas ficam como estao.
insert into public.setores (nome, slug, ordem, nome_en) values
  ('Alimentação e bebidas', 'alimentacao-e-bebidas', 1, 'Food and beverage'),
  ('Beleza e estética', 'beleza-e-estetica', 2, 'Beauty and aesthetics'),
  ('Construção e reformas', 'construcao-e-reformas', 3, 'Construction and renovation'),
  ('Educação', 'educacao', 4, 'Education'),
  ('Limpeza e serviços domésticos', 'limpeza-e-servicos-domesticos', 5, 'Cleaning and household services'),
  ('Saúde e bem-estar', 'saude-e-bem-estar', 6, 'Health and wellness'),
  ('Tecnologia', 'tecnologia', 7, 'Technology'),
  ('Outro', 'outro', 99, 'Other')
on conflict (slug) do update set nome_en = coalesce(public.setores.nome_en, excluded.nome_en);

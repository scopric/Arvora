-- SO DESENVOLVIMENTO LOCAL (roda no `supabase db reset`). Nunca vai para producao (Erros 6.1).
-- A lista real de setores e decisao do contratante; estes sao exemplos para as telas.
insert into public.setores (nome, slug, ordem) values
  ('Alimentação e bebidas', 'alimentacao-e-bebidas', 1),
  ('Beleza e estética', 'beleza-e-estetica', 2),
  ('Construção e reformas', 'construcao-e-reformas', 3),
  ('Educação', 'educacao', 4),
  ('Limpeza e serviços domésticos', 'limpeza-e-servicos-domesticos', 5),
  ('Saúde e bem-estar', 'saude-e-bem-estar', 6),
  ('Tecnologia', 'tecnologia', 7),
  ('Outro', 'outro', 99);

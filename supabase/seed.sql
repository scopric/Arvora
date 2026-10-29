-- SO DESENVOLVIMENTO LOCAL (roda no `supabase db reset`). Nunca vai para producao (Erros 6.1).
-- A lista real de setores e decisao do contratante; estes sao exemplos para as telas.
insert into public.setores (nome, slug, ordem, nome_en) values
  ('Alimentação e bebidas', 'alimentacao-e-bebidas', 1, 'Food and beverage'),
  ('Beleza e estética', 'beleza-e-estetica', 2, 'Beauty and aesthetics'),
  ('Construção e reformas', 'construcao-e-reformas', 3, 'Construction and renovation'),
  ('Educação', 'educacao', 4, 'Education'),
  ('Limpeza e serviços domésticos', 'limpeza-e-servicos-domesticos', 5, 'Cleaning and household services'),
  ('Saúde e bem-estar', 'saude-e-bem-estar', 6, 'Health and wellness'),
  ('Tecnologia', 'tecnologia', 7, 'Technology'),
  ('Outro', 'outro', 99, 'Other');

-- SO DESENVOLVIMENTO LOCAL (roda no `supabase db reset`). Nunca vai para producao (Erros 6.1).
-- A lista real de setores e decisao do contratante; estes sao exemplos para as telas.
insert into public.setores (nome, slug, ordem) values
  ('Alimentacao e bebidas', 'alimentacao-e-bebidas', 1),
  ('Beleza e estetica', 'beleza-e-estetica', 2),
  ('Construcao e reformas', 'construcao-e-reformas', 3),
  ('Educacao', 'educacao', 4),
  ('Limpeza e servicos domesticos', 'limpeza-e-servicos-domesticos', 5),
  ('Saude e bem-estar', 'saude-e-bem-estar', 6),
  ('Tecnologia', 'tecnologia', 7),
  ('Outro', 'outro', 99);

-- Nome do setor em ingles (site bilingue). Nula: o front cai no nome em portugues quando faltar.
-- RLS, grants e politicas ficam como estao: a coluna herda o select liberado e a escrita so da equipe.
alter table public.setores
  add column nome_en text check (nome_en is null or length(trim(nome_en)) between 1 and 120);

-- Traducao dos setores iniciais (rascunho; o cliente revisa). Setor de outro slug fica com nome_en nulo.
update public.setores s set nome_en = v.nome_en
from (values
  ('alimentacao-e-bebidas', 'Food and beverage'),
  ('beleza-e-estetica', 'Beauty and aesthetics'),
  ('construcao-e-reformas', 'Construction and renovation'),
  ('educacao', 'Education'),
  ('limpeza-e-servicos-domesticos', 'Cleaning and household services'),
  ('saude-e-bem-estar', 'Health and wellness'),
  ('tecnologia', 'Technology'),
  ('outro', 'Other')
) v(slug, nome_en)
where s.slug = v.slug;

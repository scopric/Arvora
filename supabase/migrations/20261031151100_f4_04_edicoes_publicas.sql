-- Complemento da f4_03 (B4): com o select por coluna de anon em edicoes, o campo calculado public.fase(edicoes)
-- deixa de funcionar para anon (ele recebe a linha inteira). As paginas publicas passam a ler esta view, que ja
-- traz a fase. security_invoker: vale o RLS de edicoes (so publicadas para anon) e o grant por coluna.
-- authenticated continua podendo usar public.fase na tabela.
create view public.edicoes_publicas with (security_invoker = true) as
  select id, slug, nome, ano, pais, cidade, descricao, durante_inicio, durante_fim, publicada_em,
         public.fase_edicao(durante_inicio, durante_fim) as fase
  from public.edicoes;
grant select on public.edicoes_publicas to anon, authenticated;

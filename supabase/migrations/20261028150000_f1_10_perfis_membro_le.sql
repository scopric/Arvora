-- Membro (nivel Clube/Grupo) le perfis de outros membros: visibilidade membros ou publico, nao suspenso
-- (PRD 9.1.0; prometida na f1_05). Papel de equipe nao conta: equipe ja tem perfis_equipe_le.
-- O bloqueio entre membros entra com o NET-05 (ainda nao existe).
-- Colunas: o grant por coluna da f1_03 continua valendo (maior_18_em nao sai).
-- ATENCAO: o comentario da f1_03 dizendo que suspenso_em e publico_aprovado_em so o dono e a equipe veem
-- deixa de valer com esta politica: o membro passa a ler publico_aprovado_em, onboarding_em, criado_em e
-- atualizado_em de perfis alheios (suspenso_em vem sempre nulo nessas linhas). Risco baixo (nenhuma tela lista
-- outros membros ainda). Antes do diretorio de membros existir, a leitura dele deve passar por view ou RPC
-- so com as colunas de vitrine (minimizacao, GDPR art. 5(1)(c)); ver Pendencias e Decisoes 24 no cofre.
create policy perfis_membro_le on public.perfis for select to authenticated
  using (visibilidade in ('membros', 'publico') and suspenso_em is null and (select public.tem_acesso('clube')));

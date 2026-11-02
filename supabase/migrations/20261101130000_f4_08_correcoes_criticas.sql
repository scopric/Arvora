-- Correcoes da varredura (f4_08): tarefa e live so do Grupo, link da live com reserva vazia e espacos da comunidade
-- como dado de referencia (antes so existiam no seed local).

-- 1) Entregar tarefa e coisa do Grupo (PRD §5), mesmo que a aula tenha nivel_minimo 'clube'.
-- Atencao: pode_entregar tambem esta no with check do UPDATE de entregas (reenvio). Membro que cair para Clube depois de
-- entregar deixa de poder reenviar; e coerente com o PRD §5 (a tela esconde o formulario nesse caso).
create or replace function private.pode_entregar(p_exercicio bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.exercicios e
                 join public.aulas a on a.id = e.aula_id
                 join public.verticais v on v.id = a.vertical_id
                 where e.id = p_exercicio and a.materiais_publicados_em is not null and v.aceita_entregas
                   and (select public.tem_acesso('grupo')));
$$;

-- 2) Live (aula ao vivo) e so do Grupo. NOT VALID: linhas antigas nao sao reverificadas (a migration nao falha em banco
-- com dados antigos); toda aula nova ou alterada passa pelo check. Passo de producao (depois do deploy):
--   1) consulta so de leitura: select id, slug, nivel_minimo from public.aulas where tipo = 'ao_vivo' and nivel_minimo <> 'grupo';
--   2) se vier linha, a equipe (editor) corrige o nivel dessas aulas;
--   3) alter table public.aulas validate constraint aulas_ao_vivo_so_grupo;
alter table public.aulas add constraint aulas_ao_vivo_so_grupo
  check (tipo <> 'ao_vivo' or nivel_minimo = 'grupo') not valid;

-- Link da live: so Grupo (equipe continua vendo, via pode_ver_conteudo) e, com reserva ligada mas sem URL, cai no link principal.
create or replace function public.link_transmissao(aula bigint) returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_aula public.aulas;
  v_t public.transmissoes;
  v_abre timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into v_aula from public.aulas a where a.id = link_transmissao.aula;
  select * into v_t from public.transmissoes t where t.aula_id = link_transmissao.aula;
  if v_aula.id is null or v_t.aula_id is null or v_aula.agendada_em is null or v_aula.inicio_em is null then
    raise exception 'aula_sem_transmissao' using errcode = 'P0002';
  end if;
  if not public.pode_ver_conteudo('grupo') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_abre := v_aula.inicio_em - make_interval(mins => v_t.abre_min_antes);
  if now() < v_abre then
    raise exception 'ainda_nao_abriu' using errcode = 'P0001',
      detail = to_char(v_abre at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  return case when v_t.usar_reserva then coalesce(v_t.url_reserva, v_t.url) else v_t.url end;
end $$;

-- Hora de abertura da sala: tambem so Grupo (e equipe), para o Clube nao ver contagem de uma live que nao e dele.
create or replace function public.abertura_transmissao(aula bigint) returns timestamptz
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_aula public.aulas;
  v_t public.transmissoes;
begin
  if (select auth.uid()) is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into v_aula from public.aulas a where a.id = abertura_transmissao.aula;
  select * into v_t from public.transmissoes t where t.aula_id = abertura_transmissao.aula;
  if v_aula.id is null or v_t.aula_id is null or v_aula.agendada_em is null or v_aula.inicio_em is null then
    raise exception 'aula_sem_transmissao' using errcode = 'P0002';
  end if;
  if not public.pode_ver_conteudo('grupo') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return v_aula.inicio_em - make_interval(mins => v_t.abre_min_antes);
end $$;

-- 3) Espacos da comunidade (mesmos do seed local). Pode rodar de novo sem erro, mas NAO atualiza espaco que ja exista (edicao feita por super_admin prevalece).
insert into public.espacos (slug, titulo, titulo_en, descricao, nivel_minimo, ordem) values
  ('geral', 'Geral', 'General', 'Espaço aberto a Clube e Grupo.', 'clube', 1),
  ('grupo', 'Grupo Árvora', 'Árvora Group', 'Espaço só do Grupo.', 'grupo', 2)
on conflict (slug) do nothing;

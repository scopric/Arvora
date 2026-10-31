-- F3 Brazilian Awards e Directory (PRD 9.1.3): empresas, edicoes, categorias_premio, indicados, premiados,
-- patrocinadores, agenda_evento, temas, videos, videos_citados e salvos.
-- Paginas publicas (Hall of Fame, Directory, Talks): anon le so colunas de vitrine (grant por coluna) e so o que
-- foi publicado/aprovado. Premiado e indicado so sao publicados com consentimento vigente do tipo hall_of_fame
-- (HOF-04; para indicado, PRD 9.1.6 pendencia 7, opcao mais restritiva). Revogar o consentimento despublica.

create type public.status_moderacao as enum ('pendente', 'publicada', 'rejeitada');
create type public.tipo_video as enum ('talk', 'original', 'cerimonia');

-- empresas (DIR-01/02). O membro cadastra a propria; a equipe aprova. Toda edicao do dono volta para pendente.
create table public.empresas (
  id bigint generated always as identity primary key,
  nome text not null check (length(btrim(nome)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  setor_id bigint not null references public.setores (id) on delete restrict,
  cidade text check (length(cidade) <= 80),
  pais char(2) check (pais ~ '^[A-Z]{2}$'),
  site text check (site ~ '^https?://' and length(site) <= 300),
  descricao text check (length(descricao) <= 2000),
  logo_path text check (length(logo_path) <= 300),
  dono_perfil_id uuid references public.perfis (id) on delete set null,
  status public.status_moderacao not null default 'pendente',
  aprovada_por uuid,
  aprovada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index empresas_dono_perfil_id_idx on public.empresas (dono_perfil_id);
create index empresas_setor_id_idx on public.empresas (setor_id);
create index empresas_publicadas_idx on public.empresas (setor_id, lower(cidade)) where status = 'publicada';

create function private.empresas_regras() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_equipe boolean := coalesce((select private.papel_atual()) in ('super_admin', 'editor', 'moderador'), false);
begin
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.aprovada_por := null;
    new.aprovada_em := null;
    new.dono_perfil_id := case when v_equipe then null else (select auth.uid()) end;
  elsif not v_equipe and (new.nome, new.slug, new.setor_id, new.cidade, new.pais, new.site, new.descricao, new.logo_path)
        is distinct from (old.nome, old.slug, old.setor_id, old.cidade, old.pais, old.site, old.descricao, old.logo_path) then
    new.status := 'pendente';
    new.aprovada_por := null;
    new.aprovada_em := null;
  end if;
  return new;
end $$;
revoke all on function private.empresas_regras() from public, anon, authenticated;
create trigger empresas_regras before insert or update on public.empresas
  for each row execute function private.empresas_regras();
create trigger empresas_atualizado_em before update on public.empresas
  for each row execute function private.set_atualizado_em();

alter table public.empresas enable row level security;
grant select (id, nome, slug, setor_id, cidade, pais, logo_path, status) on public.empresas to anon;
grant select on public.empresas to authenticated;
grant insert (nome, slug, setor_id, cidade, pais, site, descricao, logo_path),
      update (nome, slug, setor_id, cidade, pais, site, descricao, logo_path), delete
  on public.empresas to authenticated;
create policy empresas_publicadas_le on public.empresas for select to anon, authenticated using (status = 'publicada');
create policy empresas_dono_le on public.empresas for select to authenticated
  using (dono_perfil_id = (select auth.uid()));
create policy empresas_equipe_le on public.empresas for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor', 'moderador'));
create policy empresas_membro_insere on public.empresas for insert to authenticated
  with check ((select public.tem_acesso('clube')) or (select private.papel_atual()) in ('super_admin', 'editor'));
create policy empresas_dono_altera on public.empresas for update to authenticated
  using (dono_perfil_id = (select auth.uid()))
  with check (dono_perfil_id = (select auth.uid()));
create policy empresas_equipe_altera on public.empresas for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy empresas_equipe_apaga on public.empresas for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.registrar_log_em('public.empresas');

create function public.aprovar_empresa(empresa bigint, aprovar boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'editor', 'moderador') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.empresas
     set status = case when aprovar then 'publicada' else 'rejeitada' end::public.status_moderacao,
         aprovada_por = case when aprovar then (select auth.uid()) end,
         aprovada_em = case when aprovar then now() end
   where id = empresa;
  if not found then
    raise exception 'empresa_inexistente' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.aprovar_empresa(bigint, boolean) from public, anon;
grant execute on function public.aprovar_empresa(bigint, boolean) to authenticated;

alter table public.denuncias add column empresa_id bigint references public.empresas (id) on delete set null;
create index denuncias_empresa_id_idx on public.denuncias (empresa_id);
grant insert (empresa_id) on public.denuncias to authenticated;

-- edicoes: a fase (antes/durante/depois) e calculada pelas datas (public.fase, campo calculado no PostgREST).
create table public.edicoes (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  nome text not null check (length(btrim(nome)) between 1 and 160),
  ano smallint not null check (ano between 2000 and 2100),
  pais char(2) not null check (pais ~ '^[A-Z]{2}$'),
  cidade text not null check (length(btrim(cidade)) between 1 and 80),
  descricao text check (length(descricao) <= 4000),
  durante_inicio timestamptz not null,
  durante_fim timestamptz not null,
  transmissao_url text check (transmissao_url ~ '^https://' and length(transmissao_url) <= 500),
  gravacao_video_id text check (length(gravacao_video_id) <= 200),
  publicada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (ano, pais, cidade),
  check (durante_fim > durante_inicio)
);
create trigger edicoes_atualizado_em before update on public.edicoes
  for each row execute function private.set_atualizado_em();
alter table public.edicoes enable row level security;
grant select on public.edicoes to anon, authenticated;
grant insert, update, delete on public.edicoes to authenticated;
create policy edicoes_publicadas_le on public.edicoes for select to anon, authenticated using (publicada_em is not null);
create policy edicoes_editor_le on public.edicoes for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy edicoes_editor_insere on public.edicoes for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy edicoes_editor_altera on public.edicoes for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy edicoes_editor_apaga on public.edicoes for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.edicoes');
select private.registrar_log_em('public.edicoes');

create function public.fase(e public.edicoes) returns text
language sql stable
set search_path = ''
as $$
  select case when now() < e.durante_inicio then 'antes' when now() <= e.durante_fim then 'durante' else 'depois' end;
$$;
revoke all on function public.fase(public.edicoes) from public;
grant execute on function public.fase(public.edicoes) to anon, authenticated;

-- Tabelas filhas de edicao, de escrita da equipe (super_admin, editor) e leitura publica quando a edicao esta
-- visivel (o exists passa pelo RLS de edicoes). Mesmo bloco de politicas para todas.
create function private.politicas_filha_edicao(t regclass) returns void
language plpgsql
set search_path = ''
as $$
declare
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = t);
begin
  execute format('alter table %s enable row level security', t);
  execute format('grant select on %s to anon, authenticated', t);
  execute format('grant insert, update, delete on %s to authenticated', t);
  execute format('create policy %I on %s for select to anon, authenticated using '
                 '(exists (select 1 from public.edicoes e where e.id = %s.edicao_id))', n || '_le', t, n);
  execute format('create policy %I on %s for insert to authenticated with check '
                 '((select private.papel_atual()) in (''super_admin'', ''editor''))', n || '_editor_insere', t);
  execute format('create policy %I on %s for update to authenticated using '
                 '((select private.papel_atual()) in (''super_admin'', ''editor'')) with check '
                 '((select private.papel_atual()) in (''super_admin'', ''editor''))', n || '_editor_altera', t);
  execute format('create policy %I on %s for delete to authenticated using '
                 '((select private.papel_atual()) in (''super_admin'', ''editor''))', n || '_editor_apaga', t);
  perform private.exigir_2fa(t);
  perform private.registrar_log_em(t);
end $$;
revoke all on function private.politicas_filha_edicao(regclass) from public, anon, authenticated;

create table public.categorias_premio (
  id bigint generated always as identity primary key,
  edicao_id bigint not null references public.edicoes (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (edicao_id, slug),
  unique (id, edicao_id)
);
create trigger categorias_premio_atualizado_em before update on public.categorias_premio
  for each row execute function private.set_atualizado_em();
select private.politicas_filha_edicao('public.categorias_premio');

create table public.patrocinadores (
  id bigint generated always as identity primary key,
  edicao_id bigint not null references public.edicoes (id) on delete cascade,
  empresa_id bigint references public.empresas (id) on delete set null,
  nome text not null check (length(btrim(nome)) between 1 and 160),
  logo_path text check (length(logo_path) <= 300),
  descricao text check (length(descricao) <= 2000),
  site text check (site ~ '^https?://' and length(site) <= 300),
  nivel text check (length(nivel) <= 40),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index patrocinadores_edicao_id_idx on public.patrocinadores (edicao_id);
create index patrocinadores_empresa_id_idx on public.patrocinadores (empresa_id);
create trigger patrocinadores_atualizado_em before update on public.patrocinadores
  for each row execute function private.set_atualizado_em();
select private.politicas_filha_edicao('public.patrocinadores');

create table public.agenda_evento (
  id bigint generated always as identity primary key,
  edicao_id bigint not null references public.edicoes (id) on delete cascade,
  inicio_em timestamptz not null,
  fim_em timestamptz,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  descricao text check (length(descricao) <= 2000),
  local text check (length(local) <= 200),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim_em is null or fim_em >= inicio_em)
);
create index agenda_evento_edicao_inicio_idx on public.agenda_evento (edicao_id, inicio_em);
create trigger agenda_evento_atualizado_em before update on public.agenda_evento
  for each row execute function private.set_atualizado_em();
select private.politicas_filha_edicao('public.agenda_evento');

-- Consentimento vigente do tipo hall_of_fame (premiados e indicados).
create function private.consentimento_hof_vigente(p_id bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.consentimentos c join public.documentos_legais d on d.id = c.documento_id
                 where c.id = p_id and c.revogado_em is null and d.tipo = 'hall_of_fame');
$$;
revoke all on function private.consentimento_hof_vigente(bigint) from public, anon, authenticated;

create function private.exigir_consentimento_publicacao() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.publicado_em is not null and not private.consentimento_hof_vigente(new.consentimento_id) then
    raise exception 'consentimento_ausente_ou_revogado' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.exigir_consentimento_publicacao() from public, anon, authenticated;

-- indicados (EVE-01). perfil_id e consentimento_id nao saem para anon.
create table public.indicados (
  id bigint generated always as identity primary key,
  edicao_id bigint not null references public.edicoes (id) on delete cascade,
  categoria_id bigint not null,
  nome text not null check (length(btrim(nome)) between 1 and 160),
  empresa_id bigint references public.empresas (id) on delete set null,
  perfil_id uuid references public.perfis (id) on delete set null,
  foto_path text check (length(foto_path) <= 300),
  resumo text check (length(resumo) <= 2000),
  consentimento_id bigint references public.consentimentos (id) on delete restrict,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (categoria_id, edicao_id) references public.categorias_premio (id, edicao_id) on delete cascade,
  check (publicado_em is null or consentimento_id is not null)
);
create index indicados_edicao_id_idx on public.indicados (edicao_id);
create index indicados_categoria_edicao_idx on public.indicados (categoria_id, edicao_id);
create index indicados_empresa_id_idx on public.indicados (empresa_id);
create index indicados_perfil_id_idx on public.indicados (perfil_id);
create index indicados_consentimento_id_idx on public.indicados (consentimento_id);
create trigger indicados_atualizado_em before update on public.indicados
  for each row execute function private.set_atualizado_em();
create trigger indicados_consentimento before insert or update on public.indicados
  for each row execute function private.exigir_consentimento_publicacao();
alter table public.indicados enable row level security;
grant select (id, edicao_id, categoria_id, nome, empresa_id, foto_path, resumo, publicado_em) on public.indicados to anon;
grant select on public.indicados to authenticated;
grant insert, update, delete on public.indicados to authenticated;
create policy indicados_publicados_le on public.indicados for select to anon, authenticated
  using (publicado_em is not null and exists (select 1 from public.edicoes e where e.id = indicados.edicao_id));
create policy indicados_editor_le on public.indicados for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy indicados_editor_insere on public.indicados for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy indicados_editor_altera on public.indicados for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy indicados_editor_apaga on public.indicados for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.indicados');
select private.registrar_log_em('public.indicados');

-- premiados: Hall of Fame e "Meu Award" (HOF-01/04/05, PAI-02).
--   perfil_id: SO pelo gatilho private.vincular_premiado (e-mail confirmado = convite_email); nunca pela tela.
--   O proprio premiado le a(s) linha(s) com perfil_id = auth.uid(), mesmo despublicadas.
--   convite_email e alteracao_pendente nao saem por select para ninguem: usar public.premiado_privado().
create table public.premiados (
  id bigint generated always as identity primary key,
  edicao_id bigint not null references public.edicoes (id) on delete restrict,
  categoria_id bigint not null,
  indicado_id bigint unique references public.indicados (id) on delete set null,
  perfil_id uuid references public.perfis (id) on delete set null,
  empresa_id bigint references public.empresas (id) on delete set null,
  nome text not null check (length(btrim(nome)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  foto_path text check (length(foto_path) <= 300),
  historia text check (length(historia) <= 10000),
  video_entrevista_id text check (length(video_entrevista_id) <= 200),
  video_premiacao_id text check (length(video_premiacao_id) <= 200),
  materia_url text check (materia_url ~ '^https://' and length(materia_url) <= 500),
  redes jsonb not null default '{}' check (jsonb_typeof(redes) = 'object'),
  consentimento_id bigint references public.consentimentos (id) on delete restrict,
  convite_email text check (length(convite_email) <= 254),
  alteracao_pendente jsonb,
  alteracao_em timestamptz,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (edicao_id, slug),
  foreign key (categoria_id, edicao_id) references public.categorias_premio (id, edicao_id) on delete restrict,
  check (publicado_em is null or consentimento_id is not null)
);
create index premiados_categoria_edicao_idx on public.premiados (categoria_id, edicao_id);
create index premiados_perfil_id_idx on public.premiados (perfil_id);
create index premiados_empresa_id_idx on public.premiados (empresa_id);
create index premiados_consentimento_id_idx on public.premiados (consentimento_id);
create index premiados_convite_email_idx on public.premiados (lower(convite_email)) where perfil_id is null;
create trigger premiados_atualizado_em before update on public.premiados
  for each row execute function private.set_atualizado_em();
create trigger premiados_consentimento before insert or update on public.premiados
  for each row execute function private.exigir_consentimento_publicacao();
alter table public.premiados enable row level security;
grant select (id, edicao_id, categoria_id, empresa_id, nome, slug, foto_path, historia, video_entrevista_id,
              video_premiacao_id, materia_url, redes, publicado_em)
  on public.premiados to anon;
grant select (id, edicao_id, categoria_id, indicado_id, perfil_id, empresa_id, nome, slug, foto_path, historia,
              video_entrevista_id, video_premiacao_id, materia_url, redes, consentimento_id, alteracao_em,
              publicado_em, criado_em, atualizado_em)
  on public.premiados to authenticated;
grant insert (edicao_id, categoria_id, indicado_id, empresa_id, nome, slug, foto_path, historia, video_entrevista_id,
              video_premiacao_id, materia_url, redes, consentimento_id, convite_email, publicado_em),
      update (edicao_id, categoria_id, indicado_id, empresa_id, nome, slug, foto_path, historia, video_entrevista_id,
              video_premiacao_id, materia_url, redes, consentimento_id, convite_email, publicado_em),
      delete
  on public.premiados to authenticated;
create policy premiados_publicados_le on public.premiados for select to anon, authenticated
  using (publicado_em is not null and exists (select 1 from public.edicoes e where e.id = premiados.edicao_id));
create policy premiados_dono_le on public.premiados for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy premiados_editor_le on public.premiados for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy premiados_editor_insere on public.premiados for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy premiados_editor_altera on public.premiados for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy premiados_editor_apaga on public.premiados for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.premiados');
select private.registrar_log_em('public.premiados');

-- Revogou o consentimento: despublica na hora (premiado e indicado).
create function private.consentimento_revogado_despublica() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.revogado_em is not null and old.revogado_em is null then
    update public.premiados set publicado_em = null where consentimento_id = new.id and publicado_em is not null;
    update public.indicados set publicado_em = null where consentimento_id = new.id and publicado_em is not null;
  end if;
  return null;
end $$;
revoke all on function private.consentimento_revogado_despublica() from public, anon, authenticated;
create trigger consentimento_revogado_despublica after update of revogado_em on public.consentimentos
  for each row execute function private.consentimento_revogado_despublica();

-- Vinculo do premiado a conta: so com e-mail confirmado igual ao convite_email.
create function private.vincular_premiado() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    update public.premiados set perfil_id = new.id
    where perfil_id is null and lower(convite_email) = lower(new.email)
      and exists (select 1 from public.perfis p where p.id = new.id);
  end if;
  return null;
end $$;
revoke all on function private.vincular_premiado() from public, anon, authenticated;
create trigger vincular_premiado after insert or update of email_confirmed_at on auth.users
  for each row execute function private.vincular_premiado();

-- Colunas privadas: equipe (super_admin, editor) ve tudo; o premiado ve a propria alteracao pendente.
create function public.premiado_privado(premiado bigint) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.premiados;
  v_equipe boolean := coalesce((select private.papel_atual()) in ('super_admin', 'editor'), false);
begin
  select * into v from public.premiados p where p.id = premiado;
  if v.id is null or not (v_equipe or coalesce(v.perfil_id = (select auth.uid()), false)) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return jsonb_build_object('convite_email', case when v_equipe then v.convite_email end,
                            'alteracao_pendente', v.alteracao_pendente, 'alteracao_em', v.alteracao_em);
end $$;
revoke all on function public.premiado_privado(bigint) from public, anon;
grant execute on function public.premiado_privado(bigint) to authenticated;

-- HOF-05: o premiado pede alteracao; a pagina publica so muda quando a equipe aprova.
create function public.pedir_alteracao_premiado(premiado bigint, campos jsonb) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(campos) is distinct from 'object' or campos = '{}'::jsonb
     or exists (select 1 from jsonb_object_keys(campos) k where k not in ('historia', 'redes', 'materia_url', 'foto_path')) then
    raise exception 'campos_invalidos' using errcode = 'P0001';
  end if;
  if (campos ? 'historia' and (jsonb_typeof(campos->'historia') <> 'string' or length(campos->>'historia') > 10000))
     or (campos ? 'redes' and jsonb_typeof(campos->'redes') <> 'object')
     or (campos ? 'materia_url' and (jsonb_typeof(campos->'materia_url') <> 'string'
                                     or campos->>'materia_url' !~ '^https://' or length(campos->>'materia_url') > 500))
     or (campos ? 'foto_path' and (jsonb_typeof(campos->'foto_path') <> 'string' or length(campos->>'foto_path') > 300)) then
    raise exception 'campos_invalidos' using errcode = 'P0001';
  end if;
  update public.premiados p set alteracao_pendente = campos, alteracao_em = now()
  where p.id = premiado and p.perfil_id = (select auth.uid());
  if not found then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end $$;
revoke all on function public.pedir_alteracao_premiado(bigint, jsonb) from public, anon;
grant execute on function public.pedir_alteracao_premiado(bigint, jsonb) to authenticated;

create function public.aprovar_alteracao_premiado(premiado bigint, aprovar boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c jsonb;
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'editor') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select p.alteracao_pendente into c from public.premiados p where p.id = premiado for update;
  if c is null then
    raise exception 'sem_alteracao_pendente' using errcode = 'P0002';
  end if;
  update public.premiados p set
    historia = case when aprovar and c ? 'historia' then c->>'historia' else p.historia end,
    redes = case when aprovar and c ? 'redes' then c->'redes' else p.redes end,
    materia_url = case when aprovar and c ? 'materia_url' then c->>'materia_url' else p.materia_url end,
    foto_path = case when aprovar and c ? 'foto_path' then c->>'foto_path' else p.foto_path end,
    alteracao_pendente = null, alteracao_em = null
  where p.id = premiado;
end $$;
revoke all on function public.aprovar_alteracao_premiado(bigint, boolean) from public, anon;
grant execute on function public.aprovar_alteracao_premiado(bigint, boolean) to authenticated;

-- temas (BIB-01) e videos (Talks, Originals, cerimonia). video_id nao sai para anon; o trecho e trailer_video_id.
create table public.temas (
  id bigint generated always as identity primary key,
  nome text not null check (length(btrim(nome)) between 1 and 80),
  nome_en text check (nome_en is null or length(btrim(nome_en)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger temas_atualizado_em before update on public.temas
  for each row execute function private.set_atualizado_em();
alter table public.temas enable row level security;
grant select on public.temas to anon, authenticated;
grant insert, update, delete on public.temas to authenticated;
create policy temas_le on public.temas for select to anon, authenticated using (true);
create policy temas_editor_insere on public.temas for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy temas_editor_altera on public.temas for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy temas_editor_apaga on public.temas for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.temas');
select private.registrar_log_em('public.temas');

create table public.videos (
  id bigint generated always as identity primary key,
  tipo public.tipo_video not null,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  descricao text check (length(descricao) <= 4000),
  tema_id bigint references public.temas (id) on delete set null,
  edicao_id bigint references public.edicoes (id) on delete set null,
  video_id text not null check (length(video_id) <= 200),
  trailer_video_id text check (length(trailer_video_id) <= 200),
  duracao_min int check (duracao_min > 0 and duracao_min <= 1440),
  nivel_minimo public.nivel_acesso not null default 'clube',
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index videos_tipo_publicado_idx on public.videos (tipo, publicado_em desc);
create index videos_tema_id_idx on public.videos (tema_id);
create index videos_edicao_id_idx on public.videos (edicao_id);
create trigger videos_atualizado_em before update on public.videos
  for each row execute function private.set_atualizado_em();
alter table public.videos enable row level security;
grant select (id, tipo, titulo, slug, descricao, tema_id, edicao_id, trailer_video_id, duracao_min, nivel_minimo,
              publicado_em)
  on public.videos to anon;
grant select on public.videos to authenticated;
grant insert, update, delete on public.videos to authenticated;
create policy videos_publicados_le on public.videos for select to anon, authenticated using (publicado_em is not null);
create policy videos_editor_le on public.videos for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy videos_editor_insere on public.videos for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy videos_editor_altera on public.videos for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy videos_editor_apaga on public.videos for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.videos');
select private.registrar_log_em('public.videos');

-- videos_citados (BIB-02): le-se so quando o video e o alvo estao visiveis (os exists passam pelo RLS deles).
create table public.videos_citados (
  id bigint generated always as identity primary key,
  video_id bigint not null references public.videos (id) on delete cascade,
  premiado_id bigint references public.premiados (id) on delete cascade,
  empresa_id bigint references public.empresas (id) on delete cascade,
  criado_em timestamptz not null default now(),
  check (num_nonnulls(premiado_id, empresa_id) = 1)
);
create unique index videos_citados_premiado_uq on public.videos_citados (video_id, premiado_id) where premiado_id is not null;
create unique index videos_citados_empresa_uq on public.videos_citados (video_id, empresa_id) where empresa_id is not null;
create index videos_citados_premiado_id_idx on public.videos_citados (premiado_id);
create index videos_citados_empresa_id_idx on public.videos_citados (empresa_id);
alter table public.videos_citados enable row level security;
grant select on public.videos_citados to anon, authenticated;
grant insert, update, delete on public.videos_citados to authenticated;
create policy videos_citados_le on public.videos_citados for select to anon, authenticated
  using (exists (select 1 from public.videos v where v.id = videos_citados.video_id)
         and (premiado_id is null or exists (select 1 from public.premiados p where p.id = videos_citados.premiado_id))
         and (empresa_id is null or exists (select 1 from public.empresas e where e.id = videos_citados.empresa_id)));
create policy videos_citados_editor_insere on public.videos_citados for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy videos_citados_editor_altera on public.videos_citados for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy videos_citados_editor_apaga on public.videos_citados for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.videos_citados');
select private.registrar_log_em('public.videos_citados');

-- salvos (PAI-01): aulas e videos salvos pelo membro. So salva o que ele consegue ver.
create table public.salvos (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  aula_id bigint references public.aulas (id) on delete cascade,
  video_id bigint references public.videos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  check (num_nonnulls(aula_id, video_id) = 1)
);
create unique index salvos_aula_uq on public.salvos (perfil_id, aula_id) where aula_id is not null;
create unique index salvos_video_uq on public.salvos (perfil_id, video_id) where video_id is not null;
create index salvos_aula_id_idx on public.salvos (aula_id);
create index salvos_video_id_idx on public.salvos (video_id);
alter table public.salvos enable row level security;
grant select, delete on public.salvos to authenticated;
grant insert (aula_id, video_id) on public.salvos to authenticated;
create policy salvos_dono_le on public.salvos for select to authenticated using (perfil_id = (select auth.uid()));
create policy salvos_dono_insere on public.salvos for insert to authenticated
  with check (perfil_id = (select auth.uid())
              and (aula_id is null or exists (select 1 from public.aulas a where a.id = salvos.aula_id))
              and (video_id is null or exists (select 1 from public.videos v where v.id = salvos.video_id)));
create policy salvos_dono_apaga on public.salvos for delete to authenticated using (perfil_id = (select auth.uid()));

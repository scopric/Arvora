-- perfis: dados do usuario (CON-02/03/07). id = auth.users.id.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  foto_path text check (length(foto_path) <= 300),
  empresa_nome text check (length(empresa_nome) <= 120),
  setor_id bigint references public.setores (id) on delete set null,
  cidade text check (length(cidade) <= 80),
  pais char(2) check (pais ~ '^[A-Z]{2}$'),
  linkedin_url text check (linkedin_url ~ '^https://([a-z0-9-]+\.)*linkedin\.com/' and length(linkedin_url) <= 300),
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  bio text check (length(bio) <= 600),
  visibilidade public.visibilidade_perfil not null default 'membros',
  publico_aprovado_em timestamptz,
  suspenso_em timestamptz,
  maior_18_em timestamptz not null,
  onboarding_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index perfis_setor_id_idx on public.perfis (setor_id);
create index perfis_cidade_idx on public.perfis (lower(cidade));

alter table public.perfis enable row level security;

-- GRANT por coluna (PRD 9.1.0). Nada de grant de tabela inteira.
-- maior_18_em nao sai para ninguem pela API; suspenso_em e publico_aprovado_em so o dono e a equipe veem
-- (as linhas dos outros so aparecem quando ambos estao "limpos").
grant select (id, nome, slug, foto_path, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio,
              visibilidade, publico_aprovado_em, suspenso_em, onboarding_em, criado_em, atualizado_em)
  on public.perfis to authenticated;
grant select (id, nome, slug, foto_path, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio)
  on public.perfis to anon;
grant update (nome, slug, foto_path, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio,
              visibilidade, onboarding_em)
  on public.perfis to authenticated;

create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function private.set_atualizado_em();

-- Mexeu em qualquer campo publico (ou na visibilidade): a pagina publica sai do ar ate nova aprovacao (ADM-02).
create function private.perfis_reaprovar() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.nome, new.slug, new.foto_path, new.empresa_nome, new.setor_id, new.cidade, new.pais,
      new.linkedin_url, new.instagram, new.bio, new.visibilidade)
     is distinct from
     (old.nome, old.slug, old.foto_path, old.empresa_nome, old.setor_id, old.cidade, old.pais,
      old.linkedin_url, old.instagram, old.bio, old.visibilidade)
     and new.publico_aprovado_em is not distinct from old.publico_aprovado_em then
    new.publico_aprovado_em := null;
  end if;
  return new;
end;
$$;

create trigger perfis_reaprovar before update on public.perfis
  for each row execute function private.perfis_reaprovar();

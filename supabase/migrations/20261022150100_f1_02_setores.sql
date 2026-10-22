-- setores: lista fechada de setores de atividade (CON-02). As politicas ficam em f1_05,
-- depois de private.papel_atual() existir. Ate la a tabela fica fechada (RLS ligado, sem politica).
create table public.setores (
  id bigint generated always as identity primary key,
  nome text not null check (length(nome) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger setores_atualizado_em before update on public.setores
  for each row execute function private.set_atualizado_em();

alter table public.setores enable row level security;

grant select on public.setores to anon, authenticated;
grant insert, update, delete on public.setores to authenticated;
-- A identity precisa de uso da sequencia no insert pela equipe.
grant usage on all sequences in schema public to authenticated;


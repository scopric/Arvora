-- F1 assinaturas (PRD 9.1.2 e 9.1.3): enums, contas_stripe e planos.
-- Nenhum preco, valor ou Price ID mora em migration: planos e espelho do Stripe e comeca VAZIO.
-- Os valores sao decisao do contratante e entram depois como dados (pela equipe ou pelo servico).

create type public.status_assinatura as enum
  ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
create type public.origem_assinatura as enum ('stripe', 'manual');
create type public.tipo_receita as enum ('assinatura', 'curso', 'produto_digital', 'ingresso');

-- contas_stripe: contas Stripe das Contratantes e Afiliadas. FK de planos, clientes e eventos.
-- O segredo do webhook NAO fica aqui (variavel de ambiente do servidor, uma por conta).
create table public.contas_stripe (
  id bigint generated always as identity primary key,
  stripe_account_id text not null unique,
  titular text not null,
  pais char(2) not null check (pais ~ '^[A-Z]{2}$'),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.contas_stripe enable row level security;
grant select on public.contas_stripe to authenticated;

create policy contas_stripe_financeiro_le on public.contas_stripe for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
-- Escrita: so o servico (service_role ignora o RLS) ou migration.

-- planos: espelho dos Prices do Stripe com a classificacao contratual (ASS-01, Erros 1.5, Cl. 5.6).
-- O servidor decide preco e nivel por aqui, nunca o navegador.
-- vertical_id: a tabela verticais ainda nao existe na F1; a coluna nasce sem FK e a FK entra
-- na migration que criar verticais (on delete restrict).
create table public.planos (
  id bigint generated always as identity primary key,
  conta_stripe_id bigint not null references public.contas_stripe (id) on delete restrict,
  stripe_price_id text not null unique,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  nivel public.nivel_acesso check (nivel <> 'visitante'),  -- null = produto avulso
  intervalo text not null check (intervalo in ('mes', 'ano', 'unico')),
  tipo_receita public.tipo_receita not null,
  vertical_id bigint,
  valor_centavos bigint not null check (valor_centavos >= 0),
  moeda char(3) not null check (moeda ~ '^[A-Z]{3}$'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index planos_conta_stripe_id_idx on public.planos (conta_stripe_id);

create trigger planos_atualizado_em before update on public.planos
  for each row execute function private.set_atualizado_em();

alter table public.planos enable row level security;

grant select on public.planos to anon, authenticated;
grant insert, update, delete on public.planos to authenticated;

-- Todos leem os ativos (pagina de precos); o super_admin (aal2) le e escreve todos.
create policy planos_ativos_le on public.planos for select to anon, authenticated
  using (ativo);
create policy planos_super_admin_le on public.planos for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');
create policy planos_super_admin_insere on public.planos for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
create policy planos_super_admin_altera on public.planos for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
create policy planos_super_admin_apaga on public.planos for delete to authenticated
  using ((select private.papel_atual()) = 'super_admin');

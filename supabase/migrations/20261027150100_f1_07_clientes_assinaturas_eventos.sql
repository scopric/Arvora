-- F1 assinaturas (PRD 9.1.3): clientes_stripe, assinaturas e eventos_stripe.
-- Escrita e do servico (webhook, service_role ignora o RLS): nenhuma politica de escrita para usuarios,
-- e nenhum grant de escrita para anon/authenticated.

-- clientes_stripe: liga o Customer de cada conta Stripe ao perfil. O dono le; o resto e do servico.
create table public.clientes_stripe (
  id bigint generated always as identity primary key,
  conta_stripe_id bigint not null references public.contas_stripe (id) on delete restrict,
  stripe_customer_id text not null,
  perfil_id uuid references public.perfis (id) on delete set null,
  email text not null,
  criado_em timestamptz not null default now(),
  unique (conta_stripe_id, stripe_customer_id)
);

create index clientes_stripe_perfil_id_idx on public.clientes_stripe (perfil_id);

alter table public.clientes_stripe enable row level security;
grant select on public.clientes_stripe to authenticated;

create policy clientes_stripe_dono_le on public.clientes_stripe for select to authenticated
  using (perfil_id = (select auth.uid()));

-- assinaturas: estado atual; o acesso sai SO daqui (ASS-03/05). Retencao: perfil_id set null (nunca cascade).
-- receita_externa_id: receitas_externas ainda nao existe; a coluna nasce sem FK e a FK (restrict) entra
-- na migration que criar essa tabela. O check de origem manual ja vale.
create table public.assinaturas (
  id bigint generated always as identity primary key,
  perfil_id uuid references public.perfis (id) on delete set null,
  conta_stripe_id bigint references public.contas_stripe (id) on delete restrict,
  stripe_subscription_id text unique,
  plano_id bigint not null references public.planos (id) on delete restrict,
  status public.status_assinatura not null,
  origem public.origem_assinatura not null default 'stripe',
  receita_externa_id bigint,
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  cancela_no_fim boolean not null default false,
  cancelada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (origem <> 'stripe' or (stripe_subscription_id is not null and conta_stripe_id is not null)),
  check (origem <> 'manual' or receita_externa_id is not null)
);

create index assinaturas_perfil_id_idx on public.assinaturas (perfil_id);
create index assinaturas_conta_stripe_id_idx on public.assinaturas (conta_stripe_id);
create index assinaturas_plano_id_idx on public.assinaturas (plano_id);
create index assinaturas_perfil_vigente_idx on public.assinaturas (perfil_id)
  where status in ('active', 'trialing', 'past_due');

create trigger assinaturas_atualizado_em before update on public.assinaturas
  for each row execute function private.set_atualizado_em();

alter table public.assinaturas enable row level security;
grant select on public.assinaturas to authenticated;

create policy assinaturas_dono_le on public.assinaturas for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy assinaturas_financeiro_le on public.assinaturas for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
-- Grandfathering: membro com assinatura de plano desativado precisa ler o proprio plano (tela "minha assinatura").
-- Quem limita ao dono e o a.perfil_id = auth.uid() explicito (o RLS de assinaturas
-- deixaria super_admin e auditor verem qualquer linha pela policy do financeiro).
create policy planos_assinante_le on public.planos for select to authenticated
  using (exists (select 1 from public.assinaturas a
                 where a.plano_id = planos.id and a.perfil_id = (select auth.uid())));
-- Escrita: webhook (service_role). A RPC conceder_acesso_manual() (origem manual) vem com receitas_externas.

-- eventos_stripe: idempotencia dos webhooks ("reservar antes de agir", Erros 5.2/5.4).
-- Fluxo: insert ... on conflict do nothing returning id; evento existente com processado_em nulo e reprocessado.
-- O payload tem dado pessoal: o job que o zera apos 90 dias entra junto com o webhook.
create table public.eventos_stripe (
  id bigint generated always as identity primary key,
  conta_stripe_id bigint not null references public.contas_stripe (id) on delete restrict,
  event_id text not null,
  tipo text not null,
  criado_stripe_em timestamptz not null,
  processado_em timestamptz,
  erro text,
  payload jsonb,
  criado_em timestamptz not null default now(),
  unique (conta_stripe_id, event_id)
);

alter table public.eventos_stripe enable row level security;
grant select on public.eventos_stripe to authenticated;

create policy eventos_stripe_super_admin_le on public.eventos_stripe for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');

-- F1 dinheiro (PRD 9.1.3): verticais, assinaturas_status, pagamentos, pagamentos_itens, receitas_externas,
-- reembolsos, cambio_bce, relatorios_ciclo e o calculo do Ciclo (dia 10 a dia 9, Europe/Dublin).
-- Retencao de 6 anos (Cl. 10.5): nada aqui e apagado em cascata a partir de perfis; FK para perfil = set null.
-- Nenhum valor, preco ou taxa vem de migration.

create type public.origem_receita_externa as enum ('ingresso', 'pix', 'transferencia', 'evento', 'outro');
create type public.tipo_estorno as enum ('reembolso', 'chargeback');

-- verticais: bracos e verticais como dados (ADM-05, Cl. 5.6). Exigida por planos.vertical_id.
-- Nenhuma vertical nasce aqui: os nomes sao do contratante (no MVP o cadastro e feito pela equipe).
create table public.verticais (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  nome text not null check (length(btrim(nome)) between 1 and 80),
  nome_en text check (nome_en is null or length(btrim(nome_en)) between 1 and 80),
  descricao text check (length(descricao) <= 600),
  ordem int not null default 0,
  ativa boolean not null default true,
  conta_como_ia boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger verticais_atualizado_em before update on public.verticais
  for each row execute function private.set_atualizado_em();
alter table public.verticais enable row level security;
grant select on public.verticais to anon, authenticated;
grant insert, update, delete on public.verticais to authenticated;
create policy verticais_ativas_le on public.verticais for select to anon, authenticated using (ativa);
create policy verticais_equipe_le on public.verticais for select to authenticated
  using ((select private.papel_atual()) is not null);
create policy verticais_super_admin_insere on public.verticais for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
create policy verticais_super_admin_altera on public.verticais for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
create policy verticais_super_admin_apaga on public.verticais for delete to authenticated
  using ((select private.papel_atual()) = 'super_admin');
select private.exigir_2fa('public.verticais');
select private.registrar_log_em('public.verticais');

-- FK prometida na f1_06.
alter table public.planos add constraint planos_vertical_id_fkey
  foreign key (vertical_id) references public.verticais (id) on delete restrict;
create index planos_vertical_id_idx on public.planos (vertical_id);
-- 2FA restritivo e log tambem em planos (escrita so da equipe).
select private.exigir_2fa('public.planos');

-- Data de criacao da assinatura no Stripe (subscription.created): base da regra dos 14 dias da exclusao
-- de conta, no lugar de criado_em (que e a data da linha no banco). Preenchida pelo webhook (f1_20).
alter table public.assinaturas add column stripe_criada_em timestamptz;

-- assinaturas_status: historico de status e plano, para reproduzir "ativa no ultimo dia" de Ciclo passado.
-- desde = created do evento do Stripe que levou ao estado (monotono por assinatura: o webhook descarta evento
-- antigo), ou now() quando nao ha evento (origem manual).
create table public.assinaturas_status (
  id bigint generated always as identity primary key,
  assinatura_id bigint not null references public.assinaturas (id) on delete cascade,
  status public.status_assinatura not null,
  plano_id bigint not null references public.planos (id) on delete restrict,
  desde timestamptz not null,
  criado_em timestamptz not null default now()
);
create index assinaturas_status_assinatura_desde_idx on public.assinaturas_status (assinatura_id, desde desc);
create index assinaturas_status_plano_id_idx on public.assinaturas_status (plano_id);

create function private.assinaturas_historico() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.plano_id is distinct from new.plano_id then
    insert into public.assinaturas_status (assinatura_id, status, plano_id, desde)
    values (new.id, new.status, new.plano_id, coalesce(new.stripe_evento_em, now()));
  end if;
  return null;
end $$;
revoke all on function private.assinaturas_historico() from public, anon, authenticated;
create trigger assinaturas_historico after insert or update on public.assinaturas
  for each row execute function private.assinaturas_historico();

alter table public.assinaturas_status enable row level security;
grant select on public.assinaturas_status to authenticated;
create policy assinaturas_status_financeiro_le on public.assinaturas_status for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));

-- pagamentos: cada cobranca confirmada (invoice paga ou Checkout avulso pago). Fonte da Receita Base Stripe.
create table public.pagamentos (
  id bigint generated always as identity primary key,
  conta_stripe_id bigint not null references public.contas_stripe (id) on delete restrict,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text unique,
  perfil_id uuid references public.perfis (id) on delete set null,
  cliente_email text not null check (length(cliente_email) <= 254),
  assinatura_id bigint references public.assinaturas (id) on delete set null,
  metodo text check (length(metodo) <= 40),
  moeda char(3) not null check (moeda ~ '^[A-Z]{3}$'),
  bruto_centavos bigint not null check (bruto_centavos >= 0),
  vat_centavos bigint not null default 0 check (vat_centavos >= 0 and vat_centavos <= bruto_centavos),
  pago_em timestamptz not null,
  criado_em timestamptz not null default now(),
  check (stripe_invoice_id is not null or stripe_payment_intent_id is not null)
);
create index pagamentos_pago_em_idx on public.pagamentos (pago_em);
create index pagamentos_perfil_id_idx on public.pagamentos (perfil_id);
create index pagamentos_assinatura_id_idx on public.pagamentos (assinatura_id);
create index pagamentos_conta_stripe_id_idx on public.pagamentos (conta_stripe_id);

alter table public.pagamentos enable row level security;
grant select on public.pagamentos to authenticated;
create policy pagamentos_dono_le on public.pagamentos for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy pagamentos_financeiro_le on public.pagamentos for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));

-- pagamentos_itens: linhas da fatura (plano, avulso de IA, proracao). plano_id nulo = Price desconhecido:
-- o relatorio lista como pendencia.
create table public.pagamentos_itens (
  id bigint generated always as identity primary key,
  pagamento_id bigint not null references public.pagamentos (id) on delete cascade,
  plano_id bigint references public.planos (id) on delete restrict,
  descricao text check (length(descricao) <= 300),
  tipo_receita public.tipo_receita not null,
  bruto_centavos bigint not null,
  vat_centavos bigint not null default 0,
  criado_em timestamptz not null default now()
);
create index pagamentos_itens_pagamento_id_idx on public.pagamentos_itens (pagamento_id);
create index pagamentos_itens_plano_id_idx on public.pagamentos_itens (plano_id);

alter table public.pagamentos_itens enable row level security;
grant select on public.pagamentos_itens to authenticated;
create policy pagamentos_itens_dono_le on public.pagamentos_itens for select to authenticated
  using (exists (select 1 from public.pagamentos p
                 where p.id = pagamentos_itens.pagamento_id and p.perfil_id = (select auth.uid())));
create policy pagamentos_itens_financeiro_le on public.pagamentos_itens for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));

-- Ciclo: [dia 10, dia 10 do mes seguinte) na data de Europe/Dublin (PRD pendencia 2: fuso assumido).
create function public.ciclo_de(t timestamptz) returns daterange
language sql stable
set search_path = ''
as $$
  select daterange(i, (i + interval '1 month')::date, '[)')
  from (select case when extract(day from d) >= 10 then make_date(extract(year from d)::int, extract(month from d)::int, 10)
                    else (make_date(extract(year from d)::int, extract(month from d)::int, 10) - interval '1 month')::date
               end as i
        from (select (t at time zone 'Europe/Dublin')::date as d) x) y;
$$;
revoke all on function public.ciclo_de(timestamptz) from public, anon;
grant execute on function public.ciclo_de(timestamptz) to authenticated;

-- Instantes (UTC) de inicio e fim de um Ciclo dado pelo dia 10.
create function private.ciclo_limites(p_inicio date, out ini timestamptz, out fim timestamptz)
language sql stable
set search_path = ''
as $$
  select (p_inicio::timestamp at time zone 'Europe/Dublin'),
         ((p_inicio + interval '1 month')::date::timestamp at time zone 'Europe/Dublin');
$$;
revoke all on function private.ciclo_limites(date) from public, anon, authenticated;

-- relatorios_ciclo: relatorio congelado de cada Ciclo. Fechar grava a versao; reabrir (com motivo) libera a
-- correcao e o proximo fechamento grava a versao seguinte (PRD 17.5.6: "so o super-admin reabre, com motivo").
-- Insert e update so pelas RPCs da f1_21; sem delete.
create table public.relatorios_ciclo (
  ciclo_inicio date not null check (extract(day from ciclo_inicio) = 10),
  versao int not null check (versao >= 1),
  ciclo_fim date not null,
  dados jsonb not null,
  csv_sha256 text not null,
  gerado_por uuid not null,
  enviado_em timestamptz,
  motivo_reemissao text check (length(motivo_reemissao) <= 1000),
  reaberto_em timestamptz,
  reaberto_por uuid,
  motivo_reabertura text check (length(motivo_reabertura) <= 1000),
  criado_em timestamptz not null default now(),
  primary key (ciclo_inicio, versao),
  check ((reaberto_em is null) = (motivo_reabertura is null))
);
alter table public.relatorios_ciclo enable row level security;
grant select on public.relatorios_ciclo to authenticated;
create policy relatorios_ciclo_financeiro_le on public.relatorios_ciclo for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
select private.registrar_log_em('public.relatorios_ciclo');

-- Ciclo fechado = ultima versao do Ciclo existe e nao foi reaberta.
create function private.ciclo_fechado(d date) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select r.reaberto_em is null from public.relatorios_ciclo r
                   where r.ciclo_inicio = lower(public.ciclo_de(d::timestamp at time zone 'Europe/Dublin'))
                   order by r.versao desc limit 1), false);
$$;
revoke all on function private.ciclo_fechado(date) from public, anon, authenticated;

-- receitas_externas: receita fora do Stripe (Pix, transferencia, ingresso, evento), com comprovante (Cl. 4.4).
-- Sem DELETE. Corrigir = anular (motivo) e lancar de novo. Em Ciclo fechado, nada entra nem e anulado ate
-- o super_admin reabrir o Ciclo.
create table public.receitas_externas (
  id bigint generated always as identity primary key,
  recebido_em date not null,
  origem public.origem_receita_externa not null,
  tipo_receita public.tipo_receita not null,
  plano_id bigint references public.planos (id) on delete restrict,
  perfil_id uuid references public.perfis (id) on delete set null,
  cliente_nome text not null check (length(btrim(cliente_nome)) between 1 and 200),
  cliente_email text check (length(cliente_email) <= 254),
  moeda char(3) not null check (moeda ~ '^[A-Z]{3}$'),
  bruto_centavos bigint not null check (bruto_centavos > 0),
  vat_centavos bigint not null default 0 check (vat_centavos >= 0 and vat_centavos <= bruto_centavos),
  comprovante_path text not null check (length(comprovante_path) between 1 and 300),
  descricao text check (length(descricao) <= 600),
  lancado_por uuid not null,
  anulado_em timestamptz,
  anulado_por uuid,
  motivo_anulacao text check (motivo_anulacao is null or length(btrim(motivo_anulacao)) between 1 and 600),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((anulado_em is null) = (anulado_por is null)),
  check (anulado_em is null or motivo_anulacao is not null)
);
create index receitas_externas_recebido_em_idx on public.receitas_externas (recebido_em) where anulado_em is null;
create index receitas_externas_plano_id_idx on public.receitas_externas (plano_id);
create index receitas_externas_perfil_id_idx on public.receitas_externas (perfil_id);

create function private.receitas_externas_regras() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.lancado_por := coalesce((select auth.uid()), new.lancado_por);
    new.anulado_em := null;
    new.anulado_por := null;
    new.motivo_anulacao := null;
  else
    if old.anulado_em is not null then
      raise exception 'ja_anulado' using errcode = 'P0001';
    end if;
    if new.motivo_anulacao is null then
      raise exception 'motivo_obrigatorio' using errcode = 'P0001';
    end if;
    new.anulado_em := now();
    new.anulado_por := (select auth.uid());
  end if;
  if private.ciclo_fechado(new.recebido_em) then
    raise exception 'ciclo_fechado' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.receitas_externas_regras() from public, anon, authenticated;
-- "of motivo_anulacao": o set null de perfil_id na exclusao de conta (retencao fiscal) nao passa por aqui.
create trigger receitas_externas_regras before insert or update of motivo_anulacao on public.receitas_externas
  for each row execute function private.receitas_externas_regras();
create trigger receitas_externas_atualizado_em before update on public.receitas_externas
  for each row execute function private.set_atualizado_em();

alter table public.receitas_externas enable row level security;
grant select on public.receitas_externas to authenticated;
grant insert (recebido_em, origem, tipo_receita, plano_id, perfil_id, cliente_nome, cliente_email, moeda,
              bruto_centavos, vat_centavos, comprovante_path, descricao)
  on public.receitas_externas to authenticated;
grant update (motivo_anulacao) on public.receitas_externas to authenticated;
create policy receitas_externas_financeiro_le on public.receitas_externas for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
create policy receitas_externas_super_admin_insere on public.receitas_externas for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
create policy receitas_externas_super_admin_anula on public.receitas_externas for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
select private.exigir_2fa('public.receitas_externas');
select private.registrar_log_em('public.receitas_externas');

-- FK prometida na f1_07.
alter table public.assinaturas add constraint assinaturas_receita_externa_id_fkey
  foreign key (receita_externa_id) references public.receitas_externas (id) on delete restrict;
create index assinaturas_receita_externa_id_idx on public.assinaturas (receita_externa_id);

-- reembolsos: reembolsos e chargebacks perdidos, deduzidos no Ciclo em que o dinheiro voltou.
-- Stripe: o webhook grava (f1_20). Receita externa: o super_admin lanca.
create table public.reembolsos (
  id bigint generated always as identity primary key,
  conta_stripe_id bigint references public.contas_stripe (id) on delete restrict,
  stripe_id text unique,
  tipo public.tipo_estorno not null,
  pagamento_id bigint references public.pagamentos (id) on delete restrict,
  receita_externa_id bigint references public.receitas_externas (id) on delete restrict,
  moeda char(3) not null check (moeda ~ '^[A-Z]{3}$'),
  valor_centavos bigint not null check (valor_centavos > 0),
  vat_centavos bigint not null default 0 check (vat_centavos >= 0 and vat_centavos <= valor_centavos),
  devolvido_em timestamptz not null,
  lancado_por uuid,
  criado_em timestamptz not null default now(),
  check (num_nonnulls(pagamento_id, receita_externa_id) = 1)
);
create index reembolsos_devolvido_em_idx on public.reembolsos (devolvido_em);
create index reembolsos_pagamento_id_idx on public.reembolsos (pagamento_id);
create index reembolsos_receita_externa_id_idx on public.reembolsos (receita_externa_id);
create index reembolsos_conta_stripe_id_idx on public.reembolsos (conta_stripe_id);

-- Moeda igual a da origem; soma dos estornos nunca passa do bruto; lancamento manual nao entra em Ciclo fechado.
-- (O webhook entra mesmo em Ciclo fechado: o relatorio congelado nao muda e a diferenca fica visivel.)
create function private.reembolsos_regras() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_moeda char(3);
  v_bruto bigint;
  v_ja bigint;
begin
  if new.pagamento_id is not null then
    select moeda, bruto_centavos into v_moeda, v_bruto from public.pagamentos where id = new.pagamento_id for update;
    select coalesce(sum(valor_centavos), 0) into v_ja from public.reembolsos where pagamento_id = new.pagamento_id;
  else
    select moeda, bruto_centavos into v_moeda, v_bruto from public.receitas_externas
    where id = new.receita_externa_id and anulado_em is null for update;
    if v_moeda is null then
      raise exception 'receita_inexistente_ou_anulada' using errcode = 'P0001';
    end if;
    select coalesce(sum(valor_centavos), 0) into v_ja from public.reembolsos where receita_externa_id = new.receita_externa_id;
  end if;
  if new.moeda is distinct from v_moeda then
    raise exception 'moeda_divergente' using errcode = 'P0001';
  end if;
  if v_ja + new.valor_centavos > v_bruto then
    raise exception 'estorno_maior_que_pagamento' using errcode = 'P0001';
  end if;
  if (select auth.uid()) is not null then
    new.lancado_por := (select auth.uid());
    if private.ciclo_fechado((new.devolvido_em at time zone 'Europe/Dublin')::date) then
      raise exception 'ciclo_fechado' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.reembolsos_regras() from public, anon, authenticated;
create trigger reembolsos_regras before insert on public.reembolsos
  for each row execute function private.reembolsos_regras();

alter table public.reembolsos enable row level security;
grant select on public.reembolsos to authenticated;
grant insert (tipo, receita_externa_id, moeda, valor_centavos, vat_centavos, devolvido_em) on public.reembolsos to authenticated;
create policy reembolsos_financeiro_le on public.reembolsos for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
create policy reembolsos_super_admin_insere on public.reembolsos for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin' and receita_externa_id is not null);
select private.exigir_2fa('public.reembolsos');
select private.registrar_log_em('public.reembolsos');

-- cambio_bce: taxa de referencia do BCE (unidades da moeda por 1 EUR). Informada a mao pelo super_admin
-- (ou por um servico futuro), sempre com a fonte. EUR nao entra (taxa 1 implicita).
create table public.cambio_bce (
  data date not null,
  moeda char(3) not null check (moeda ~ '^[A-Z]{3}$' and moeda <> 'EUR'),
  taxa numeric(18, 6) not null check (taxa > 0),
  fonte_url text not null check (fonte_url ~ '^https://' and length(fonte_url) <= 500),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (data, moeda)
);
create trigger cambio_bce_atualizado_em before update on public.cambio_bce
  for each row execute function private.set_atualizado_em();
alter table public.cambio_bce enable row level security;
grant select on public.cambio_bce to authenticated;
grant insert (data, moeda, taxa, fonte_url), update (taxa, fonte_url) on public.cambio_bce to authenticated;
create policy cambio_bce_financeiro_le on public.cambio_bce for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'auditor'));
create policy cambio_bce_super_admin_insere on public.cambio_bce for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
create policy cambio_bce_super_admin_altera on public.cambio_bce for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
select private.exigir_2fa('public.cambio_bce');
select private.registrar_log_em('public.cambio_bce');

-- Taxa de d, ou a ultima publicada antes de d (PRD pendencia 3). EUR = 1. Sem taxa = null (pendencia).
create function private.cambio_em(p_moeda char(3), d date) returns numeric
language sql stable security definer
set search_path = ''
as $$
  select case when p_moeda = 'EUR' then 1::numeric
              else (select c.taxa from public.cambio_bce c where c.moeda = p_moeda and c.data <= d
                    order by c.data desc limit 1) end;
$$;
revoke all on function private.cambio_em(char, date) from public, anon, authenticated;

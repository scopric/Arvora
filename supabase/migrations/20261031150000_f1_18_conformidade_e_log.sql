-- F1 conformidade e operacao (PRD 9.1.3): log_admin, documentos_legais, consentimentos e pedidos_gdpr.
-- Traz tambem dois helpers usados daqui para a frente:
--   private.exigir_2fa(tabela): politicas RESTRITIVAS que barram insert/update/delete sem aal2 (CON-05), mesmo
--     que uma politica permissiva seja afrouxada por engano. Usar SO em tabela que apenas a equipe escreve.
--   private.registrar_log_em(tabela): gatilho que grava em log_admin toda escrita feita por alguem da equipe
--     com sessao aal2 (ADM-09). Escrita do servico (webhook, jobs) e de membro comum nao entra no log.

create type public.tipo_documento as enum
  ('termos', 'privacidade', 'cookies', 'reembolso', 'arrependimento', 'marketing', 'match', 'hall_of_fame');
create type public.tipo_pedido_gdpr as enum ('exportacao', 'exclusao', 'retificacao');
create type public.status_pedido as enum ('recebido', 'em_andamento', 'concluido', 'recusado');

create function private.exigir_2fa(t regclass) returns void
language plpgsql
set search_path = ''
as $$
declare
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = t);
begin
  execute format('create policy %I on %s as restrictive for insert to authenticated '
                 'with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', n || '_2fa_insere', t);
  execute format('create policy %I on %s as restrictive for update to authenticated '
                 'using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')',
                 n || '_2fa_altera', t);
  execute format('create policy %I on %s as restrictive for delete to authenticated '
                 'using ((select auth.jwt() ->> ''aal'') = ''aal2'')', n || '_2fa_apaga', t);
end $$;
revoke all on function private.exigir_2fa(regclass) from public, anon, authenticated;

-- Pendencia antiga ("2FA restritivo em setores"): equipe ja tinha; setores ganha agora.
select private.exigir_2fa('public.setores');

-- log_admin: quem, o que, quando (ADM-09). ator_id sem FK: o log sobrevive a exclusao do ator.
create table public.log_admin (
  id bigint generated always as identity primary key,
  ator_id uuid not null,
  acao text not null check (acao in ('insert', 'update', 'delete', 'rpc')),
  tabela text not null,
  alvo_id text,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);
create index log_admin_tabela_alvo_idx on public.log_admin (tabela, alvo_id);
create index log_admin_criado_em_idx on public.log_admin (criado_em);

alter table public.log_admin enable row level security;
grant select on public.log_admin to authenticated;
-- Sem insert, update nem delete para usuarios: so os gatilhos e as RPCs (security definer) escrevem.
create policy log_admin_super_admin_le on public.log_admin for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');
create policy log_admin_auditor_le on public.log_admin for select to authenticated
  using ((select private.papel_atual()) = 'auditor'
         and tabela in ('contas_stripe', 'planos', 'assinaturas', 'pagamentos', 'pagamentos_itens', 'reembolsos',
                        'receitas_externas', 'cambio_bce', 'relatorios_ciclo'));

-- Grava SO quando quem escreve e equipe com aal2. alvo_id: id, ou a 1a coluna de chave conhecida.
create function private.registrar_log() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_j jsonb := coalesce(v_depois, v_antes);
begin
  if (select private.papel_atual()) is not null then
    insert into public.log_admin (ator_id, acao, tabela, alvo_id, antes, depois)
    values ((select auth.uid()), lower(tg_op), tg_table_name,
            coalesce(v_j ->> 'id', v_j ->> 'perfil_id', v_j ->> 'aula_id', v_j ->> 'ciclo_inicio', v_j ->> 'data'),
            v_antes, v_depois);
  end if;
  return null;
end $$;
revoke all on function private.registrar_log() from public, anon, authenticated;

-- Para RPCs que registram uma acao sem escrita propria numa tabela com gatilho.
create function private.log_rpc(p_tabela text, p_alvo text, p_depois jsonb) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.log_admin (ator_id, acao, tabela, alvo_id, depois)
  select (select auth.uid()), 'rpc', p_tabela, p_alvo, p_depois where (select auth.uid()) is not null;
$$;
revoke all on function private.log_rpc(text, text, jsonb) from public, anon, authenticated;

create function private.registrar_log_em(t regclass) returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger log_admin after insert or update or delete on %s '
                 'for each row execute function private.registrar_log()', t);
end $$;
revoke all on function private.registrar_log_em(regclass) from public, anon, authenticated;

select private.registrar_log_em('public.setores');
select private.registrar_log_em('public.equipe');
select private.registrar_log_em('public.perfis');
select private.registrar_log_em('public.planos');

-- documentos_legais: textos versionados (LEG-01, ASS-10, HOF-04, MAT-02, EML-07). Uma versao nova e uma linha
-- nova; sem update nem delete. Nenhum texto vem de migration: os textos sao das Contratantes e do solicitor.
-- sha256 calculado pelo banco (nunca vem da tela).
create table public.documentos_legais (
  id bigint generated always as identity primary key,
  tipo public.tipo_documento not null,
  versao text not null check (versao ~ '^[0-9A-Za-z._-]{1,40}$'),
  idioma char(2) not null check (idioma in ('pt', 'en')),
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  conteudo_md text not null check (length(conteudo_md) between 1 and 200000),
  sha256 text not null,
  vigente_desde timestamptz not null default now(),
  publicado_por uuid,
  criado_em timestamptz not null default now(),
  unique (tipo, versao, idioma)
);
create index documentos_legais_vigente_idx on public.documentos_legais (tipo, idioma, vigente_desde desc);

create function private.documentos_legais_preencher() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sha256 := encode(sha256(convert_to(new.conteudo_md, 'UTF8')), 'hex');
  new.publicado_por := (select auth.uid());
  return new;
end $$;
create trigger documentos_legais_preencher before insert on public.documentos_legais
  for each row execute function private.documentos_legais_preencher();

alter table public.documentos_legais enable row level security;
grant select on public.documentos_legais to anon, authenticated;
grant insert (tipo, versao, idioma, titulo, conteudo_md, vigente_desde) on public.documentos_legais to authenticated;
create policy documentos_legais_le on public.documentos_legais for select to anon, authenticated using (true);
create policy documentos_legais_super_admin_insere on public.documentos_legais for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
select private.exigir_2fa('public.documentos_legais');
select private.registrar_log_em('public.documentos_legais');

-- consentimentos: aceites e revogacoes de membros e de premiados sem conta: termos, privacidade, cookies de quem
-- esta logado, opt-in do Match, marketing e Hall of Fame (data = aceito_em, tipo e versao = documento_id).
-- A prova do aceite no checkout (Decisao 50) NAO mora aqui: vem da branch aceite-checkout (registrar_aceite_checkout).
-- titular_email e copiado do auth.users no insert: a prova sobrevive ao set null da exclusao (art. 7(1)).
create table public.consentimentos (
  id bigint generated always as identity primary key,
  documento_id bigint not null references public.documentos_legais (id) on delete restrict,
  perfil_id uuid references public.perfis (id) on delete set null,
  titular_email text not null check (length(titular_email) between 3 and 254),
  titular_nome text check (length(titular_nome) <= 200),
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz,
  evidencia text check (length(evidencia) <= 500),
  registrado_por uuid,
  criado_em timestamptz not null default now()
);
create index consentimentos_documento_id_idx on public.consentimentos (documento_id);
create index consentimentos_vigente_idx on public.consentimentos (perfil_id, documento_id) where revogado_em is null;

-- Membro: perfil_id = ele mesmo (RLS); e-mail e nome vem do banco; aceito_em = agora (sem data retroativa).
-- super_admin (premiado sem conta, formulario assinado): informa e-mail, nome e a data real do aceite.
create function private.consentimentos_preencher() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.registrado_por := (select auth.uid());
  new.revogado_em := null;
  if new.perfil_id is not null then
    select u.email into new.titular_email from auth.users u where u.id = new.perfil_id;
    if new.titular_email is null then
      raise exception 'titular_sem_email' using errcode = 'P0001';
    end if;
    new.titular_nome := coalesce(new.titular_nome, (select p.nome from public.perfis p where p.id = new.perfil_id));
  end if;
  if (select private.papel_atual()) is distinct from 'super_admin' then
    new.aceito_em := now();
  end if;
  return new;
end $$;
revoke all on function private.consentimentos_preencher() from public, anon, authenticated;
create trigger consentimentos_preencher before insert on public.consentimentos
  for each row execute function private.consentimentos_preencher();

-- Revogar e definitivo: revogado_em vai para now() uma vez; nao volta a nulo (novo aceite = linha nova).
create function private.consentimentos_revogar() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revogado_em is not null then
    raise exception 'ja_revogado' using errcode = 'P0001';
  end if;
  if new.revogado_em is null then
    raise exception 'revogacao_invalida' using errcode = 'P0001';
  end if;
  new.revogado_em := now();
  return new;
end $$;
-- "of revogado_em": o set null de perfil_id na exclusao de conta nao passa por aqui.
create trigger consentimentos_revogar before update of revogado_em on public.consentimentos
  for each row execute function private.consentimentos_revogar();

alter table public.consentimentos enable row level security;
grant select on public.consentimentos to authenticated;
grant insert (documento_id, perfil_id, titular_email, titular_nome, aceito_em, evidencia) on public.consentimentos to authenticated;
grant update (revogado_em) on public.consentimentos to authenticated;

create policy consentimentos_dono_le on public.consentimentos for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy consentimentos_dono_insere on public.consentimentos for insert to authenticated
  with check (perfil_id = (select auth.uid()));
create policy consentimentos_dono_revoga on public.consentimentos for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));
create policy consentimentos_super_admin_le on public.consentimentos for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');
-- Premiado sem conta: a equipe registra (perfil_id nulo) e revoga quando o titular pede por fora.
create policy consentimentos_super_admin_insere on public.consentimentos for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin' and perfil_id is null);
create policy consentimentos_super_admin_revoga on public.consentimentos for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
select private.registrar_log_em('public.consentimentos');

-- pedidos_gdpr: exportacao, exclusao, retificacao (CON-04). prazo_em = recebimento + 1 mes (RGPD art. 12(3),
-- conferido na nota de reembolso de 31/10), na data de Dublin. Retencao: set null, nunca cascata.
create table public.pedidos_gdpr (
  id bigint generated always as identity primary key,
  perfil_id uuid references public.perfis (id) on delete set null,
  email text not null check (length(email) between 3 and 254),
  tipo public.tipo_pedido_gdpr not null,
  status public.status_pedido not null default 'recebido',
  prazo_em date not null,
  concluido_em timestamptz,
  atendido_por uuid,
  observacao text check (length(observacao) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedidos_gdpr_perfil_id_idx on public.pedidos_gdpr (perfil_id);
create index pedidos_gdpr_pendentes_idx on public.pedidos_gdpr (prazo_em) where status in ('recebido', 'em_andamento');
-- Um pedido aberto por tipo e por pessoa (evita fila inflada por clique repetido).
create unique index pedidos_gdpr_aberto_uq on public.pedidos_gdpr (perfil_id, tipo)
  where perfil_id is not null and status in ('recebido', 'em_andamento');

create function private.pedidos_gdpr_preencher() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.perfil_id is not null then
      select u.email into new.email from auth.users u where u.id = new.perfil_id;
    end if;
    if (select private.papel_atual()) is distinct from 'super_admin' then
      new.status := 'recebido';
      new.observacao := null;
    end if;
    new.prazo_em := ((now() at time zone 'Europe/Dublin')::date + interval '1 month')::date;
    new.concluido_em := null;
    new.atendido_por := null;
  end if;
  if new.status in ('concluido', 'recusado') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.concluido_em := now();
    new.atendido_por := (select auth.uid());
  end if;
  return new;
end $$;
revoke all on function private.pedidos_gdpr_preencher() from public, anon, authenticated;
create trigger pedidos_gdpr_preencher before insert or update on public.pedidos_gdpr
  for each row execute function private.pedidos_gdpr_preencher();
create trigger pedidos_gdpr_atualizado_em before update on public.pedidos_gdpr
  for each row execute function private.set_atualizado_em();

alter table public.pedidos_gdpr enable row level security;
grant select on public.pedidos_gdpr to authenticated;
grant insert (perfil_id, tipo) on public.pedidos_gdpr to authenticated;
grant update (status, observacao) on public.pedidos_gdpr to authenticated;
create policy pedidos_gdpr_dono_le on public.pedidos_gdpr for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy pedidos_gdpr_dono_insere on public.pedidos_gdpr for insert to authenticated
  with check (perfil_id = (select auth.uid()));
create policy pedidos_gdpr_super_admin_le on public.pedidos_gdpr for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');
create policy pedidos_gdpr_super_admin_altera on public.pedidos_gdpr for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
select private.registrar_log_em('public.pedidos_gdpr');

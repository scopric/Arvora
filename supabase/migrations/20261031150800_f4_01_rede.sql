-- F4 rede (PRD 9.1.3, NET e MAT): perfis_contato, categorias_rede, network_itens, conexoes, sugestoes_match,
-- a vitrine de perfis (Decisao 24) e o job semanal do Match.
-- Matriz §5: Clube ve perfis (sem busca nem pedido de conexao); Grupo cria, busca, conecta e e encontrado.
-- Papel de equipe nao abre Network nem conexoes (tem_acesso, nao pode_ver_conteudo).
-- bloqueios (NET-05) e P1 e nao nasce aqui; quando nascer, as politicas passam a chamar private.bloqueado().

create type public.tipo_network as enum ('procura', 'oferece');
create type public.status_conexao as enum ('pendente', 'aceita', 'recusada', 'cancelada');
create type public.origem_conexao as enum ('busca', 'match');

-- Vitrine de perfis alheios (Decisao 24): so colunas publicas. security_invoker: valem o RLS e os grants de
-- perfis de quem consulta (membro ve membros; anon ve so publico aprovado). O front lista perfis por aqui.
create view public.perfis_vitrine with (security_invoker = true) as
  select id, nome, slug, foto_path, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio
  from public.perfis;
grant select on public.perfis_vitrine to anon, authenticated;

-- perfis_contato: so o dono le e escreve; terceiros so por revelar_contato() com conexao aceita.
create table public.perfis_contato (
  perfil_id uuid primary key references public.perfis (id) on delete cascade default auth.uid(),
  email_contato text check (email_contato ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email_contato) <= 254),
  whatsapp text check (whatsapp ~ '^\+[0-9]{8,15}$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger perfis_contato_atualizado_em before update on public.perfis_contato
  for each row execute function private.set_atualizado_em();
alter table public.perfis_contato enable row level security;
grant select, delete on public.perfis_contato to authenticated;
grant insert (email_contato, whatsapp), update (email_contato, whatsapp) on public.perfis_contato to authenticated;
create policy perfis_contato_dono_le on public.perfis_contato for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy perfis_contato_dono_insere on public.perfis_contato for insert to authenticated
  with check (perfil_id = (select auth.uid()));
create policy perfis_contato_dono_altera on public.perfis_contato for update to authenticated
  using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));
create policy perfis_contato_dono_apaga on public.perfis_contato for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- categorias_rede: uma lista para procura e oferta (o match compara ids iguais).
create table public.categorias_rede (
  id bigint generated always as identity primary key,
  nome text not null check (length(btrim(nome)) between 1 and 80),
  nome_en text check (nome_en is null or length(btrim(nome_en)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger categorias_rede_atualizado_em before update on public.categorias_rede
  for each row execute function private.set_atualizado_em();
alter table public.categorias_rede enable row level security;
grant select on public.categorias_rede to anon, authenticated;
grant insert, update, delete on public.categorias_rede to authenticated;
create policy categorias_rede_le on public.categorias_rede for select to anon, authenticated using (ativa);
create policy categorias_rede_editor_le on public.categorias_rede for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy categorias_rede_editor_insere on public.categorias_rede for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy categorias_rede_editor_altera on public.categorias_rede for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy categorias_rede_editor_apaga on public.categorias_rede for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.categorias_rede');
select private.registrar_log_em('public.categorias_rede');

-- network_itens: o que procuro e o que ofereco (NET-01). Leitura de membros respeita o RLS de perfis
-- (visibilidade, suspensao); escrita so do dono com nivel Grupo.
create table public.network_itens (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  tipo public.tipo_network not null,
  categoria_id bigint not null references public.categorias_rede (id) on delete restrict,
  texto text check (length(texto) <= 280),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (perfil_id, tipo, categoria_id)
);
create index network_itens_categoria_tipo_idx on public.network_itens (categoria_id, tipo);
create trigger network_itens_atualizado_em before update on public.network_itens
  for each row execute function private.set_atualizado_em();
alter table public.network_itens enable row level security;
grant select, delete on public.network_itens to authenticated;
grant insert (tipo, categoria_id, texto), update (texto) on public.network_itens to authenticated;
create policy network_itens_dono_le on public.network_itens for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy network_itens_membro_le on public.network_itens for select to authenticated
  using ((select public.tem_acesso('clube'))
         and exists (select 1 from public.perfis p where p.id = network_itens.perfil_id and p.suspenso_em is null));
create policy network_itens_equipe_le on public.network_itens for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'moderador'));
create policy network_itens_dono_insere on public.network_itens for insert to authenticated
  with check (perfil_id = (select auth.uid()) and (select public.tem_acesso('grupo')));
create policy network_itens_dono_altera on public.network_itens for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()) and (select public.tem_acesso('grupo')));
create policy network_itens_dono_apaga on public.network_itens for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- Alguem pode receber pedido de conexao/sugestao: existe, nao suspenso, nivel Grupo.
create function private.na_rede(p uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis x where x.id = p and x.suspenso_em is null)
     and private.nivel_atual(p) = 'grupo';
$$;
revoke all on function private.na_rede(uuid) from public, anon;
grant execute on function private.na_rede(uuid) to authenticated;

-- conexoes (NET-03). Um par, uma linha. Transicoes decididas pelo gatilho; limite de 20 pedidos por 24 h.
create table public.conexoes (
  id bigint generated always as identity primary key,
  solicitante_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  destinatario_id uuid not null references public.perfis (id) on delete cascade,
  status public.status_conexao not null default 'pendente',
  origem public.origem_conexao not null,
  mensagem text check (length(mensagem) <= 500),
  pedida_em timestamptz not null default now(),
  respondida_em timestamptz,
  criado_em timestamptz not null default now(),
  check (solicitante_id <> destinatario_id)
);
create unique index conexoes_par_uq on public.conexoes (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));
create index conexoes_destinatario_pendente_idx on public.conexoes (destinatario_id) where status = 'pendente';
create index conexoes_destinatario_id_idx on public.conexoes (destinatario_id);
create index conexoes_solicitante_pedida_idx on public.conexoes (solicitante_id, pedida_em);

create function private.conexoes_transicao() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_outro uuid;
begin
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.pedida_em := now();
    new.respondida_em := null;
  elsif old.status = 'pendente' and new.status in ('aceita', 'recusada') then
    if uid is distinct from old.destinatario_id then
      raise exception 'transicao_invalida: so o destinatario responde' using errcode = 'P0001';
    end if;
    new.respondida_em := now();
    new.mensagem := old.mensagem;
  elsif new.status = 'cancelada' and (old.status = 'pendente' and uid = old.solicitante_id
                                      or old.status = 'aceita' and uid in (old.solicitante_id, old.destinatario_id)) then
    new.respondida_em := now();
    new.mensagem := old.mensagem;
  elsif old.status in ('recusada', 'cancelada') and new.status = 'pendente' then
    if uid not in (old.solicitante_id, old.destinatario_id) or old.respondida_em > now() - interval '30 days' then
      raise exception 'transicao_invalida: novo pedido so 30 dias depois' using errcode = 'P0001';
    end if;
    if not public.tem_acesso('grupo') then
      raise exception 'sem_acesso' using errcode = '42501';
    end if;
    v_outro := case when uid = old.solicitante_id then old.destinatario_id else old.solicitante_id end;
    if not private.na_rede(v_outro) then
      raise exception 'destinatario_indisponivel' using errcode = 'P0001';
    end if;
    new.solicitante_id := uid;
    new.destinatario_id := v_outro;
    new.pedida_em := now();
    new.respondida_em := null;
  elsif new.status = old.status and old.status = 'pendente' and uid = old.solicitante_id then
    null; -- o solicitante ajusta a mensagem enquanto pendente
  else
    raise exception 'transicao_invalida' using errcode = 'P0001';
  end if;
  if new.status = 'pendente' and (tg_op = 'INSERT' or old.status <> 'pendente')
     and (select count(*) from public.conexoes c
          where c.solicitante_id = new.solicitante_id and c.pedida_em > now() - interval '24 hours') >= 20 then
    raise exception 'limite_conexoes' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.conexoes_transicao() from public, anon, authenticated;
create trigger conexoes_transicao before insert or update on public.conexoes
  for each row execute function private.conexoes_transicao();

-- Notificacoes do sino (o e-mail EML-04 fica para quando houver envio de e-mail).
create function private.conexoes_notificar() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'pendente' and (tg_op = 'INSERT' or old.status <> 'pendente') then
    insert into public.notificacoes (perfil_id, tipo, titulo, link)
    values (new.destinatario_id, 'conexao_recebida', 'Novo pedido de conexao', '/rede/conexoes');
  elsif tg_op = 'UPDATE' and new.status = 'aceita' and old.status = 'pendente' then
    insert into public.notificacoes (perfil_id, tipo, titulo, link)
    values (new.solicitante_id, 'conexao_aceita', 'Seu pedido de conexao foi aceito', '/rede/conexoes');
  end if;
  return null;
end $$;
revoke all on function private.conexoes_notificar() from public, anon, authenticated;
create trigger conexoes_notificar after insert or update on public.conexoes
  for each row execute function private.conexoes_notificar();

alter table public.conexoes enable row level security;
grant select on public.conexoes to authenticated;
grant insert (destinatario_id, origem, mensagem), update (status, mensagem) on public.conexoes to authenticated;
create policy conexoes_partes_le on public.conexoes for select to authenticated
  using ((select auth.uid()) in (solicitante_id, destinatario_id));
create policy conexoes_grupo_pede on public.conexoes for insert to authenticated
  with check (solicitante_id = (select auth.uid()) and (select public.tem_acesso('grupo'))
              and (select private.na_rede(destinatario_id)));
create policy conexoes_partes_alteram on public.conexoes for update to authenticated
  using ((select auth.uid()) in (solicitante_id, destinatario_id))
  with check ((select auth.uid()) in (solicitante_id, destinatario_id));

-- Contato so com conexao aceita entre os dois (NET-03).
create function public.revelar_contato(outro uuid) returns table (email_contato text, whatsapp text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.conexoes c where c.status = 'aceita'
                 and ((c.solicitante_id = (select auth.uid()) and c.destinatario_id = outro)
                      or (c.destinatario_id = (select auth.uid()) and c.solicitante_id = outro))) then
    raise exception 'sem_conexao_aceita' using errcode = '42501';
  end if;
  return query select pc.email_contato, pc.whatsapp from public.perfis_contato pc where pc.perfil_id = outro;
end $$;
revoke all on function public.revelar_contato(uuid) from public, anon;
grant execute on function public.revelar_contato(uuid) to authenticated;

-- Busca de membros (NET-02), so Grupo, so colunas de vitrine, sem suspensos e sem o proprio.
create function public.buscar_membros(filtro_setor bigint default null, filtro_cidade text default null,
                                      filtro_categoria bigint default null, filtro_tipo public.tipo_network default null,
                                      limite int default 30, pular int default 0)
returns table (id uuid, nome text, slug text, foto_path text, empresa_nome text, setor_id bigint, cidade text,
               pais char(2), linkedin_url text, instagram text, bio text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.tem_acesso('grupo') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return query
  select p.id, p.nome, p.slug, p.foto_path, p.empresa_nome, p.setor_id, p.cidade, p.pais, p.linkedin_url, p.instagram, p.bio
  from public.perfis p
  where p.id <> (select auth.uid()) and p.suspenso_em is null and private.nivel_atual(p.id) = 'grupo'
    and (buscar_membros.filtro_setor is null or p.setor_id = buscar_membros.filtro_setor)
    and (buscar_membros.filtro_cidade is null or lower(p.cidade) = lower(btrim(buscar_membros.filtro_cidade)))
    and (buscar_membros.filtro_categoria is null or exists (
          select 1 from public.network_itens n where n.perfil_id = p.id and n.categoria_id = buscar_membros.filtro_categoria
          and (buscar_membros.filtro_tipo is null or n.tipo = buscar_membros.filtro_tipo)))
  order by p.nome, p.id
  limit least(greatest(coalesce(limite, 30), 1), 100) offset greatest(coalesce(pular, 0), 0);
end $$;
revoke all on function public.buscar_membros(bigint, text, bigint, public.tipo_network, int, int) from public, anon;
grant execute on function public.buscar_membros(bigint, text, bigint, public.tipo_network, int, int) to authenticated;

-- sugestoes_match (MAT-01): geradas pelo job semanal; o dono le enquanto for Grupo.
create table public.sugestoes_match (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  sugerido_id uuid not null references public.perfis (id) on delete cascade,
  semana date not null,
  pontuacao smallint not null,
  motivo text not null check (length(motivo) <= 500),
  criado_em timestamptz not null default now(),
  unique (perfil_id, sugerido_id, semana)
);
create index sugestoes_match_sugerido_id_idx on public.sugestoes_match (sugerido_id);
create index sugestoes_match_perfil_semana_idx on public.sugestoes_match (perfil_id, semana desc);
alter table public.sugestoes_match enable row level security;
grant select on public.sugestoes_match to authenticated;
create policy sugestoes_match_dono_le on public.sugestoes_match for select to authenticated
  using (perfil_id = (select auth.uid()) and (select public.tem_acesso('grupo')));

-- Match semanal (PRD 7.9, algoritmo do MVP): membros Grupo, nao suspensos, com consentimento 'match' vigente
-- (opt-in MAT-02; desligar = revogar). Pontos: procura de A x oferece de B = 3, mesma cidade = 2, mesmo setor = 1.
-- Exclui pares com conexao em qualquer status. Top 5 por pessoa. Motivo em pt (o en fica para depois).
-- Idempotente por semana (unique). semana = segunda-feira da data dada.
create function private.gerar_sugestoes_match(p_semana date) returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_semana date := (p_semana - ((extract(isodow from p_semana)::int - 1) * interval '1 day'))::date;
  n int;
begin
  with candidatos as (
    select p.id, lower(btrim(p.cidade)) cidade, p.cidade cidade_txt, p.setor_id
    from public.perfis p
    where p.suspenso_em is null and private.nivel_atual(p.id) = 'grupo'
      and exists (select 1 from public.consentimentos c join public.documentos_legais d on d.id = c.documento_id
                  where c.perfil_id = p.id and c.revogado_em is null and d.tipo = 'match')
  ), pares as (
    select a.id a_id, b.id b_id,
           (select cr.nome from public.network_itens na join public.network_itens nb
              on nb.categoria_id = na.categoria_id and nb.perfil_id = b.id and nb.tipo = 'oferece'
            join public.categorias_rede cr on cr.id = na.categoria_id
            where na.perfil_id = a.id and na.tipo = 'procura' order by cr.ordem, cr.id limit 1) cat,
           (a.cidade is not null and a.cidade = b.cidade) mesma_cidade, b.cidade_txt,
           (a.setor_id is not null and a.setor_id = b.setor_id) mesmo_setor
    from candidatos a join candidatos b on b.id <> a.id
    where not exists (select 1 from public.conexoes c
                      where least(c.solicitante_id, c.destinatario_id) = least(a.id, b.id)
                        and greatest(c.solicitante_id, c.destinatario_id) = greatest(a.id, b.id))
  ), pontuados as (
    select a_id, b_id,
           (case when cat is not null then 3 else 0 end + case when mesma_cidade then 2 else 0 end
            + case when mesmo_setor then 1 else 0 end)::smallint pontos,
           concat_ws('; ', case when cat is not null then 'oferece ' || cat || ', que voce procura' end,
                           case when mesma_cidade then 'mesma cidade (' || cidade_txt || ')' end,
                           case when mesmo_setor then 'mesmo setor' end) motivo
    from pares
  ), top as (
    select *, row_number() over (partition by a_id order by pontos desc, b_id) r from pontuados where pontos > 0
  )
  insert into public.sugestoes_match (perfil_id, sugerido_id, semana, pontuacao, motivo)
  select a_id, b_id, v_semana, pontos, motivo from top where r <= 5
  on conflict (perfil_id, sugerido_id, semana) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.gerar_sugestoes_match(date) from public, anon, authenticated;

select cron.schedule('match-semanal', '0 6 * * 1', 'select private.gerar_sugestoes_match(current_date)');

-- denuncias: alvo conexao (NET-04).
alter table public.denuncias add column conexao_id bigint references public.conexoes (id) on delete set null;
create index denuncias_conexao_id_idx on public.denuncias (conexao_id);
grant insert (conexao_id) on public.denuncias to authenticated;

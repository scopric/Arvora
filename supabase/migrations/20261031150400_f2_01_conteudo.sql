-- F2 conteudo (PRD 9.1.3): cursos, modulos, aulas (gravadas e ao vivo), transmissoes (link principal e reserva),
-- materiais_aula (resumo, e-book, exercicios), exercicios, entregas (fila de correcao), progresso_aula e
-- notificacoes (o sino), com as RPCs aprovar_material, corrigir_entrega e link_transmissao.
-- Matriz §5: o acesso ao conteudo sai do nivel_minimo de cada linha (pode_ver_conteudo); a equipe (aal2) ve tudo.
-- Enviar entrega exige assinatura ativa (tem_acesso), nao basta ser equipe.

create type public.tipo_aula as enum ('gravada', 'ao_vivo');
create type public.tipo_material as enum ('resumo', 'ebook', 'exercicios');
create type public.status_material as enum ('rascunho', 'aprovado');
create type public.status_entrega as enum ('enviada', 'aprovada', 'ajustar');
create type public.tipo_notificacao as enum ('conexao_recebida', 'conexao_aceita', 'aula_publicada', 'sistema');

-- Tarefas de Arvora Bem-Estar dependem de decisao juridica (dado de saude, PRD §11 e §15 n. 13b). Restritivo:
-- nenhuma vertical aceita entregas ate a equipe ligar, vertical por vertical.
alter table public.verticais add column aceita_entregas boolean not null default false;

-- cursos ---------------------------------------------------------------------------------------------------
create table public.cursos (
  id bigint generated always as identity primary key,
  vertical_id bigint not null references public.verticais (id) on delete restrict,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  descricao text check (length(descricao) <= 4000),
  capa_path text check (length(capa_path) <= 300),
  nivel_minimo public.nivel_acesso not null default 'grupo',
  ordem int not null default 0,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index cursos_vertical_id_idx on public.cursos (vertical_id);
create trigger cursos_atualizado_em before update on public.cursos
  for each row execute function private.set_atualizado_em();
alter table public.cursos enable row level security;
grant select on public.cursos to anon, authenticated;
grant insert, update, delete on public.cursos to authenticated;
create policy cursos_publicados_le on public.cursos for select to anon, authenticated using (publicado_em is not null);
create policy cursos_equipe_le on public.cursos for select to authenticated using ((select private.papel_atual()) is not null);
create policy cursos_editor_insere on public.cursos for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy cursos_editor_altera on public.cursos for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy cursos_editor_apaga on public.cursos for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.cursos');
select private.registrar_log_em('public.cursos');

-- modulos: visiveis quando o curso esta visivel (o exists passa pelo RLS de cursos).
create table public.modulos (
  id bigint generated always as identity primary key,
  curso_id bigint not null references public.cursos (id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  ordem int not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (curso_id, ordem)
);
create trigger modulos_atualizado_em before update on public.modulos
  for each row execute function private.set_atualizado_em();
alter table public.modulos enable row level security;
grant select on public.modulos to anon, authenticated;
grant insert, update, delete on public.modulos to authenticated;
create policy modulos_le on public.modulos for select to anon, authenticated
  using (exists (select 1 from public.cursos c where c.id = modulos.curso_id));
create policy modulos_editor_insere on public.modulos for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy modulos_editor_altera on public.modulos for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy modulos_editor_apaga on public.modulos for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.modulos');
select private.registrar_log_em('public.modulos');

-- aulas: gravadas e ao vivo. "Agendar" (agendada_em) poe no calendario sem aviso; "Publicar materiais"
-- (materiais_publicados_em) libera gravacao e materiais e gera as notificacoes. Rascunho (as duas nulas) so a
-- equipe ve. O video so toca com URL assinada gerada no servidor depois de pode_ver_conteudo(nivel_minimo);
-- video_id nao sai para anon (grant por coluna).
create table public.aulas (
  id bigint generated always as identity primary key,
  modulo_id bigint references public.modulos (id) on delete cascade,
  vertical_id bigint not null references public.verticais (id) on delete restrict,
  especialista_id uuid references public.perfis (id) on delete set null,
  tipo public.tipo_aula not null,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  descricao text check (length(descricao) <= 4000),
  nivel_minimo public.nivel_acesso not null default 'grupo',
  ordem int not null default 0,
  inicio_em timestamptz,
  duracao_min int check (duracao_min > 0 and duracao_min <= 1440),
  video_id text check (length(video_id) <= 200),
  trailer_video_id text check (length(trailer_video_id) <= 200),
  agendada_em timestamptz,
  materiais_publicados_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (tipo <> 'ao_vivo' or inicio_em is not null),
  check (materiais_publicados_em is null or duracao_min is not null)
);
create index aulas_modulo_id_idx on public.aulas (modulo_id);
create index aulas_especialista_id_idx on public.aulas (especialista_id);
create index aulas_calendario_idx on public.aulas (inicio_em) where agendada_em is not null;
create index aulas_vertical_publicacao_idx on public.aulas (vertical_id, materiais_publicados_em);
create trigger aulas_atualizado_em before update on public.aulas
  for each row execute function private.set_atualizado_em();
alter table public.aulas enable row level security;
grant select (id, modulo_id, vertical_id, tipo, titulo, slug, descricao, nivel_minimo, ordem, inicio_em, duracao_min,
              trailer_video_id, agendada_em, materiais_publicados_em, criado_em, atualizado_em)
  on public.aulas to anon;
grant select on public.aulas to authenticated;
grant insert, update, delete on public.aulas to authenticated;
create policy aulas_le on public.aulas for select to anon, authenticated
  using ((agendada_em is not null or materiais_publicados_em is not null)
         and (modulo_id is null or exists (select 1 from public.modulos m where m.id = aulas.modulo_id)));
create policy aulas_equipe_le on public.aulas for select to authenticated using ((select private.papel_atual()) is not null);
create policy aulas_editor_insere on public.aulas for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy aulas_editor_altera on public.aulas for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy aulas_editor_apaga on public.aulas for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.aulas');
select private.registrar_log_em('public.aulas');

-- transmissoes: link da sala ao vivo, fora de aulas para nao vazar no select (AUL-02). Uma sala por live, com
-- link principal e reserva; usar_reserva troca na hora. Leitura so pela equipe e por link_transmissao().
create table public.transmissoes (
  aula_id bigint primary key references public.aulas (id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 500),
  url_reserva text check (url_reserva ~ '^https://' and length(url_reserva) <= 500),
  usar_reserva boolean not null default false,
  abre_min_antes int not null default 15 check (abre_min_antes between 0 and 240),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (not usar_reserva or url_reserva is not null)
);
create trigger transmissoes_atualizado_em before update on public.transmissoes
  for each row execute function private.set_atualizado_em();
alter table public.transmissoes enable row level security;
grant select, insert, update, delete on public.transmissoes to authenticated;
create policy transmissoes_editor_le on public.transmissoes for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy transmissoes_editor_insere on public.transmissoes for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy transmissoes_editor_altera on public.transmissoes for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy transmissoes_editor_apaga on public.transmissoes for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.transmissoes');
select private.registrar_log_em('public.transmissoes');

-- Link da sala: so para quem pode ver a aula (pode_ver_conteudo: assinante do nivel ou equipe), aula agendada,
-- a partir de inicio_em - abre_min_antes. Devolve o reserva quando usar_reserva.
create function public.link_transmissao(aula bigint) returns text
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
  select * into v_aula from public.aulas a where a.id = link_transmissao.aula;
  select * into v_t from public.transmissoes t where t.aula_id = link_transmissao.aula;
  if v_aula.id is null or v_t.aula_id is null or v_aula.agendada_em is null or v_aula.inicio_em is null then
    raise exception 'aula_sem_transmissao' using errcode = 'P0002';
  end if;
  if not public.pode_ver_conteudo(v_aula.nivel_minimo) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if now() < v_aula.inicio_em - make_interval(mins => v_t.abre_min_antes) then
    raise exception 'ainda_nao_abriu' using errcode = 'P0001';
  end if;
  return case when v_t.usar_reserva then v_t.url_reserva else v_t.url end;
end $$;
revoke all on function public.link_transmissao(bigint) from public, anon;
grant execute on function public.link_transmissao(bigint) to authenticated;

-- materiais_aula: "nada de IA no ar sem revisao" no proprio banco. Nasce rascunho; editar conteudo ou arquivo
-- volta para rascunho; aprovar so por aprovar_material(). O membro le so aprovado + aula publicada + nivel.
create table public.materiais_aula (
  id bigint generated always as identity primary key,
  aula_id bigint not null references public.aulas (id) on delete cascade,
  tipo public.tipo_material not null,
  conteudo_md text check (length(conteudo_md) <= 200000),
  arquivo_path text check (length(arquivo_path) <= 300),
  status public.status_material not null default 'rascunho',
  aprovado_por uuid,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (aula_id, tipo),
  check (status <> 'aprovado' or aprovado_por is not null),
  check (conteudo_md is not null or arquivo_path is not null)
);
create function private.materiais_aula_revisao() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.conteudo_md, new.arquivo_path) is distinct from (old.conteudo_md, old.arquivo_path) then
    new.status := 'rascunho';
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end $$;
create trigger materiais_aula_revisao before update on public.materiais_aula
  for each row execute function private.materiais_aula_revisao();
create trigger materiais_aula_atualizado_em before update on public.materiais_aula
  for each row execute function private.set_atualizado_em();
alter table public.materiais_aula enable row level security;
grant select on public.materiais_aula to authenticated;
grant insert (aula_id, tipo, conteudo_md, arquivo_path), update (conteudo_md, arquivo_path), delete
  on public.materiais_aula to authenticated;
create policy materiais_aula_membro_le on public.materiais_aula for select to authenticated
  using (status = 'aprovado'
         and exists (select 1 from public.aulas a where a.id = materiais_aula.aula_id
                     and a.materiais_publicados_em is not null and (select public.pode_ver_conteudo(a.nivel_minimo))));
create policy materiais_aula_editor_le on public.materiais_aula for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_aula_editor_insere on public.materiais_aula for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_aula_editor_altera on public.materiais_aula for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_aula_editor_apaga on public.materiais_aula for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.materiais_aula');
select private.registrar_log_em('public.materiais_aula');

create function public.aprovar_material(material bigint) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'editor') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.materiais_aula set status = 'aprovado', aprovado_por = (select auth.uid()), aprovado_em = now()
  where id = material and status = 'rascunho';
  if not found then
    raise exception 'material_inexistente_ou_aprovado' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.aprovar_material(bigint) from public, anon;
grant execute on function public.aprovar_material(bigint) to authenticated;

-- exercicios: enunciados das tarefas (AUL-04, Decisao 11).
create table public.exercicios (
  id bigint generated always as identity primary key,
  aula_id bigint not null references public.aulas (id) on delete cascade,
  ordem int not null,
  enunciado_md text not null check (length(enunciado_md) between 1 and 20000),
  prazo_dias int check (prazo_dias between 1 and 365),
  aceita_arquivo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (aula_id, ordem)
);
create trigger exercicios_atualizado_em before update on public.exercicios
  for each row execute function private.set_atualizado_em();
alter table public.exercicios enable row level security;
grant select on public.exercicios to authenticated;
grant insert, update, delete on public.exercicios to authenticated;
create policy exercicios_membro_le on public.exercicios for select to authenticated
  using (exists (select 1 from public.aulas a where a.id = exercicios.aula_id
                 and a.materiais_publicados_em is not null and (select public.pode_ver_conteudo(a.nivel_minimo))));
create policy exercicios_equipe_le on public.exercicios for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor', 'corretor'));
create policy exercicios_editor_insere on public.exercicios for insert to authenticated
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy exercicios_editor_altera on public.exercicios for update to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'))
  with check ((select private.papel_atual()) in ('super_admin', 'editor'));
create policy exercicios_editor_apaga on public.exercicios for delete to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));
select private.exigir_2fa('public.exercicios');
select private.registrar_log_em('public.exercicios');

-- Pode enviar entrega para este exercicio agora? Aula publicada, assinatura do nivel (tem_acesso, nao equipe)
-- e vertical que aceita entregas. security definer: le aulas/verticais sem depender do RLS do chamador.
create function private.pode_entregar(p_exercicio bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.exercicios e
                 join public.aulas a on a.id = e.aula_id
                 join public.verticais v on v.id = a.vertical_id
                 where e.id = p_exercicio and a.materiais_publicados_em is not null and v.aceita_entregas
                   and (select public.tem_acesso(a.nivel_minimo)));
$$;
revoke all on function private.pode_entregar(bigint) from public, anon;
grant execute on function private.pode_entregar(bigint) to authenticated;

-- entregas: resposta do membro (texto e/ou arquivo no bucket entregas, em {perfil_id}/...). Conta apagada apaga a
-- entrega (cascade) e o arquivo (excluir-conta remove do Storage antes; um gatilho barra a exclusao se sobrar).
-- O dono reenvia so quando a equipe pediu ajuste; cada reenvio volta o status para 'enviada'.
create table public.entregas (
  id bigint generated always as identity primary key,
  exercicio_id bigint not null references public.exercicios (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  texto text check (length(texto) <= 20000),
  arquivo_path text check (length(arquivo_path) <= 300),
  status public.status_entrega not null default 'enviada',
  devolutiva text check (length(devolutiva) <= 10000),
  corrigido_por uuid,
  corrigido_em timestamptz,
  enviada_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (exercicio_id, perfil_id),
  check (status = 'enviada' or corrigido_por is not null),
  check (texto is not null or arquivo_path is not null),
  check (arquivo_path is null or arquivo_path like perfil_id::text || '/%')
);
create index entregas_perfil_id_idx on public.entregas (perfil_id);
create index entregas_fila_idx on public.entregas (enviada_em) where status = 'enviada';

create function private.entregas_regras() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.arquivo_path is not null
     and not (select e.aceita_arquivo from public.exercicios e where e.id = new.exercicio_id) then
    raise exception 'exercicio_sem_arquivo' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'enviada';
    new.devolutiva := null;
    new.corrigido_por := null;
    new.corrigido_em := null;
    new.enviada_em := now();
  elsif (new.texto, new.arquivo_path) is distinct from (old.texto, old.arquivo_path) then
    new.status := 'enviada';
    new.corrigido_por := null;
    new.corrigido_em := null;
    new.enviada_em := now();
  end if;
  return new;
end $$;
revoke all on function private.entregas_regras() from public, anon, authenticated;
create trigger entregas_regras before insert or update on public.entregas
  for each row execute function private.entregas_regras();
create trigger entregas_atualizado_em before update on public.entregas
  for each row execute function private.set_atualizado_em();

alter table public.entregas enable row level security;
grant select on public.entregas to authenticated;
grant insert (exercicio_id, perfil_id, texto, arquivo_path), update (texto, arquivo_path) on public.entregas to authenticated;
create policy entregas_dono_le on public.entregas for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy entregas_dono_insere on public.entregas for insert to authenticated
  with check (perfil_id = (select auth.uid()) and (select private.pode_entregar(exercicio_id)));
create policy entregas_dono_reenvia on public.entregas for update to authenticated
  using (perfil_id = (select auth.uid()) and status = 'ajustar')
  with check (perfil_id = (select auth.uid()) and (select private.pode_entregar(exercicio_id)));
create policy entregas_corretor_le on public.entregas for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'corretor'));

create function public.corrigir_entrega(entrega bigint, novo_status public.status_entrega, devolutiva text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'corretor') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if novo_status not in ('aprovada', 'ajustar') then
    raise exception 'status_invalido' using errcode = 'P0001';
  end if;
  if novo_status = 'ajustar' and (devolutiva is null or length(btrim(devolutiva)) = 0) then
    raise exception 'devolutiva_obrigatoria' using errcode = 'P0001';
  end if;
  update public.entregas e
     set status = novo_status, devolutiva = corrigir_entrega.devolutiva,
         corrigido_por = (select auth.uid()), corrigido_em = now()
   where e.id = entrega and e.status = 'enviada'
  returning e.perfil_id into v_perfil;
  if v_perfil is null then
    raise exception 'entrega_inexistente_ou_ja_corrigida' using errcode = 'P0002';
  end if;
  insert into public.notificacoes (perfil_id, tipo, titulo, link)
  values (v_perfil, 'sistema', case when novo_status = 'aprovada' then 'Sua entrega foi aprovada'
                                    else 'Sua entrega precisa de ajuste' end, '/tarefas');
  perform private.log_rpc('entregas', entrega::text,
                          jsonb_build_object('rpc', 'corrigir_entrega', 'status', novo_status));
end $$;
revoke all on function public.corrigir_entrega(bigint, public.status_entrega, text) from public, anon;
grant execute on function public.corrigir_entrega(bigint, public.status_entrega, text) to authenticated;

-- progresso_aula: retomar de onde parou (ACA-03, PAI-04). percentual 100 marca concluida_em uma vez.
create table public.progresso_aula (
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  aula_id bigint not null references public.aulas (id) on delete cascade,
  percentual smallint not null default 0 check (percentual between 0 and 100),
  posicao_seg int not null default 0 check (posicao_seg >= 0),
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, aula_id)
);
create index progresso_aula_aula_id_idx on public.progresso_aula (aula_id);
create function private.progresso_aula_concluir() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.percentual = 100 and new.concluida_em is null then
    new.concluida_em := now();
  end if;
  if tg_op = 'UPDATE' then
    new.concluida_em := coalesce(old.concluida_em, new.concluida_em);
  end if;
  return new;
end $$;
create trigger progresso_aula_concluir before insert or update on public.progresso_aula
  for each row execute function private.progresso_aula_concluir();
create trigger progresso_aula_atualizado_em before update on public.progresso_aula
  for each row execute function private.set_atualizado_em();
alter table public.progresso_aula enable row level security;
grant select on public.progresso_aula to authenticated;
grant insert (perfil_id, aula_id, percentual, posicao_seg), update (percentual, posicao_seg) on public.progresso_aula to authenticated;
create policy progresso_aula_dono_le on public.progresso_aula for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy progresso_aula_dono_insere on public.progresso_aula for insert to authenticated
  with check (perfil_id = (select auth.uid())
              and exists (select 1 from public.aulas a where a.id = progresso_aula.aula_id
                          and (select public.pode_ver_conteudo(a.nivel_minimo))));
create policy progresso_aula_dono_altera on public.progresso_aula for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));
-- AUL-08 (P1, proposta do PRD): editor e super_admin veem presenca.
create policy progresso_aula_equipe_le on public.progresso_aula for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'editor'));

-- notificacoes: o sino (LEG-03). Insert so por gatilho/RPC/servico; o dono marca como lida.
create table public.notificacoes (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  tipo public.tipo_notificacao not null,
  titulo text not null check (length(titulo) between 1 and 200),
  link text check (link ~ '^/' and length(link) <= 300),
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_perfil_id_idx on public.notificacoes (perfil_id);
create index notificacoes_nao_lidas_idx on public.notificacoes (perfil_id, criado_em desc) where lida_em is null;
alter table public.notificacoes enable row level security;
grant select, update (lida_em), delete on public.notificacoes to authenticated;
create policy notificacoes_dono_le on public.notificacoes for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy notificacoes_dono_marca on public.notificacoes for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));
create policy notificacoes_dono_apaga on public.notificacoes for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- aviso_materiais: materiais_publicados_em de nulo para preenchido => notificacao a quem tem o nivel da aula.
-- "Agendar" nao dispara nada. O e-mail EML-03 fica para quando houver envio de e-mail (Resend nao existe).
create function private.aviso_materiais() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Aula de curso ainda nao publicado nao avisa (o titulo vazaria antes da hora).
  if new.materiais_publicados_em is not null
     and (tg_op = 'INSERT' or old.materiais_publicados_em is null)
     and (new.modulo_id is null or exists (select 1 from public.modulos m join public.cursos c on c.id = m.curso_id
                                            where m.id = new.modulo_id and c.publicado_em is not null)) then
    insert into public.notificacoes (perfil_id, tipo, titulo, link)
    select p.id, 'aula_publicada', left('Materiais publicados: ' || new.titulo, 200), '/aulas/' || new.slug
    from public.perfis p
    where p.suspenso_em is null and new.nivel_minimo <= private.nivel_atual(p.id) and private.nivel_atual(p.id) <> 'visitante';
  end if;
  return null;
end $$;
revoke all on function private.aviso_materiais() from public, anon, authenticated;
create trigger aviso_materiais after insert or update of materiais_publicados_em on public.aulas
  for each row execute function private.aviso_materiais();

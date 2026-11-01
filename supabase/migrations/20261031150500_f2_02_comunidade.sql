-- F2 comunidade (COM-01/02, Decisao 10): espacos, posts, comentarios, curtidas, denuncias e moderacao.
-- Ler: quem ve o espaco (pode_ver_conteudo do nivel do espaco). Escrever: so com assinatura ativa do nivel
-- (tem_acesso), perfil nao suspenso. Perder o acesso ao cancelar e automatico (nada e gravado no perfil).
-- Exclusao de conta: posts e comentarios ficam sem autoria (set null); curtidas somem (cascade).
-- curtidas: o PRD (COM-01) diz "sem curtidas no lancamento"; a tabela existe porque o pedido deste lote a
-- inclui. Mostrar ou nao na tela e decisao de produto.
-- Editar o proprio post/comentario: ate 15 minutos depois de criado (PROVISORIO). Apagar o proprio: a qualquer
-- momento (PRD §11 pede oferecer ao membro apagar os proprios posts antes de excluir a conta), menos o que a
-- moderacao ocultou (fica como prova).

create type public.status_denuncia as enum ('aberta', 'procedente', 'improcedente');

create table public.espacos (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  titulo text not null check (length(btrim(titulo)) between 1 and 120),
  titulo_en text check (titulo_en is null or length(btrim(titulo_en)) between 1 and 120),
  descricao text check (length(descricao) <= 600),
  nivel_minimo public.nivel_acesso not null check (nivel_minimo <> 'visitante'),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger espacos_atualizado_em before update on public.espacos
  for each row execute function private.set_atualizado_em();
alter table public.espacos enable row level security;
grant select on public.espacos to authenticated;
grant insert, update, delete on public.espacos to authenticated;
create policy espacos_le on public.espacos for select to authenticated
  using ((select public.pode_ver_conteudo(nivel_minimo)));
create policy espacos_super_admin_insere on public.espacos for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');
create policy espacos_super_admin_altera on public.espacos for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');
create policy espacos_super_admin_apaga on public.espacos for delete to authenticated
  using ((select private.papel_atual()) = 'super_admin');
select private.exigir_2fa('public.espacos');
select private.registrar_log_em('public.espacos');

-- Pode escrever no espaco agora? Assinatura do nivel e perfil nao suspenso.
create function private.pode_escrever_espaco(p_espaco bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.espacos e where e.id = p_espaco and (select public.tem_acesso(e.nivel_minimo)))
     and not exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.suspenso_em is not null);
$$;
revoke all on function private.pode_escrever_espaco(bigint) from public, anon;
grant execute on function private.pode_escrever_espaco(bigint) to authenticated;

create table public.posts (
  id bigint generated always as identity primary key,
  espaco_id bigint not null references public.espacos (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  corpo text not null check (length(btrim(corpo)) between 1 and 5000),
  oculto_em timestamptz,
  oculto_por uuid,
  editado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index posts_espaco_criado_idx on public.posts (espaco_id, criado_em desc);
create index posts_autor_id_idx on public.posts (autor_id);

create table public.comentarios (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  autor_id uuid references public.perfis (id) on delete set null default auth.uid(),
  corpo text not null check (length(btrim(corpo)) between 1 and 2000),
  oculto_em timestamptz,
  oculto_por uuid,
  editado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index comentarios_post_criado_idx on public.comentarios (post_id, criado_em);
create index comentarios_autor_id_idx on public.comentarios (autor_id);

-- Edicao do proprio texto marca editado_em. Insert sempre nasce visivel.
create function private.conteudo_comunidade_regras() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.oculto_em := null;
    new.oculto_por := null;
    new.editado_em := null;
    new.criado_em := now();
  elsif new.corpo is distinct from old.corpo then
    new.editado_em := now();
  end if;
  return new;
end $$;
create trigger posts_regras before insert or update on public.posts
  for each row execute function private.conteudo_comunidade_regras();
create trigger comentarios_regras before insert or update on public.comentarios
  for each row execute function private.conteudo_comunidade_regras();

alter table public.posts enable row level security;
grant select on public.posts to authenticated;
grant insert (espaco_id, corpo), update (corpo), delete on public.posts to authenticated;
create policy posts_le on public.posts for select to authenticated
  using (oculto_em is null and exists (select 1 from public.espacos e where e.id = posts.espaco_id));
create policy posts_moderador_le on public.posts for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'moderador'));
create policy posts_dono_insere on public.posts for insert to authenticated
  with check (autor_id = (select auth.uid()) and (select private.pode_escrever_espaco(espaco_id)));
create policy posts_dono_edita on public.posts for update to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null and criado_em > now() - interval '15 minutes')
  with check (autor_id = (select auth.uid()) and (select private.pode_escrever_espaco(espaco_id)));
create policy posts_dono_apaga on public.posts for delete to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null);

alter table public.comentarios enable row level security;
grant select on public.comentarios to authenticated;
grant insert (post_id, corpo), update (corpo), delete on public.comentarios to authenticated;
create policy comentarios_le on public.comentarios for select to authenticated
  using (oculto_em is null and exists (select 1 from public.posts p where p.id = comentarios.post_id));
create policy comentarios_moderador_le on public.comentarios for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'moderador'));
create policy comentarios_dono_insere on public.comentarios for insert to authenticated
  with check (autor_id = (select auth.uid())
              and exists (select 1 from public.posts p where p.id = comentarios.post_id and p.oculto_em is null
                          and (select private.pode_escrever_espaco(p.espaco_id))));
create policy comentarios_dono_edita on public.comentarios for update to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null and criado_em > now() - interval '15 minutes')
  with check (autor_id = (select auth.uid()));
create policy comentarios_dono_apaga on public.comentarios for delete to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null);

create table public.curtidas (
  perfil_id uuid not null references public.perfis (id) on delete cascade default auth.uid(),
  post_id bigint not null references public.posts (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (perfil_id, post_id)
);
create index curtidas_post_id_idx on public.curtidas (post_id);
alter table public.curtidas enable row level security;
grant select, delete on public.curtidas to authenticated;
grant insert (post_id) on public.curtidas to authenticated;
create policy curtidas_le on public.curtidas for select to authenticated
  using (exists (select 1 from public.posts p where p.id = curtidas.post_id));
create policy curtidas_dono_insere on public.curtidas for insert to authenticated
  with check (perfil_id = (select auth.uid())
              and exists (select 1 from public.posts p where p.id = curtidas.post_id and p.oculto_em is null
                          and (select private.pode_escrever_espaco(p.espaco_id))));
create policy curtidas_dono_apaga on public.curtidas for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- denuncias (NET-04, COM-02). Alvo obrigatorio so no insert (gatilho): o set null da exclusao GDPR zera o alvo
-- e a denuncia anonimizada continua no historico. empresa_id entra na F3 e conexao_id na F4.
create table public.denuncias (
  id bigint generated always as identity primary key,
  denunciante_id uuid references public.perfis (id) on delete set null default auth.uid(),
  perfil_denunciado_id uuid references public.perfis (id) on delete set null,
  post_id bigint references public.posts (id) on delete set null,
  comentario_id bigint references public.comentarios (id) on delete set null,
  motivo text not null check (length(btrim(motivo)) between 1 and 80),
  texto text check (length(texto) <= 1000),
  status public.status_denuncia not null default 'aberta',
  resolvida_por uuid,
  resolvida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index denuncias_denunciante_id_idx on public.denuncias (denunciante_id);
create index denuncias_perfil_denunciado_id_idx on public.denuncias (perfil_denunciado_id);
create index denuncias_post_id_idx on public.denuncias (post_id);
create index denuncias_comentario_id_idx on public.denuncias (comentario_id);
create index denuncias_abertas_idx on public.denuncias (criado_em) where status = 'aberta';

-- Recriada na F4 (com empresa e conexao). to_jsonb: le os alvos que existirem na tabela naquele momento.
create function private.denuncias_alvo() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  j jsonb := to_jsonb(new);
begin
  if coalesce(j->>'perfil_denunciado_id', j->>'post_id', j->>'comentario_id', j->>'empresa_id', j->>'conexao_id') is null then
    raise exception 'denuncia_sem_alvo' using errcode = 'P0001';
  end if;
  new.status := 'aberta';
  new.resolvida_por := null;
  new.resolvida_em := null;
  return new;
end $$;
create trigger denuncias_alvo before insert on public.denuncias
  for each row execute function private.denuncias_alvo();

alter table public.denuncias enable row level security;
grant select on public.denuncias to authenticated;
grant insert (perfil_denunciado_id, post_id, comentario_id, motivo, texto) on public.denuncias to authenticated;
create policy denuncias_dono_le on public.denuncias for select to authenticated
  using (denunciante_id = (select auth.uid()));
create policy denuncias_membro_insere on public.denuncias for insert to authenticated
  with check (denunciante_id = (select auth.uid()) and (select public.tem_acesso('clube')));
create policy denuncias_moderador_le on public.denuncias for select to authenticated
  using ((select private.papel_atual()) in ('super_admin', 'moderador'));

create function private.exigir_moderador() returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'moderador') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end $$;
revoke all on function private.exigir_moderador() from public, anon, authenticated;

-- Oculta (ou volta a mostrar) post ou comentario; registra no log (ADM-09).
create function public.moderar_conteudo(alvo text, alvo_id bigint, ocultar boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_moderador();
  if alvo = 'post' then
    update public.posts set oculto_em = case when ocultar then now() end,
                            oculto_por = case when ocultar then (select auth.uid()) end
    where id = alvo_id;
  elsif alvo = 'comentario' then
    update public.comentarios set oculto_em = case when ocultar then now() end,
                                  oculto_por = case when ocultar then (select auth.uid()) end
    where id = alvo_id;
  else
    raise exception 'alvo_invalido' using errcode = 'P0001';
  end if;
  if not found then
    raise exception 'alvo_inexistente' using errcode = 'P0002';
  end if;
  perform private.log_rpc(case when alvo = 'post' then 'posts' else 'comentarios' end, alvo_id::text,
                          jsonb_build_object('rpc', 'moderar_conteudo', 'ocultar', ocultar));
end $$;
revoke all on function public.moderar_conteudo(text, bigint, boolean) from public, anon;
grant execute on function public.moderar_conteudo(text, bigint, boolean) to authenticated;

create function public.resolver_denuncia(denuncia bigint, procedente boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_moderador();
  update public.denuncias d
     set status = case when procedente then 'procedente' else 'improcedente' end::public.status_denuncia,
         resolvida_por = (select auth.uid()), resolvida_em = now()
   where d.id = denuncia and d.status = 'aberta';
  if not found then
    raise exception 'denuncia_inexistente_ou_resolvida' using errcode = 'P0002';
  end if;
  perform private.log_rpc('denuncias', denuncia::text,
                          jsonb_build_object('rpc', 'resolver_denuncia', 'procedente', procedente));
end $$;
revoke all on function public.resolver_denuncia(bigint, boolean) from public, anon;
grant execute on function public.resolver_denuncia(bigint, boolean) to authenticated;

-- Suspender perfil (moderacao): some para todos, menos o dono e a equipe. Equipe nao e suspensa por aqui
-- (remover o papel antes). perfis tem gatilho de log.
create function public.suspender_perfil(perfil uuid, suspender boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_moderador();
  if exists (select 1 from public.equipe e where e.perfil_id = perfil) then
    raise exception 'perfil_da_equipe' using errcode = 'P0001';
  end if;
  update public.perfis set suspenso_em = case when suspender then now() end where id = perfil;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.suspender_perfil(uuid, boolean) from public, anon;
grant execute on function public.suspender_perfil(uuid, boolean) to authenticated;

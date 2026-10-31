-- Lacunas encontradas pelas telas (lote 2 do banco, 31/10/2026). Itens numerados como no pedido.

-- 1) progresso_aula: o percentual nunca diminui e concluida_em nunca volta a nulo (posicao_seg pode voltar:
--    rever um trecho nao desfaz o progresso).
create or replace function private.progresso_aula_concluir() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.percentual := greatest(old.percentual, new.percentual);
  end if;
  if new.percentual = 100 and new.concluida_em is null then
    new.concluida_em := now();
  end if;
  if tg_op = 'UPDATE' then
    new.concluida_em := coalesce(old.concluida_em, new.concluida_em);
  end if;
  return new;
end $$;

-- 2) Caminho de arquivo gravado em tabela: relativo ao bucket, sem '..', '//', '\' e sem '/' no inicio.
create function private.caminho_seguro(p text) returns boolean
language sql immutable
set search_path = ''
as $$
  select p is null or (p !~ '(\.\.|//|\\)' and p !~ '^/' and length(btrim(p)) > 0);
$$;
revoke all on function private.caminho_seguro(text) from public, anon, authenticated;
alter table public.perfis add constraint perfis_foto_path_seguro check (private.caminho_seguro(foto_path));
alter table public.cursos add constraint cursos_capa_path_seguro check (private.caminho_seguro(capa_path));
alter table public.materiais_aula add constraint materiais_aula_arquivo_path_seguro check (private.caminho_seguro(arquivo_path));
alter table public.entregas add constraint entregas_arquivo_path_seguro check (private.caminho_seguro(arquivo_path));
alter table public.receitas_externas add constraint receitas_externas_comprovante_path_seguro check (private.caminho_seguro(comprovante_path));
alter table public.empresas add constraint empresas_logo_path_seguro check (private.caminho_seguro(logo_path));
alter table public.patrocinadores add constraint patrocinadores_logo_path_seguro check (private.caminho_seguro(logo_path));
alter table public.indicados add constraint indicados_foto_path_seguro check (private.caminho_seguro(foto_path));
alter table public.premiados add constraint premiados_foto_path_seguro check (private.caminho_seguro(foto_path));

-- 3) Quando a sala abre: para quem pode ver a aula. link_transmissao passa a trazer o instante no DETAIL
--    do erro ainda_nao_abriu (ISO 8601, UTC).
create function public.abertura_transmissao(aula bigint) returns timestamptz
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
  select * into v_aula from public.aulas a where a.id = abertura_transmissao.aula;
  select * into v_t from public.transmissoes t where t.aula_id = abertura_transmissao.aula;
  if v_aula.id is null or v_t.aula_id is null or v_aula.agendada_em is null or v_aula.inicio_em is null then
    raise exception 'aula_sem_transmissao' using errcode = 'P0002';
  end if;
  if not public.pode_ver_conteudo(v_aula.nivel_minimo) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return v_aula.inicio_em - make_interval(mins => v_t.abre_min_antes);
end $$;
revoke all on function public.abertura_transmissao(bigint) from public, anon;
grant execute on function public.abertura_transmissao(bigint) to authenticated;

create or replace function public.link_transmissao(aula bigint) returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_aula public.aulas;
  v_t public.transmissoes;
  v_abre timestamptz;
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
  v_abre := v_aula.inicio_em - make_interval(mins => v_t.abre_min_antes);
  if now() < v_abre then
    raise exception 'ainda_nao_abriu' using errcode = 'P0001',
      detail = to_char(v_abre at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  return case when v_t.usar_reserva then v_t.url_reserva else v_t.url end;
end $$;

-- 4) Notificacoes: titulo em pt (com acento) e titulo_en ao lado. Escolhi a coluna em vez de chave de i18n:
--    sem tabela de traducao nem montagem no front. A tela mostra titulo_en em /en e cai em titulo se faltar.
--    Link da conexao corrigido para a rota real /conexoes.
alter table public.notificacoes add column titulo_en text check (titulo_en is null or length(titulo_en) between 1 and 200);
update public.notificacoes set link = '/conexoes' where link = '/rede/conexoes';

create or replace function private.aviso_materiais() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Aula de curso ainda nao publicado nao avisa (o titulo vazaria antes da hora).
  if new.materiais_publicados_em is not null
     and (tg_op = 'INSERT' or old.materiais_publicados_em is null)
     and (new.modulo_id is null or exists (select 1 from public.modulos m join public.cursos c on c.id = m.curso_id
                                            where m.id = new.modulo_id and c.publicado_em is not null)) then
    insert into public.notificacoes (perfil_id, tipo, titulo, titulo_en, link)
    select p.id, 'aula_publicada', left('Materiais publicados: ' || new.titulo, 200),
           left('Materials published: ' || new.titulo, 200), '/aulas/' || new.slug
    from public.perfis p
    where p.suspenso_em is null and new.nivel_minimo <= private.nivel_atual(p.id) and private.nivel_atual(p.id) <> 'visitante';
  end if;
  return null;
end $$;

create or replace function private.conexoes_notificar() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'pendente' and (tg_op = 'INSERT' or old.status <> 'pendente') then
    insert into public.notificacoes (perfil_id, tipo, titulo, titulo_en, link)
    values (new.destinatario_id, 'conexao_recebida', 'Novo pedido de conexão', 'New connection request', '/conexoes');
  elsif tg_op = 'UPDATE' and new.status = 'aceita' and old.status = 'pendente' then
    insert into public.notificacoes (perfil_id, tipo, titulo, titulo_en, link)
    values (new.solicitante_id, 'conexao_aceita', 'Seu pedido de conexão foi aceito', 'Your connection request was accepted',
            '/conexoes');
  end if;
  return null;
end $$;

create or replace function public.corrigir_entrega(entrega bigint, novo_status public.status_entrega, devolutiva text) returns void
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
  insert into public.notificacoes (perfil_id, tipo, titulo, titulo_en, link)
  values (v_perfil, 'sistema',
          case when novo_status = 'aprovada' then 'Sua entrega foi aprovada' else 'Sua entrega precisa de ajuste' end,
          case when novo_status = 'aprovada' then 'Your submission was approved' else 'Your submission needs changes' end,
          '/tarefas');
  perform private.log_rpc('entregas', entrega::text,
                          jsonb_build_object('rpc', 'corrigir_entrega', 'status', novo_status));
end $$;

-- 5) O autor ve o proprio post/comentario oculto pela moderacao (com oculto_em, para a tela dizer "em analise").
--    Ninguem mais ve, alem da moderacao (politicas *_moderador_le).
create policy posts_autor_le on public.posts for select to authenticated
  using (autor_id = (select auth.uid()));
create policy comentarios_autor_le on public.comentarios for select to authenticated
  using (autor_id = (select auth.uid()));

-- 7) Recusa de empresa com motivo, visivel ao dono (minhas_empresas) e a equipe (empresas_equipe); nao sai no
--    select comum (grant por coluna). Aprovar limpa o motivo.
alter table public.empresas add column motivo_recusa text check (length(motivo_recusa) <= 600);
drop function public.aprovar_empresa(bigint, boolean);
create function public.aprovar_empresa(empresa bigint, aprovar boolean, motivo text default null) returns void
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
         aprovada_em = case when aprovar then now() end,
         motivo_recusa = case when aprovar then null else nullif(btrim(motivo), '') end
   where id = empresa;
  if not found then
    raise exception 'empresa_inexistente' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.aprovar_empresa(bigint, boolean, text) from public, anon;
grant execute on function public.aprovar_empresa(bigint, boolean, text) to authenticated;
-- minhas_empresas/empresas_equipe retornam setof empresas: a coluna nova ja vem nelas.

-- 8) Suporte: super_admin (aal2) le clientes_stripe (link "abrir no Stripe") e o e-mail do membro por RPC.
--    Cada consulta de e-mail fica no log_admin.
create policy clientes_stripe_super_admin_le on public.clientes_stripe for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');
create function public.email_do_membro(perfil uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v text;
begin
  perform private.exigir_super_admin();
  select u.email into v from auth.users u where u.id = perfil;
  if v is null then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  perform private.log_rpc('perfis', perfil::text, jsonb_build_object('rpc', 'email_do_membro'));
  return v;
end $$;
revoke all on function public.email_do_membro(uuid) from public, anon;
grant execute on function public.email_do_membro(uuid) to authenticated;

-- 9) editor (aal2) le e registra consentimentos so do tipo hall_of_fame (premiado/indicado sem conta), com a data
--    real do aceite. super_admin continua com todos.
create function private.documento_hof(p_documento bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.documentos_legais d where d.id = p_documento and d.tipo = 'hall_of_fame');
$$;
revoke all on function private.documento_hof(bigint) from public, anon;
grant execute on function private.documento_hof(bigint) to authenticated;
create policy consentimentos_editor_le on public.consentimentos for select to authenticated
  using ((select private.papel_atual()) = 'editor' and private.documento_hof(documento_id));
create policy consentimentos_editor_insere on public.consentimentos for insert to authenticated
  with check ((select private.papel_atual()) = 'editor' and perfil_id is null and private.documento_hof(documento_id));

create or replace function private.consentimentos_preencher() returns trigger
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
  -- So a equipe que registra formulario assinado informa a data; o membro aceita "agora".
  if not coalesce((select private.papel_atual()) in ('super_admin', 'editor'), false) then
    new.aceito_em := now();
  end if;
  return new;
end $$;

-- 10) Foto de perfil: bucket privado avatares, caminho {uid}/... (foto_path guarda esse caminho, sem o bucket).
--     Escreve o dono; le quem e membro (Clube ou Grupo), o proprio dono e a equipe. Entra na exclusao de conta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
alter table public.perfis add constraint perfis_foto_path_do_dono check (foto_path is null or foto_path like id::text || '/%');

create policy avatares_le on storage.objects for select to authenticated
  using (bucket_id = 'avatares'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or (select public.tem_acesso('clube')) or (select private.papel_atual()) is not null));
create policy avatares_dono_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_dono_troca on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatares_dono_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.arquivos_do_titular(p_uid uuid) returns table (bucket text, nome text)
language sql stable security definer
set search_path = ''
as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('entregas', 'avatares') and (storage.foldername(o.name))[1] = p_uid::text
  order by o.bucket_id, o.name;
$$;

create or replace function private.perfis_sem_arquivos() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from storage.objects o
             where o.bucket_id in ('entregas', 'avatares') and (storage.foldername(o.name))[1] = old.id::text) then
    raise exception 'arquivos_pendentes: remova os arquivos do titular no Storage antes de apagar a conta'
      using errcode = 'P0001';
  end if;
  return old;
end $$;

-- 11) Uma denuncia aberta por denunciante e alvo: o segundo insert da 23505 (a tela diz "voce ja denunciou").
--     ATENCAO: a criacao do indice falha se o banco ja tiver duplicatas abertas; resolver antes.
create unique index denuncias_aberta_uq on public.denuncias
  (denunciante_id, coalesce(perfil_denunciado_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(post_id, 0),
   coalesce(comentario_id, 0), coalesce(empresa_id, 0), coalesce(conexao_id, 0))
  where status = 'aberta' and denunciante_id is not null;

-- 12) sugestoes_match.motivo_dados: os ingredientes do motivo, para o front montar a frase em pt/en.
--     {categoria_id, tipo: 'oferece' (o sugerido oferece o que voce procura), mesma_cidade, cidade, mesmo_setor}.
--     motivo (texto em pt, com acentos) continua por compatibilidade.
alter table public.sugestoes_match add column motivo_dados jsonb;

create or replace function private.gerar_sugestoes_match(p_semana date) returns int
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
    select a.id a_id, b.id b_id, cat.id cat_id, cat.nome cat,
           (a.cidade is not null and a.cidade = b.cidade) mesma_cidade, b.cidade_txt,
           (a.setor_id is not null and a.setor_id = b.setor_id) mesmo_setor
    from candidatos a join candidatos b on b.id <> a.id
    left join lateral (
      select cr.id, cr.nome from public.network_itens na
      join public.network_itens nb on nb.categoria_id = na.categoria_id and nb.perfil_id = b.id and nb.tipo = 'oferece'
      join public.categorias_rede cr on cr.id = na.categoria_id
      where na.perfil_id = a.id and na.tipo = 'procura' order by cr.ordem, cr.id limit 1) cat on true
    where not exists (select 1 from public.conexoes c
                      where least(c.solicitante_id, c.destinatario_id) = least(a.id, b.id)
                        and greatest(c.solicitante_id, c.destinatario_id) = greatest(a.id, b.id))
  ), pontuados as (
    select a_id, b_id,
           (case when cat is not null then 3 else 0 end + case when mesma_cidade then 2 else 0 end
            + case when mesmo_setor then 1 else 0 end)::smallint pontos,
           concat_ws('; ', case when cat is not null then 'oferece ' || cat || ', que você procura' end,
                           case when mesma_cidade then 'mesma cidade (' || cidade_txt || ')' end,
                           case when mesmo_setor then 'mesmo setor' end) motivo,
           jsonb_build_object('categoria_id', cat_id, 'tipo', case when cat_id is not null then 'oferece' end,
                              'mesma_cidade', mesma_cidade, 'cidade', case when mesma_cidade then cidade_txt end,
                              'mesmo_setor', mesmo_setor) dados
    from pares
  ), top as (
    select *, row_number() over (partition by a_id order by pontos desc, b_id) r from pontuados where pontos > 0
  )
  insert into public.sugestoes_match (perfil_id, sugerido_id, semana, pontuacao, motivo, motivo_dados)
  select a_id, b_id, v_semana, pontos, motivo, dados from top where r <= 5
  on conflict (perfil_id, sugerido_id, semana) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- 13) O membro so ve perfis de membros ATIVOS (Clube ou Grupo) e nao suspensos. O proprio perfil (perfis_dono_le),
--     a equipe (perfis_equipe_le) e o perfil publico aprovado (perfis_publico_le) nao mudam; as duas partes de uma
--     conexao continuam se vendo (perfis_conexao_le), mesmo que uma deixe de assinar.
create function private.membro_ativo(p uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.nivel_atual(p) in ('clube', 'grupo');
$$;
revoke all on function private.membro_ativo(uuid) from public, anon;
grant execute on function private.membro_ativo(uuid) to authenticated;
drop policy perfis_membro_le on public.perfis;
create policy perfis_membro_le on public.perfis for select to authenticated
  using (visibilidade in ('membros', 'publico') and suspenso_em is null and (select public.tem_acesso('clube'))
         and private.membro_ativo(id));
create policy perfis_conexao_le on public.perfis for select to authenticated
  using (suspenso_em is null
         and exists (select 1 from public.conexoes c
                     where (c.solicitante_id = (select auth.uid()) and c.destinatario_id = perfis.id)
                        or (c.destinatario_id = (select auth.uid()) and c.solicitante_id = perfis.id)));


-- 14) CSV do Relatorio do Ciclo sem injecao de formula: todo campo de texto troca ';' por ',', quebra de linha
--     e '\r' por espaco, e ganha prefixo ' se comecar com = + - @ ou tabulacao. Numeros nao passam por aqui.
--     csv_sha256 continua sobre o texto final (fechar_ciclo usa dados->>'csv').
create function private.csv_texto(t text) returns text
language sql immutable
set search_path = ''
as $$
  select case when x ~ '^[=+@\t-]' then '''' || x else x end
  from (select replace(replace(replace(coalesce(t, ''), ';', ','), chr(10), ' '), chr(13), ' ') as x) s;
$$;
revoke all on function private.csv_texto(text) from public, anon, authenticated;

create or replace function public.relatorio_ciclo(ciclo_inicio date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ini timestamptz;
  v_fim timestamptz;
  v_dia9 date := (ciclo_inicio + interval '1 month' - interval '1 day')::date;
  v_fim_data date := (ciclo_inicio + interval '1 month')::date;
  v_linhas jsonb;
  v_cambio jsonb;
  v_tot record;
  v_clientes jsonb;
  v_n_clientes int;
  v_ia jsonb;
  v_ia_avulsa bigint;
  v_rateio bigint := 0;
  v_niveis jsonb := '[]'::jsonb;
  v_nivel public.nivel_acesso;
  v_receita_nivel bigint;
  v_h_ia numeric;
  v_h_tot numeric;
  v_pend jsonb;
  v_ultima public.relatorios_ciclo;
  v_faixa int;
  v_csv text;
begin
  perform private.exigir_financeiro();
  perform private.exigir_ciclo(ciclo_inicio);
  select l.ini, l.fim into v_ini, v_fim from private.ciclo_limites(ciclo_inicio) l;

  -- Todas as linhas do Ciclo, com a taxa usada e o valor em EUR. Estornos entram negativos.
  if to_regclass('pg_temp.rc_linhas') is null then
    create temporary table rc_linhas (
      fonte text, ref_id bigint, data date, conta_ou_origem text, cliente text, moeda char(3),
      bruto bigint, vat bigint, taxa numeric, bruto_eur bigint, vat_eur bigint, referencia text) on commit drop;
  end if;
  truncate pg_temp.rc_linhas;
  insert into pg_temp.rc_linhas
  select x.fonte, x.ref_id, x.data, x.conta, x.cliente, x.moeda, x.bruto, x.vat, t.taxa,
         case when t.taxa is null then null else round(x.bruto / t.taxa)::bigint end,
         case when t.taxa is null then null else round(x.vat / t.taxa)::bigint end,
         x.referencia
  from (
    select 'stripe'::text fonte, p.id ref_id, (p.pago_em at time zone 'Europe/Dublin')::date data, cs.stripe_account_id conta,
           p.cliente_email cliente, p.moeda, p.bruto_centavos bruto, p.vat_centavos vat,
           coalesce(p.stripe_invoice_id, p.stripe_payment_intent_id) referencia
    from public.pagamentos p join public.contas_stripe cs on cs.id = p.conta_stripe_id
    where p.pago_em >= v_ini and p.pago_em < v_fim
    union all
    select 'externa', e.id, e.recebido_em, e.origem::text, e.cliente_nome, e.moeda, e.bruto_centavos, e.vat_centavos,
           e.comprovante_path
    from public.receitas_externas e
    where e.anulado_em is null and e.recebido_em >= ciclo_inicio and e.recebido_em < v_fim_data
    union all
    select 'estorno_' || r.tipo::text, r.id, (r.devolvido_em at time zone 'Europe/Dublin')::date,
           coalesce(cs.stripe_account_id, 'externa'), coalesce(p.cliente_email, e.cliente_nome), r.moeda,
           -r.valor_centavos, -r.vat_centavos, coalesce(r.stripe_id, 'receita:' || r.receita_externa_id)
    from public.reembolsos r
    left join public.contas_stripe cs on cs.id = r.conta_stripe_id
    left join public.pagamentos p on p.id = r.pagamento_id
    left join public.receitas_externas e on e.id = r.receita_externa_id
    where r.devolvido_em >= v_ini and r.devolvido_em < v_fim
  ) x
  cross join lateral (select private.cambio_em(x.moeda, v_dia9) as taxa) t;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.data, l.fonte, l.ref_id), '[]'::jsonb) into v_linhas from pg_temp.rc_linhas l;

  select coalesce(jsonb_agg(jsonb_build_object('moeda', m.moeda, 'taxa', m.taxa, 'data', c.data, 'fonte_url', c.fonte_url)
                            order by m.moeda), '[]'::jsonb)
  into v_cambio
  from (select distinct moeda, taxa from pg_temp.rc_linhas where moeda <> 'EUR') m
  left join lateral (select cb.data, cb.fonte_url from public.cambio_bce cb
                     where cb.moeda = m.moeda and cb.data <= v_dia9 order by cb.data desc limit 1) c on true;

  select coalesce(sum(bruto_eur) filter (where fonte = 'stripe'), 0) as stripe_bruto,
         coalesce(sum(bruto_eur) filter (where fonte = 'externa'), 0) as externa_bruto,
         coalesce(sum(vat_eur) filter (where fonte in ('stripe', 'externa')), 0) as vat,
         coalesce(-sum(bruto_eur) filter (where fonte like 'estorno%'), 0) as estornos,
         coalesce(-sum(vat_eur) filter (where fonte like 'estorno%'), 0) as estornos_vat
  into v_tot from pg_temp.rc_linhas;

  select coalesce(jsonb_agg(jsonb_build_object('chave', c.cliente_chave, 'origem', c.origem) order by c.cliente_chave), '[]'::jsonb),
         count(*)
  into v_clientes, v_n_clientes
  from public.clientes_ativos(ciclo_inicio) c;

  -- IA avulsa: linhas de plano sem nivel cuja vertical conta como IA (Stripe e receitas externas).
  select coalesce(sum(round((i.bruto_centavos - i.vat_centavos) / private.cambio_em(p.moeda, v_dia9))), 0)::bigint
  into v_ia_avulsa
  from public.pagamentos_itens i
  join public.pagamentos p on p.id = i.pagamento_id
  join public.planos pl on pl.id = i.plano_id
  join public.verticais v on v.id = pl.vertical_id
  where p.pago_em >= v_ini and p.pago_em < v_fim and pl.nivel is null and v.conta_como_ia;
  v_ia_avulsa := v_ia_avulsa + coalesce((
    select sum(round((e.bruto_centavos - e.vat_centavos) / private.cambio_em(e.moeda, v_dia9)))::bigint
    from public.receitas_externas e join public.planos pl on pl.id = e.plano_id join public.verticais v on v.id = pl.vertical_id
    where e.anulado_em is null and e.recebido_em >= ciclo_inicio and e.recebido_em < v_fim_data
      and pl.nivel is null and v.conta_como_ia), 0);

  -- Rateio: receita liquida das assinaturas de cada nivel x horas de IA / horas totais publicadas no Ciclo.
  foreach v_nivel in array array['clube', 'grupo']::public.nivel_acesso[] loop
    select coalesce(sum(round((i.bruto_centavos - i.vat_centavos) / private.cambio_em(p.moeda, v_dia9))), 0)::bigint
    into v_receita_nivel
    from public.pagamentos_itens i
    join public.pagamentos p on p.id = i.pagamento_id
    join public.planos pl on pl.id = i.plano_id
    where p.pago_em >= v_ini and p.pago_em < v_fim and pl.nivel = v_nivel;
    v_receita_nivel := v_receita_nivel + coalesce((
      select sum(round((e.bruto_centavos - e.vat_centavos) / private.cambio_em(e.moeda, v_dia9)))::bigint
      from public.receitas_externas e join public.planos pl on pl.id = e.plano_id
      where e.anulado_em is null and e.recebido_em >= ciclo_inicio and e.recebido_em < v_fim_data and pl.nivel = v_nivel), 0);
    v_h_ia := private.horas_ciclo(ciclo_inicio, v_nivel, true);
    v_h_tot := private.horas_ciclo(ciclo_inicio, v_nivel, false);
    v_niveis := v_niveis || jsonb_build_object(
      'nivel', v_nivel, 'receita_liquida', v_receita_nivel, 'horas_ia', v_h_ia, 'horas_total', v_h_tot,
      'rateio', case when v_h_tot > 0 then round(v_receita_nivel * v_h_ia / v_h_tot)::bigint else 0 end);
    v_rateio := v_rateio + case when v_h_tot > 0 then round(v_receita_nivel * v_h_ia / v_h_tot)::bigint else 0 end;
  end loop;
  v_ia := jsonb_build_object('avulsa', v_ia_avulsa, 'rateio', v_rateio, 'total', v_ia_avulsa + v_rateio,
                             'por_nivel', v_niveis, 'criterio', 'horas de aula publicadas no Ciclo (PRD 9.1.6 pendencia 4)');

  v_pend := (
    select coalesce(jsonb_agg(p), '[]'::jsonb) from (
      select jsonb_build_object('tipo', 'cambio_ausente', 'moeda', moeda) p
      from (select distinct moeda from pg_temp.rc_linhas where taxa is null) s
      union all
      select jsonb_build_object('tipo', 'item_sem_plano', 'pagamento_id', i.pagamento_id, 'item_id', i.id)
      from public.pagamentos_itens i join public.pagamentos p on p.id = i.pagamento_id
      where p.pago_em >= v_ini and p.pago_em < v_fim and i.plano_id is null
      union all
      select jsonb_build_object('tipo', 'faixa_percentuais_indefinidos')
    ) q);

  -- Faixa pela contagem (limites da v3, PROVISORIO ate o contrato final).
  v_faixa := case when v_n_clientes <= 100 then 1 when v_n_clientes <= 500 then 2 else 3 end;

  select * into v_ultima from public.relatorios_ciclo r where r.ciclo_inicio = relatorio_ciclo.ciclo_inicio
  order by r.versao desc limit 1;

  -- CSV reproduzivel: cabecalho fixo + linhas na ordem acima (separador ';', valores em centavos).
  -- BOM UTF-8 no inicio (dentro do texto hasheado); texto passa por private.csv_texto; numeros intactos, e nulo
  -- vira campo vazio (concat_ws pulava o nulo e deslocava as colunas).
  select chr(65279) || 'fonte;ref_id;data;conta_ou_origem;cliente;moeda;bruto;vat;taxa;bruto_eur;vat_eur;referencia' || chr(10) ||
         coalesce(string_agg(concat_ws(';', private.csv_texto(l.fonte), coalesce(l.ref_id::text, ''), coalesce(l.data::text, ''),
                                       private.csv_texto(l.conta_ou_origem), private.csv_texto(l.cliente),
                                       private.csv_texto(l.moeda), coalesce(l.bruto::text, ''), coalesce(l.vat::text, ''),
                                       coalesce(l.taxa::text, ''), coalesce(l.bruto_eur::text, ''), coalesce(l.vat_eur::text, ''),
                                       private.csv_texto(l.referencia)),
                             chr(10) order by l.data, l.fonte, l.ref_id), '')
  into v_csv from pg_temp.rc_linhas l;

  return jsonb_build_object(
    'versao_formato', 1,
    'calculado_em', now(),
    'ciclo', jsonb_build_object('inicio', ciclo_inicio, 'fim', v_dia9, 'fuso', 'Europe/Dublin',
                                'estado', case when v_ultima.versao is not null and v_ultima.reaberto_em is null then 'fechado' else 'rascunho' end,
                                'ultima_versao', v_ultima.versao),
    'cambio', jsonb_build_object('data_referencia', v_dia9, 'taxas', v_cambio),
    'receita', jsonb_build_object('stripe', v_tot.stripe_bruto, 'externa', v_tot.externa_bruto,
                                  'bruta', v_tot.stripe_bruto + v_tot.externa_bruto),
    'deducoes', jsonb_build_object('vat', v_tot.vat, 'estornos', v_tot.estornos, 'estornos_vat', v_tot.estornos_vat,
                                   'total', v_tot.vat + v_tot.estornos - v_tot.estornos_vat),
    'receita_base', v_tot.stripe_bruto + v_tot.externa_bruto - v_tot.vat - (v_tot.estornos - v_tot.estornos_vat),
    'clientes_ativos', jsonb_build_object('quantidade', v_n_clientes, 'lista', v_clientes,
                                          'criterio', 'Cl. 1(e) [interpretacao], PRD 9.1.6 pendencia 10'),
    'ia', v_ia,
    'faixa', jsonb_build_object('provisorio', true, 'faixa', v_faixa, 'limites', jsonb_build_array(100, 500),
                                'percentual', null, 'valor', null,
                                'nota', 'limites da v3 do contrato; percentuais a definir no contrato final'),
    'pendencias', v_pend,
    'linhas', v_linhas,
    'csv', v_csv);
end $$;

-- 15) Nunca fica sem super_admin: recusa remover ou rebaixar o ultimo (inclusive pela exclusao da conta dele).
--     O lock serializa duas remocoes simultaneas, que de outro modo passariam juntas.
create function private.equipe_ultimo_super_admin() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.papel = 'super_admin' and (tg_op = 'DELETE' or new.papel <> 'super_admin') then
    perform pg_advisory_xact_lock(hashtextextended('equipe:super_admin', 0));
    if not exists (select 1 from public.equipe e where e.papel = 'super_admin' and e.perfil_id <> old.perfil_id) then
      raise exception 'ultimo_super_admin' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.equipe_ultimo_super_admin() from public, anon, authenticated;
create trigger equipe_ultimo_super_admin before update of papel or delete on public.equipe
  for each row execute function private.equipe_ultimo_super_admin();

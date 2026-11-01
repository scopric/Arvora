-- Correcoes da revisao adversarial do banco (31/10/2026). Uma migration so, sem editar as anteriores.
-- Itens: A1, A2, M1-M5, M7, M8, B1-B5, B8 (ver comentarios em cada bloco). M6 nao verificado; B6, B7, B9 so
-- anotados no relatorio.

-- A1 (ALTO): video_id nao sai por select para ninguem (nem membro). Antes, o grant de tabela inteira de
-- authenticated deixava logado sem assinatura e Clube lerem o id do video do Grupo. Agora:
--   * select por coluna sem video_id em aulas e videos;
--   * o player pede o id por public.video_da_aula(aula) / public.video_do_video(video), que so devolvem para
--     quem pode ver o conteudo (pode_ver_conteudo; equipe com aal2 sempre);
--   * a equipe continua escrevendo video_id (insert/update de tabela) e le pelo mesmo par de RPCs no admin.
--   O front nao pode usar select('*') nem insert/update com .select('*') nessas tabelas: listar colunas.
revoke select on public.aulas from authenticated;
grant select (id, modulo_id, vertical_id, especialista_id, tipo, titulo, slug, descricao, nivel_minimo, ordem, inicio_em,
              duracao_min, trailer_video_id, agendada_em, materiais_publicados_em, criado_em, atualizado_em)
  on public.aulas to authenticated;
revoke select on public.videos from authenticated;
grant select (id, tipo, titulo, slug, descricao, tema_id, edicao_id, trailer_video_id, duracao_min, nivel_minimo,
              publicado_em, criado_em, atualizado_em)
  on public.videos to authenticated;

create function public.video_da_aula(p_aula bigint) returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.aulas;
begin
  select * into v from public.aulas a where a.id = p_aula;
  if v.id is not null and (select private.papel_atual()) is not null then
    return v.video_id;
  end if;
  if v.id is null or v.materiais_publicados_em is null
     or (v.modulo_id is not null and not exists (select 1 from public.modulos m join public.cursos c on c.id = m.curso_id
                                                  where m.id = v.modulo_id and c.publicado_em is not null))
     or not coalesce(public.tem_acesso(v.nivel_minimo), false) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return v.video_id;
end $$;
revoke all on function public.video_da_aula(bigint) from public, anon;
grant execute on function public.video_da_aula(bigint) to authenticated;

create function public.video_do_video(p_video bigint) returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.videos;
begin
  select * into v from public.videos x where x.id = p_video;
  if v.id is not null and (select private.papel_atual()) is not null then
    return v.video_id;
  end if;
  if v.id is null or v.publicado_em is null or not coalesce(public.tem_acesso(v.nivel_minimo), false) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return v.video_id;
end $$;
revoke all on function public.video_do_video(bigint) from public, anon;
grant execute on function public.video_do_video(bigint) to authenticated;

-- A2 (ALTO): o consentimento que publica premiado/indicado tem de ser DO PROPRIO (mesmo perfil_id, ou o
-- titular_email igual ao convite_email) e cada consentimento serve a um premiado e a um indicado so.
-- indicados ganha convite_email (como premiados), fora do select de anon e de authenticated.
alter table public.indicados add column convite_email text check (length(convite_email) <= 254);
revoke select on public.indicados from authenticated;
grant select (id, edicao_id, categoria_id, nome, empresa_id, perfil_id, foto_path, resumo, consentimento_id, publicado_em,
              criado_em, atualizado_em)
  on public.indicados to authenticated;
create unique index premiados_consentimento_uq on public.premiados (consentimento_id) where consentimento_id is not null;
create unique index indicados_consentimento_uq on public.indicados (consentimento_id) where consentimento_id is not null;

create or replace function private.exigir_consentimento_publicacao() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  j jsonb := to_jsonb(new);
begin
  if new.consentimento_id is not null and not exists (
       select 1 from public.consentimentos c
       where c.id = new.consentimento_id
         and ((c.perfil_id is not null and c.perfil_id = new.perfil_id)
              or (j->>'convite_email' is not null and lower(c.titular_email) = lower(j->>'convite_email')))) then
    raise exception 'consentimento_de_outra_pessoa' using errcode = 'P0001';
  end if;
  if new.publicado_em is not null and not private.consentimento_hof_vigente(new.consentimento_id) then
    raise exception 'consentimento_ausente_ou_revogado' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- M1: receita externa com estorno nao pode ser anulada (a deducao ficaria sem a receita: base negativa).
create or replace function private.receitas_externas_regras() returns trigger
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
    if exists (select 1 from public.reembolsos r where r.receita_externa_id = old.id) then
      raise exception 'receita_com_estorno' using errcode = 'P0001';
    end if;
    new.anulado_em := now();
    new.anulado_por := (select auth.uid());
  end if;
  if private.ciclo_fechado(new.recebido_em) then
    raise exception 'ciclo_fechado' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- M2: nao fecha Ciclo com pendencia de cambio ou item sem plano. Para resolver item sem plano (ex.: checkout
-- avulso, cujo evento nao traz o Price), o super_admin classifica a linha por public.classificar_item_pagamento.
create function public.classificar_item_pagamento(item bigint, plano bigint) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_super_admin();
  if not exists (select 1 from public.planos p where p.id = plano) then
    raise exception 'plano_invalido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pagamentos_itens i join public.pagamentos p on p.id = i.pagamento_id
             where i.id = item and private.ciclo_fechado((p.pago_em at time zone 'Europe/Dublin')::date)) then
    raise exception 'ciclo_fechado' using errcode = 'P0001';
  end if;
  update public.pagamentos_itens i set plano_id = plano,
         tipo_receita = (select p.tipo_receita from public.planos p where p.id = plano)
  where i.id = item and i.plano_id is null;
  if not found then
    raise exception 'item_inexistente_ou_classificado' using errcode = 'P0002';
  end if;
  perform private.log_rpc('pagamentos_itens', item::text, jsonb_build_object('rpc', 'classificar_item_pagamento', 'plano', plano));
end $$;
revoke all on function public.classificar_item_pagamento(bigint, bigint) from public, anon;
grant execute on function public.classificar_item_pagamento(bigint, bigint) to authenticated;

create or replace function public.fechar_ciclo(ciclo_inicio date) returns public.relatorios_ciclo
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ultima public.relatorios_ciclo;
  v_dados jsonb;
  v_novo public.relatorios_ciclo;
begin
  perform private.exigir_super_admin();
  perform private.exigir_ciclo(ciclo_inicio);
  if now() < (select l.fim from private.ciclo_limites(ciclo_inicio) l) then
    raise exception 'ciclo_em_andamento' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fechar_ciclo:' || ciclo_inicio, 0));
  select * into v_ultima from public.relatorios_ciclo r where r.ciclo_inicio = fechar_ciclo.ciclo_inicio
  order by r.versao desc limit 1;
  if v_ultima.versao is not null and v_ultima.reaberto_em is null then
    raise exception 'ciclo_ja_fechado' using errcode = 'P0001';
  end if;
  v_dados := public.relatorio_ciclo(ciclo_inicio);
  if exists (select 1 from jsonb_array_elements(v_dados->'pendencias') p
             where p->>'tipo' in ('cambio_ausente', 'item_sem_plano')) then
    raise exception 'ciclo_com_pendencias' using errcode = 'P0001';
  end if;
  v_dados := jsonb_set(v_dados, '{ciclo,estado}', '"fechado"');
  v_dados := jsonb_set(v_dados, '{ciclo,ultima_versao}', to_jsonb(coalesce(v_ultima.versao, 0) + 1));
  insert into public.relatorios_ciclo (ciclo_inicio, versao, ciclo_fim, dados, csv_sha256, gerado_por, motivo_reemissao)
  values (ciclo_inicio, coalesce(v_ultima.versao, 0) + 1, (ciclo_inicio + interval '1 month' - interval '1 day')::date,
          v_dados, encode(sha256(convert_to(v_dados->>'csv', 'UTF8')), 'hex'), (select auth.uid()),
          v_ultima.motivo_reabertura)
  returning * into v_novo;
  return v_novo;
end $$;

-- B1: uma receita externa libera um acesso so, e o plano tem de ser o da receita.
create unique index assinaturas_receita_externa_uq on public.assinaturas (receita_externa_id) where receita_externa_id is not null;
create or replace function public.conceder_acesso_manual(perfil uuid, plano bigint, receita bigint, ate timestamptz) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform private.exigir_super_admin();
  if ate is null or ate <= now() or ate > now() + interval '400 days' then
    raise exception 'periodo_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.planos p where p.id = plano and p.nivel is not null) then
    raise exception 'plano_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.receitas_externas e where e.id = receita and e.anulado_em is null
                 and e.plano_id = plano and (e.perfil_id is null or e.perfil_id = perfil)) then
    raise exception 'receita_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.assinaturas a where a.receita_externa_id = receita) then
    raise exception 'receita_ja_usada' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfis p where p.id = perfil) then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  begin
    insert into public.assinaturas (perfil_id, plano_id, status, origem, receita_externa_id, periodo_inicio, periodo_fim)
    values (perfil, plano, 'active', 'manual', receita, now(), ate)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'assinatura_vigente_existente_ou_receita_ja_usada' using errcode = 'P0001';
  end;
  perform private.log_rpc('assinaturas', v_id::text,
                          jsonb_build_object('rpc', 'conceder_acesso_manual', 'perfil', perfil, 'plano', plano,
                                             'receita', receita, 'ate', ate));
  return v_id;
end $$;

-- M3: contato so entre dois membros do Grupo, nao suspensos, com conexao aceita.
create or replace function public.revelar_contato(outro uuid) returns table (email_contato text, whatsapp text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not coalesce(public.tem_acesso('grupo'), false)
     or not private.na_rede((select auth.uid())) or not private.na_rede(outro)
     or not exists (select 1 from public.conexoes c where c.status = 'aceita'
                    and ((c.solicitante_id = (select auth.uid()) and c.destinatario_id = outro)
                         or (c.destinatario_id = (select auth.uid()) and c.solicitante_id = outro))) then
    raise exception 'sem_conexao_aceita' using errcode = '42501';
  end if;
  return query select pc.email_contato, pc.whatsapp from public.perfis_contato pc where pc.perfil_id = outro;
end $$;

-- M4: no update, o log guarda so as colunas que mudaram (antes e depois); insert e delete guardam a linha.
create or replace function private.registrar_log() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_j jsonb := coalesce(v_depois, v_antes);
begin
  if (select private.papel_atual()) is not null then
    if tg_op = 'UPDATE' then
      select coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb), coalesce(jsonb_object_agg(a.key, d.value), '{}'::jsonb)
      into v_antes, v_depois
      from jsonb_each(to_jsonb(old)) a join jsonb_each(to_jsonb(new)) d on d.key = a.key
      where a.value is distinct from d.value and a.key <> 'atualizado_em';
    end if;
    insert into public.log_admin (ator_id, acao, tabela, alvo_id, antes, depois)
    values ((select auth.uid()), lower(tg_op), tg_table_name,
            coalesce(v_j ->> 'id', v_j ->> 'perfil_id', v_j ->> 'aula_id', v_j ->> 'ciclo_inicio', v_j ->> 'data'),
            v_antes, v_depois);
  end if;
  return null;
end $$;

-- M4 + M8: ao apagar o perfil (exclusao de conta), (a) revoga marketing e Match do titular; (b) anonimiza o
-- log_admin que fala dele: as linhas ficam (quem fez o que e quando, ADM-09), sem o retrato dos dados e sem o id.
-- RETENCAO (lista do PRD 9.1.0): log_admin fica 6 anos, mas sem dado do titular excluido; o registro fiscal
-- continua nas tabelas financeiras.
create function private.perfis_ao_excluir() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.consentimentos c set revogado_em = now()
  from public.documentos_legais d
  where d.id = c.documento_id and c.perfil_id = old.id and c.revogado_em is null and d.tipo in ('marketing', 'match');
  update public.log_admin l set antes = null, depois = null,
         alvo_id = case when l.alvo_id = old.id::text then null else l.alvo_id end
  where l.alvo_id = old.id::text
     or strpos(coalesce(l.antes::text, ''), old.id::text) > 0
     or strpos(coalesce(l.depois::text, ''), old.id::text) > 0;
  return old;
end $$;
revoke all on function private.perfis_ao_excluir() from public, anon, authenticated;
create trigger perfis_ao_excluir before delete on public.perfis
  for each row execute function private.perfis_ao_excluir();

-- B2: arquivo de material aprovado nao se troca nem se apaga no Storage (troca = novo arquivo + nova aprovacao).
create function private.material_aprovado(p_nome text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.materiais_aula m where m.arquivo_path = p_nome and m.status = 'aprovado');
$$;
revoke all on function private.material_aprovado(text) from public, anon;
grant execute on function private.material_aprovado(text) to authenticated;
drop policy materiais_editor_troca on storage.objects;
drop policy materiais_editor_apaga on storage.objects;
create policy materiais_editor_troca on storage.objects for update to authenticated
  using (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor')
         and not private.material_aprovado(name))
  with check (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor'));
create policy materiais_editor_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and (select private.papel_atual()) in ('super_admin', 'editor')
         and not private.material_aprovado(name));

-- B3: autor nao apaga post nem comentario com denuncia aberta (o denunciado nao ve a denuncia: helper definer).
create function private.denuncia_aberta(p_post bigint, p_comentario bigint) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.denuncias d where d.status = 'aberta'
                 and (d.post_id = p_post or d.comentario_id = p_comentario));
$$;
revoke all on function private.denuncia_aberta(bigint, bigint) from public, anon;
grant execute on function private.denuncia_aberta(bigint, bigint) to authenticated;
drop policy posts_dono_apaga on public.posts;
create policy posts_dono_apaga on public.posts for delete to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null and not private.denuncia_aberta(id, null));
drop policy comentarios_dono_apaga on public.comentarios;
create policy comentarios_dono_apaga on public.comentarios for delete to authenticated
  using (autor_id = (select auth.uid()) and oculto_em is null and not private.denuncia_aberta(null, id));

-- B4: anon nao le link de transmissao nem id da gravacao da edicao; nem quem publicou o documento legal.
revoke select on public.edicoes from anon;
grant select (id, slug, nome, ano, pais, cidade, descricao, durante_inicio, durante_fim, publicada_em) on public.edicoes to anon;
revoke select on public.documentos_legais from anon;
grant select (id, tipo, versao, idioma, titulo, conteudo_md, sha256, vigente_desde, criado_em) on public.documentos_legais to anon;
-- public.fase recebe a linha inteira; com o select por coluna o anon passa a chamar pela versao com datas.
create function public.fase_edicao(inicio timestamptz, fim timestamptz) returns text
language sql stable
set search_path = ''
as $$
  select case when now() < inicio then 'antes' when now() <= fim then 'durante' else 'depois' end;
$$;
revoke all on function public.fase_edicao(timestamptz, timestamptz) from public;
grant execute on function public.fase_edicao(timestamptz, timestamptz) to anon, authenticated;

-- B5: sugestao some quando o sugerido revoga o opt-in, e suspenso ou sai do Grupo.
create function private.no_match(p uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.na_rede(p)
     and exists (select 1 from public.consentimentos c join public.documentos_legais d on d.id = c.documento_id
                 where c.perfil_id = p and c.revogado_em is null and d.tipo = 'match');
$$;
revoke all on function private.no_match(uuid) from public, anon;
grant execute on function private.no_match(uuid) to authenticated;
drop policy sugestoes_match_dono_le on public.sugestoes_match;
create policy sugestoes_match_dono_le on public.sugestoes_match for select to authenticated
  using (perfil_id = (select auth.uid()) and (select public.tem_acesso('grupo')) and private.no_match(sugerido_id));

-- B8: dono_perfil_id e aprovada_por de empresas so para o dono e a equipe, por RPC.
revoke select on public.empresas from authenticated;
grant select (id, nome, slug, setor_id, cidade, pais, site, descricao, logo_path, status, aprovada_em, criado_em, atualizado_em)
  on public.empresas to authenticated;
create function public.minhas_empresas() returns setof public.empresas
language sql stable security definer
set search_path = ''
as $$
  select * from public.empresas e where e.dono_perfil_id = (select auth.uid()) order by e.id;
$$;
revoke all on function public.minhas_empresas() from public, anon;
grant execute on function public.minhas_empresas() to authenticated;
create function public.empresas_equipe() returns setof public.empresas
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'editor', 'moderador') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return query select * from public.empresas e order by e.status, e.id;
end $$;
revoke all on function public.empresas_equipe() from public, anon;
grant execute on function public.empresas_equipe() to authenticated;

-- M5: processar_evento_stripe igual a f1_20, com for update no pagamento antes do delta do estorno.
create or replace function public.processar_evento_stripe(p_conta_stripe_id bigint, p_evento jsonb) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event_id text := p_evento->>'id';
  v_tipo text := p_evento->>'type';
  v_criado timestamptz;
  v_obj jsonb := p_evento->'data'->'object';
  v_reserva bigint;
  v_item jsonb;
  v_plano public.planos;
  v_perfil uuid;
  v_conta_atual bigint;
  v_n int;
  v_status public.status_assinatura;
  v_perfil_meta uuid;
  v_achou boolean;
  v_resultado text := 'processado';
  v_existente text;
  v_aplicavel boolean;
  v_sub text;
  v_pag public.pagamentos;
  v_pag_id bigint;
  v_bruto bigint;
  v_vat bigint;
  v_delta bigint;
begin
  if coalesce(p_evento->>'created', '') !~ '^[0-9]{1,12}$' then
    raise exception 'evento_malformado: created ausente ou nao numerico no evento %', v_event_id;
  end if;
  v_criado := to_timestamp((p_evento->>'created')::bigint);
  if v_event_id is null or v_tipo is null or v_criado is null or v_obj is null then
    raise exception 'evento_malformado: falta id, type ou data.object';
  end if;

  -- Reservar antes de agir (Erros 5.2/5.4). payload = null: tipo e id bastam (sem dado pessoal guardado).
  insert into public.eventos_stripe (conta_stripe_id, event_id, tipo, criado_stripe_em, payload)
  values (p_conta_stripe_id, v_event_id, v_tipo, v_criado, null)
  on conflict (conta_stripe_id, event_id) do nothing
  returning id into v_reserva;

  if v_reserva is null then
    -- Ja reservado: se processado, sai; se nao (falha anterior gravada por fora), reprocessa.
    select id into v_reserva from public.eventos_stripe
    where conta_stripe_id = p_conta_stripe_id and event_id = v_event_id and processado_em is null
    for update;
    if v_reserva is null then
      return 'duplicado';
    end if;
  end if;

  if v_tipo in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    -- MVP: uma assinatura = um item (um Price).
    if jsonb_array_length(coalesce(v_obj->'items'->'data', '[]'::jsonb)) <> 1 then
      raise exception 'assinatura % deve ter exatamente 1 item', v_obj->>'id';
    end if;
    v_item := v_obj->'items'->'data'->0;
    if v_item->'price'->>'id' is null then
      raise exception 'item sem price na assinatura % (formato antigo com plan nao suportado)', v_obj->>'id';
    end if;
    -- quantity <> 1 cobraria outro valor e abriria o mesmo acesso.
    if (v_item->>'quantity') is distinct from '1' then
      raise exception 'quantity deve ser 1 na assinatura % (veio %)', v_obj->>'id', coalesce(v_item->>'quantity', 'nulo');
    end if;
    if v_obj->>'created' is not null and v_obj->>'created' !~ '^[0-9]{1,12}$' then
      raise exception 'evento_malformado: created da assinatura %', v_obj->>'id';
    end if;

    -- Status: o enum (f1_06) tem exatamente os 8 status do Stripe, entao o mapa e 1:1. Status novo do Stripe
    -- nao vira acesso por palpite: falha alto, o evento volta 500 e o Stripe reenvia ate o enum ser ampliado.
    if not (v_obj->>'status') = any (enum_range(null::public.status_assinatura)::text[]) or v_obj->>'status' is null then
      raise exception 'status_stripe_desconhecido: % na assinatura %', coalesce(v_obj->>'status', 'nulo'), v_obj->>'id';
    end if;
    v_status := (v_obj->>'status')::public.status_assinatura;

    -- Plano e nivel saem de planos (Cl. 5.6); o evento so confirma valor e moeda.
    select * into v_plano from public.planos
    where stripe_price_id = v_item->'price'->>'id' and conta_stripe_id = p_conta_stripe_id;
    if v_plano.id is null then
      raise exception 'Price desconhecido nesta conta: %', v_item->'price'->>'id';
    end if;
    if (v_item->'price'->>'unit_amount')::bigint is distinct from v_plano.valor_centavos
       or upper(v_item->'price'->>'currency') is distinct from v_plano.moeda then
      raise exception 'valor ou moeda do Price % divergem de planos', v_plano.stripe_price_id;
    end if;

    -- perfil: a unica fonte e clientes_stripe (conta + Customer), gravado pelo checkout. Nada e gravado aqui.
    select true, perfil_id into v_achou, v_perfil from public.clientes_stripe
    where conta_stripe_id = p_conta_stripe_id and stripe_customer_id = v_obj->>'customer';
    if v_achou is null then
      raise exception 'cliente_desconhecido: customer % sem vinculo em clientes_stripe', coalesce(v_obj->>'customer', 'nulo');
    end if;

    -- Dono apagado (GDPR; perfil_id vira NULL por on delete set null): so atualiza o ciclo de vida da assinatura
    -- orfa que ja existe (relatorios corretos); nao cria linha, nao liga a outro perfil, nao mexe em vinculo.
    -- A CONFIRMAR COM O CLIENTE: ele pode preferir cancelar a assinatura no Stripe no fluxo de exclusao de conta.
    if v_perfil is null or exists (select 1 from public.assinaturas
                                   where stripe_subscription_id = v_obj->>'id' and perfil_id is null
                                     and conta_stripe_id = p_conta_stripe_id) then
      update public.assinaturas set
        status = v_status,
        periodo_inicio = to_timestamp(coalesce(v_obj->>'current_period_start', v_item->>'current_period_start')::bigint),
        periodo_fim = to_timestamp(coalesce(v_obj->>'current_period_end', v_item->>'current_period_end')::bigint),
        cancela_no_fim = coalesce((v_obj->>'cancel_at_period_end')::boolean, false),
        cancelada_em = to_timestamp((v_obj->>'canceled_at')::bigint),
        stripe_evento_em = v_criado,
        atualizado_em = now()
      where stripe_subscription_id = v_obj->>'id' and conta_stripe_id = p_conta_stripe_id and perfil_id is null
        and (stripe_evento_em is null
             or v_criado > stripe_evento_em
             or (v_criado = stripe_evento_em and status not in ('canceled', 'incomplete_expired')));
      update public.eventos_stripe set processado_em = now(), erro = null where id = v_reserva;
      return 'ignorado_orfao';
    end if;

    -- metadata.perfil_id e so conferencia: se vier e divergir do vinculo, falha.
    v_perfil_meta := nullif(v_obj->'metadata'->>'perfil_id', '')::uuid;
    if v_perfil_meta is not null and v_perfil_meta is distinct from v_perfil then
      raise exception 'perfil_divergente: metadata.perfil_id difere de clientes_stripe no customer %', v_obj->>'customer';
    end if;
    if exists (select 1 from public.assinaturas where stripe_subscription_id = v_obj->>'id'
               and perfil_id is distinct from v_perfil) then
      raise exception 'perfil_divergente: assinatura % ja pertence a outro perfil', v_obj->>'id';
    end if;

    select conta_stripe_id into v_conta_atual from public.assinaturas where stripe_subscription_id = v_obj->>'id';
    if v_conta_atual is not null and v_conta_atual <> p_conta_stripe_id then
      raise exception 'assinatura % pertence a outra conta Stripe', v_obj->>'id';
    end if;

    -- Uma vigente por perfil (indice assinaturas_perfil_vigente_uq). Conflito nao levanta excecao (ver f1_13).
    select not exists (select 1 from public.assinaturas a where a.stripe_subscription_id = v_obj->>'id')
           or exists (select 1 from public.assinaturas a where a.stripe_subscription_id = v_obj->>'id'
                      and (a.stripe_evento_em is null
                           or v_criado > a.stripe_evento_em
                           or (v_criado = a.stripe_evento_em and a.status not in ('canceled', 'incomplete_expired'))))
    into v_aplicavel;
    if v_aplicavel and v_status in ('active', 'trialing', 'past_due') then
      select coalesce(stripe_subscription_id, 'manual') into v_existente from public.assinaturas
      where perfil_id = v_perfil and status in ('active', 'trialing', 'past_due')
        and stripe_subscription_id is distinct from v_obj->>'id'
      limit 1;
    end if;
    if v_existente is null then
      begin
        -- current_period_*: desde a API 2025-03-31.basil so em items.data[] (Decisoes 50); le os dois lugares.
        insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, origem,
                                        periodo_inicio, periodo_fim, cancela_no_fim, cancelada_em, stripe_evento_em,
                                        stripe_criada_em)
        values (
          v_perfil, p_conta_stripe_id, v_obj->>'id', v_plano.id, v_status, 'stripe',
          to_timestamp(coalesce(v_obj->>'current_period_start', v_item->>'current_period_start')::bigint),
          to_timestamp(coalesce(v_obj->>'current_period_end', v_item->>'current_period_end')::bigint),
          coalesce((v_obj->>'cancel_at_period_end')::boolean, false),
          to_timestamp((v_obj->>'canceled_at')::bigint),
          v_criado,
          to_timestamp((v_obj->>'created')::bigint))
        on conflict (stripe_subscription_id) do update set
          plano_id = excluded.plano_id,
          status = excluded.status,
          periodo_inicio = excluded.periodo_inicio,
          periodo_fim = excluded.periodo_fim,
          cancela_no_fim = excluded.cancela_no_fim,
          cancelada_em = excluded.cancelada_em,
          stripe_evento_em = excluded.stripe_evento_em,
          stripe_criada_em = coalesce(public.assinaturas.stripe_criada_em, excluded.stripe_criada_em)
        where public.assinaturas.stripe_evento_em is null
           or excluded.stripe_evento_em > public.assinaturas.stripe_evento_em
           -- empate de created: status terminal nunca e revivido por evento do mesmo segundo
           or (excluded.stripe_evento_em = public.assinaturas.stripe_evento_em
               and public.assinaturas.status not in ('canceled', 'incomplete_expired'));
        get diagnostics v_n = row_count;
      exception when unique_violation then
        -- corrida: outra transacao gravou a vigente entre a checagem e o upsert
        select coalesce(stripe_subscription_id, 'manual') into v_existente from public.assinaturas
        where perfil_id = v_perfil and status in ('active', 'trialing', 'past_due')
          and stripe_subscription_id is distinct from v_obj->>'id'
        limit 1;
        v_existente := coalesce(v_existente, '?');
      end;
    end if;
    if v_existente is not null then
      update public.eventos_stripe
      set erro = left('conflito_assinatura_vigente: ' || (v_obj->>'id') || ' x ' || v_existente, 200)
      where id = v_reserva;
      return 'conflito_assinatura_vigente';
    end if;
    if v_n = 0 then
      v_resultado := 'ignorado_antigo';
    end if;

  elsif v_tipo = 'checkout.session.completed' then
    -- Unico ponto que cria o vinculo Customer -> perfil; o status vem dos eventos customer.subscription.*.
    -- Fonte: client_reference_id (nosso servidor), nunca metadata.
    if coalesce(v_obj->>'client_reference_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'evento_malformado: client_reference_id';
    end if;
    v_perfil := (v_obj->>'client_reference_id')::uuid;
    if v_obj->>'customer' is null then
      raise exception 'checkout % sem customer', v_obj->>'id';
    end if;
    if exists (select 1 from public.clientes_stripe where conta_stripe_id = p_conta_stripe_id
               and stripe_customer_id = v_obj->>'customer' and perfil_id is distinct from v_perfil) then
      raise exception 'perfil_divergente: customer % ja ligado a outro perfil', v_obj->>'customer';
    end if;
    insert into public.clientes_stripe (conta_stripe_id, stripe_customer_id, perfil_id, email)
    values (p_conta_stripe_id, v_obj->>'customer', v_perfil, coalesce(v_obj->'customer_details'->>'email', ''))
    on conflict (conta_stripe_id, stripe_customer_id) do update set
      email = case when excluded.email = '' then public.clientes_stripe.email else excluded.email end;

    -- Avulso pago (mode=payment): a cobranca nao gera invoice (o checkout nao liga invoice_creation), entao o
    -- registro contabil nasce aqui, pela payment intent.
    if v_obj->>'mode' = 'payment' and v_obj->>'payment_status' = 'paid' then
      if v_obj->>'payment_intent' is null or coalesce(v_obj->>'amount_total', '') !~ '^[0-9]{1,15}$'
         or v_obj->>'currency' is null then
        raise exception 'evento_malformado: checkout avulso % sem payment_intent, amount_total ou currency', v_obj->>'id';
      end if;
      v_bruto := (v_obj->>'amount_total')::bigint;
      v_vat := least(v_bruto, coalesce((v_obj->'total_details'->>'amount_tax')::bigint, 0));
      insert into public.pagamentos (conta_stripe_id, stripe_payment_intent_id, perfil_id, cliente_email, moeda,
                                     bruto_centavos, vat_centavos, pago_em)
      values (p_conta_stripe_id, v_obj->>'payment_intent', v_perfil, coalesce(v_obj->'customer_details'->>'email', ''),
              upper(v_obj->>'currency'), v_bruto, v_vat, v_criado)
      on conflict (stripe_payment_intent_id) do nothing
      returning id into v_pag_id;
      if v_pag_id is not null then
        insert into public.pagamentos_itens (pagamento_id, plano_id, descricao, tipo_receita, bruto_centavos, vat_centavos)
        values (v_pag_id, null, 'checkout avulso: o evento nao traz o Price (pendencia no relatorio)', 'produto_digital',
                v_bruto, v_vat);
      end if;
    end if;

  elsif v_tipo = 'invoice.paid' then
    if v_obj->>'id' is null or v_obj->>'customer' is null or v_obj->>'currency' is null
       or coalesce(v_obj->>'amount_paid', '') !~ '^[0-9]{1,15}$' then
      raise exception 'evento_malformado: invoice % sem customer, currency ou amount_paid', coalesce(v_obj->>'id', 'nulo');
    end if;
    if coalesce((v_obj->'lines'->>'has_more')::boolean, false) then
      raise exception 'invoice % tem mais linhas do que o evento traz', v_obj->>'id';
    end if;
    select true, perfil_id into v_achou, v_perfil from public.clientes_stripe
    where conta_stripe_id = p_conta_stripe_id and stripe_customer_id = v_obj->>'customer';
    if v_achou is null then
      raise exception 'cliente_desconhecido: customer % sem vinculo em clientes_stripe', v_obj->>'customer';
    end if;
    v_sub := coalesce(v_obj->>'subscription', v_obj->'parent'->'subscription_details'->>'subscription');
    v_bruto := (v_obj->>'amount_paid')::bigint;
    -- VAT: tax (APIs antigas) ou soma de total_taxes (novas). least(): saldo de credito pode zerar o pago.
    v_vat := least(v_bruto, coalesce((v_obj->>'tax')::bigint,
                                     (select sum((t->>'amount')::bigint) from jsonb_array_elements(v_obj->'total_taxes') t),
                                     0));
    insert into public.pagamentos (conta_stripe_id, stripe_invoice_id, stripe_payment_intent_id, perfil_id, cliente_email,
                                   assinatura_id, moeda, bruto_centavos, vat_centavos, pago_em)
    values (p_conta_stripe_id, v_obj->>'id', v_obj->>'payment_intent', v_perfil,
            coalesce(v_obj->>'customer_email',
                     (select email from public.clientes_stripe where conta_stripe_id = p_conta_stripe_id
                      and stripe_customer_id = v_obj->>'customer'), ''),
            (select id from public.assinaturas where stripe_subscription_id = v_sub),
            upper(v_obj->>'currency'), v_bruto, v_vat,
            coalesce(to_timestamp((v_obj->'status_transitions'->>'paid_at')::bigint), v_criado))
    on conflict (stripe_invoice_id) do nothing
    returning id into v_pag_id;
    if v_pag_id is not null then
      insert into public.pagamentos_itens (pagamento_id, plano_id, descricao, tipo_receita, bruto_centavos, vat_centavos)
      select v_pag_id, pl.id, left(l->>'description', 300),
             coalesce(pl.tipo_receita, case when v_sub is not null then 'assinatura' else 'produto_digital' end::public.tipo_receita),
             coalesce((l->>'amount')::bigint, 0),
             coalesce((select sum((t->>'amount')::bigint)
                       from jsonb_array_elements(coalesce(l->'tax_amounts', l->'taxes', '[]'::jsonb)) t), 0)
      from jsonb_array_elements(coalesce(v_obj->'lines'->'data', '[]'::jsonb)) l
      left join public.planos pl on pl.conta_stripe_id = p_conta_stripe_id
        and pl.stripe_price_id = coalesce(l->'price'->>'id', l->'pricing'->'price_details'->>'price');
    end if;

  elsif v_tipo in ('charge.refunded', 'charge.dispute.closed') then
    if v_tipo = 'charge.dispute.closed' and v_obj->>'status' is distinct from 'lost' then
      v_resultado := 'ignorado_tipo';
    else
      select * into v_pag from public.pagamentos
      where conta_stripe_id = p_conta_stripe_id
        and ((v_obj->>'invoice' is not null and stripe_invoice_id = v_obj->>'invoice')
             or (v_obj->>'payment_intent' is not null and stripe_payment_intent_id = v_obj->>'payment_intent'))
      limit 1
      for update;  -- M5: serializa estornos do mesmo pagamento antes de calcular o delta
      if v_pag.id is null then
        raise exception 'pagamento_desconhecido: % sem pagamento gravado', coalesce(v_obj->>'id', 'nulo');
      end if;
      if upper(v_obj->>'currency') is distinct from v_pag.moeda then
        raise exception 'moeda do estorno % diverge do pagamento', v_obj->>'id';
      end if;
      if v_tipo = 'charge.refunded' then
        if coalesce(v_obj->>'amount_refunded', '') !~ '^[0-9]{1,15}$' then
          raise exception 'evento_malformado: charge % sem amount_refunded', coalesce(v_obj->>'id', 'nulo');
        end if;
        v_delta := (v_obj->>'amount_refunded')::bigint
                   - (select coalesce(sum(valor_centavos), 0) from public.reembolsos
                      where pagamento_id = v_pag.id and tipo = 'reembolso');
        if v_delta > 0 then
          insert into public.reembolsos (conta_stripe_id, stripe_id, tipo, pagamento_id, moeda, valor_centavos,
                                         vat_centavos, devolvido_em)
          values (p_conta_stripe_id, v_event_id, 'reembolso', v_pag.id, v_pag.moeda, v_delta,
                  -- VAT proporcional ao estorno [interpretacao]: evita deduzir o VAT duas vezes no Ciclo.
                  case when v_pag.bruto_centavos > 0 then round(v_delta::numeric * v_pag.vat_centavos / v_pag.bruto_centavos)::bigint else 0 end,
                  v_criado);
        else
          v_resultado := 'ignorado_antigo';
        end if;
      else
        if coalesce(v_obj->>'amount', '') !~ '^[0-9]{1,15}$' or v_obj->>'id' is null then
          raise exception 'evento_malformado: disputa sem id ou amount';
        end if;
        insert into public.reembolsos (conta_stripe_id, stripe_id, tipo, pagamento_id, moeda, valor_centavos,
                                       vat_centavos, devolvido_em)
        values (p_conta_stripe_id, v_obj->>'id', 'chargeback', v_pag.id, v_pag.moeda, (v_obj->>'amount')::bigint,
                case when v_pag.bruto_centavos > 0
                     then round((v_obj->>'amount')::numeric * v_pag.vat_centavos / v_pag.bruto_centavos)::bigint else 0 end,
                v_criado)
        on conflict (stripe_id) do nothing;
      end if;
    end if;

  else
    -- invoice.payment_failed e demais: processados sem efeito.
    v_resultado := 'ignorado_tipo';
  end if;

  update public.eventos_stripe set processado_em = now(), erro = null where id = v_reserva;
  return v_resultado;
end $$;

revoke all on function public.processar_evento_stripe(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.processar_evento_stripe(bigint, jsonb) to service_role;

revoke all on function public.processar_evento_stripe(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.processar_evento_stripe(bigint, jsonb) to service_role;

-- M7: exportacao v3: + indicados, receitas_externas, reembolsos, log da equipe sobre o titular e consentimentos
-- registrados pelo e-mail confirmado (ex.: premiado que consentiu antes de ter conta).
create or replace function public.exportar_meus_dados() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'nao_autenticado';
  end if;

  return jsonb_build_object(
    'versao', 3,
    'exportado_em', now(),
    'indicados', coalesce((
      select jsonb_agg(jsonb_build_object('edicao', ed.nome, 'nome', i.nome, 'resumo', i.resumo,
                                          'publicado_em', i.publicado_em) order by i.id)
      from public.indicados i join public.edicoes ed on ed.id = i.edicao_id where i.perfil_id = uid), '[]'::jsonb),
    'receitas_externas', coalesce((
      select jsonb_agg(jsonb_build_object('recebido_em', e.recebido_em, 'origem', e.origem, 'cliente_nome', e.cliente_nome,
                                          'cliente_email', e.cliente_email, 'moeda', e.moeda, 'bruto_centavos', e.bruto_centavos,
                                          'vat_centavos', e.vat_centavos, 'anulado_em', e.anulado_em) order by e.id)
      from public.receitas_externas e where e.perfil_id = uid), '[]'::jsonb),
    'reembolsos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'moeda', r.moeda, 'valor_centavos', r.valor_centavos,
                                          'devolvido_em', r.devolvido_em) order by r.id)
      from public.reembolsos r
      left join public.pagamentos p on p.id = r.pagamento_id
      left join public.receitas_externas e on e.id = r.receita_externa_id
      where p.perfil_id = uid or e.perfil_id = uid), '[]'::jsonb),
    'log_equipe', coalesce((
      select jsonb_agg(jsonb_build_object('tabela', l.tabela, 'acao', l.acao, 'em', l.criado_em,
                                          'antes', l.antes, 'depois', l.depois) order by l.id)
      from public.log_admin l where l.alvo_id = uid::text), '[]'::jsonb),
    'conta', (select jsonb_build_object('id', u.id, 'email', u.email, 'criado_em', u.created_at,
                                        'email_confirmado_em', u.email_confirmed_at)
              from auth.users u where u.id = uid),
    'perfil', (select to_jsonb(p) from public.perfis p where p.id = uid),
    'contato', (select jsonb_build_object('email_contato', c.email_contato, 'whatsapp', c.whatsapp)
                from public.perfis_contato c where c.perfil_id = uid),
    'equipe', (select e.papel from public.equipe e where e.perfil_id = uid),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plano', jsonb_build_object('nome', pl.nome, 'nivel', pl.nivel, 'intervalo', pl.intervalo),
        'stripe_subscription_id', a.stripe_subscription_id,
        'status', a.status, 'origem', a.origem,
        'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim,
        'cancela_no_fim', a.cancela_no_fim, 'cancelada_em', a.cancelada_em,
        'stripe_criada_em', a.stripe_criada_em,
        'criado_em', a.criado_em, 'atualizado_em', a.atualizado_em) order by a.id)
      from public.assinaturas a join public.planos pl on pl.id = a.plano_id
      where a.perfil_id = uid), '[]'::jsonb),
    'clientes_stripe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conta', cs.stripe_account_id, 'stripe_customer_id', c.stripe_customer_id,
        'email', c.email, 'criado_em', c.criado_em) order by c.id)
      from public.clientes_stripe c join public.contas_stripe cs on cs.id = c.conta_stripe_id
      where c.perfil_id = uid), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stripe_invoice_id', p.stripe_invoice_id, 'stripe_payment_intent_id', p.stripe_payment_intent_id,
        'cliente_email', p.cliente_email, 'moeda', p.moeda, 'bruto_centavos', p.bruto_centavos,
        'vat_centavos', p.vat_centavos, 'pago_em', p.pago_em) order by p.id)
      from public.pagamentos p where p.perfil_id = uid), '[]'::jsonb),
    'consentimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', d.tipo, 'versao', d.versao, 'idioma', d.idioma, 'aceito_em', c.aceito_em,
        'revogado_em', c.revogado_em, 'evidencia', c.evidencia) order by c.id)
      from public.consentimentos c join public.documentos_legais d on d.id = c.documento_id
      where c.perfil_id = uid
         or lower(c.titular_email) = (select lower(u.email) from auth.users u
                                      where u.id = uid and u.email_confirmed_at is not null)), '[]'::jsonb),
    'pedidos_gdpr', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', g.tipo, 'status', g.status, 'prazo_em', g.prazo_em,
                                          'concluido_em', g.concluido_em, 'criado_em', g.criado_em) order by g.id)
      from public.pedidos_gdpr g where g.perfil_id = uid), '[]'::jsonb),
    'entregas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aula', a.titulo, 'exercicio_ordem', x.ordem, 'texto', e.texto, 'arquivo_path', e.arquivo_path,
        'status', e.status, 'devolutiva', e.devolutiva, 'enviada_em', e.enviada_em, 'corrigido_em', e.corrigido_em)
        order by e.id)
      from public.entregas e join public.exercicios x on x.id = e.exercicio_id join public.aulas a on a.id = x.aula_id
      where e.perfil_id = uid), '[]'::jsonb),
    'progresso_aulas', coalesce((
      select jsonb_agg(jsonb_build_object('aula', a.titulo, 'percentual', g.percentual, 'posicao_seg', g.posicao_seg,
                                          'concluida_em', g.concluida_em, 'atualizado_em', g.atualizado_em) order by a.id)
      from public.progresso_aula g join public.aulas a on a.id = g.aula_id where g.perfil_id = uid), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('espaco', s.slug, 'corpo', p.corpo, 'criado_em', p.criado_em,
                                          'editado_em', p.editado_em, 'oculto_em', p.oculto_em) order by p.id)
      from public.posts p join public.espacos s on s.id = p.espaco_id where p.autor_id = uid), '[]'::jsonb),
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', c.post_id, 'corpo', c.corpo, 'criado_em', c.criado_em,
                                          'editado_em', c.editado_em, 'oculto_em', c.oculto_em) order by c.id)
      from public.comentarios c where c.autor_id = uid), '[]'::jsonb),
    'curtidas', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', c.post_id, 'criado_em', c.criado_em) order by c.post_id)
      from public.curtidas c where c.perfil_id = uid), '[]'::jsonb),
    'salvos', coalesce((
      select jsonb_agg(jsonb_build_object('aula', a.titulo, 'video', v.titulo, 'criado_em', s.criado_em) order by s.id)
      from public.salvos s left join public.aulas a on a.id = s.aula_id left join public.videos v on v.id = s.video_id
      where s.perfil_id = uid), '[]'::jsonb),
    'denuncias_feitas', coalesce((
      select jsonb_agg(jsonb_build_object('motivo', d.motivo, 'texto', d.texto, 'status', d.status,
                                          'criado_em', d.criado_em) order by d.id)
      from public.denuncias d where d.denunciante_id = uid), '[]'::jsonb),
    'network', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', n.tipo, 'categoria', cr.nome, 'texto', n.texto) order by n.id)
      from public.network_itens n join public.categorias_rede cr on cr.id = n.categoria_id where n.perfil_id = uid), '[]'::jsonb),
    'conexoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'papel', case when c.solicitante_id = uid then 'solicitante' else 'destinatario' end,
        'status', c.status, 'origem', c.origem,
        'mensagem', case when c.solicitante_id = uid then c.mensagem end,
        'pedida_em', c.pedida_em, 'respondida_em', c.respondida_em) order by c.id)
      from public.conexoes c where uid in (c.solicitante_id, c.destinatario_id)), '[]'::jsonb),
    'sugestoes_match', coalesce((
      select jsonb_agg(jsonb_build_object('semana', s.semana, 'pontuacao', s.pontuacao) order by s.id)
      from public.sugestoes_match s where s.perfil_id = uid), '[]'::jsonb),
    'notificacoes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', n.tipo, 'titulo', n.titulo, 'criado_em', n.criado_em,
                                          'lida_em', n.lida_em) order by n.id)
      from public.notificacoes n where n.perfil_id = uid), '[]'::jsonb),
    'empresas', coalesce((
      select jsonb_agg(jsonb_build_object('nome', e.nome, 'slug', e.slug, 'cidade', e.cidade, 'pais', e.pais,
                                          'site', e.site, 'descricao', e.descricao, 'status', e.status) order by e.id)
      from public.empresas e where e.dono_perfil_id = uid), '[]'::jsonb),
    'premiados', coalesce((
      select jsonb_agg(jsonb_build_object('edicao', ed.nome, 'nome', p.nome, 'historia', p.historia,
                                          'redes', p.redes, 'materia_url', p.materia_url,
                                          'publicado_em', p.publicado_em) order by p.id)
      from public.premiados p join public.edicoes ed on ed.id = p.edicao_id where p.perfil_id = uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

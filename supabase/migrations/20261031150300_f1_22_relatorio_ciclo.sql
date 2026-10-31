-- F1 Relatorio do Ciclo (ADM-07, PRD 9.1.4 e 17.5.6) e concessao de acesso manual.
-- Leitura (previa): super_admin e auditor. Fechar, reabrir, marcar enviado e conceder acesso: so super_admin
-- (o auditor so le, por conflito de interesse). Tudo com aal2 (private.papel_atual).
-- (f1_21 ficou para a prova do aceite no checkout, feita em outra branch.)
--
-- Formula (interpretacao registrada, PRD 9.1.6 pendencias 3, 4, 5 e 10; a validar por escrito entre as Partes):
--   receita bruta  = pagamentos do Stripe com pago_em no Ciclo + receitas_externas nao anuladas com recebido_em no Ciclo
--   deducoes       = VAT dessas receitas + (estornos devolvidos no Ciclo - VAT desses estornos)
--   receita base   = bruta - deducoes
--   conversao      = taxa BCE do dia 9 (ou a ultima publicada antes), unidades por 1 EUR; valor_eur = valor / taxa
--   clientes ativos= public.clientes_ativos(ciclo)
--   IA             = avulsa (itens de plano sem nivel cuja vertical conta_como_ia) + rateio das assinaturas por
--                    horas de aula de IA publicadas no Ciclo / horas publicadas no Ciclo, por nivel do plano
--   faixa          = pela contagem de Clientes Ativos, limites da v3 do contrato (ate 100, 101 a 500, acima de 500).
--                    PROVISORIO: os percentuais de cada faixa nao estao definidos; o relatorio nao os inventa.

-- Soma de duracao/60 das aulas com materiais publicados no Ciclo, para quem tem o nivel dado (pendencia 4).
-- plpgsql de proposito: aulas e criada na F2 (f2_01); o corpo so e resolvido na execucao.
create function private.horas_ciclo(p_inicio date, p_nivel public.nivel_acesso, p_so_ia boolean) returns numeric
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_ini timestamptz;
  v_fim timestamptz;
  v_h numeric;
begin
  if to_regclass('public.aulas') is null then
    return 0;
  end if;
  select ini, fim into v_ini, v_fim from private.ciclo_limites(p_inicio);
  select coalesce(sum(a.duracao_min), 0) / 60.0 into v_h
  from public.aulas a join public.verticais v on v.id = a.vertical_id
  where a.materiais_publicados_em >= v_ini and a.materiais_publicados_em < v_fim
    and a.nivel_minimo <= p_nivel and (not p_so_ia or v.conta_como_ia);
  return v_h;
end $$;
revoke all on function private.horas_ciclo(date, public.nivel_acesso, boolean) from public, anon, authenticated;

create function private.exigir_financeiro() returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'auditor') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end $$;
revoke all on function private.exigir_financeiro() from public, anon, authenticated;

create function private.exigir_super_admin() returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is distinct from 'super_admin' then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end $$;
revoke all on function private.exigir_super_admin() from public, anon, authenticated;

create function private.exigir_ciclo(p date) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p is null or extract(day from p) <> 10 then
    raise exception 'ciclo_invalido: o Ciclo comeca no dia 10' using errcode = 'P0001';
  end if;
end $$;
revoke all on function private.exigir_ciclo(date) from public, anon, authenticated;

-- Clientes Ativos (Cl. 1(e) [interpretacao], pendencia 10). Chave = perfil, ou e-mail, ou a propria linha.
--   (a) assinatura (stripe ou manual) com status 'active' no ultimo instante do Ciclo (historico em
--       assinaturas_status); a manual precisa estar no periodo nesse instante
--   (b) pagamento do Stripe com valor > 0 no Ciclo, menos os estornados por inteiro no mesmo Ciclo
--   (c) receita externa nao anulada no Ciclo, menos as estornadas por inteiro no mesmo Ciclo
create function public.clientes_ativos(ciclo_inicio date) returns table (cliente_chave text, origem text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_ini timestamptz;
  v_fim timestamptz;
  v_fim_data date := (ciclo_inicio + interval '1 month')::date;
begin
  perform private.exigir_financeiro();
  perform private.exigir_ciclo(ciclo_inicio);
  select l.ini, l.fim into v_ini, v_fim from private.ciclo_limites(ciclo_inicio) l;
  return query
  select distinct on (x.chave) x.chave, x.origem from (
    select coalesce(a.perfil_id::text, 'assinatura:' || a.id) as chave, 'assinatura'::text as origem, 1 as prio
    from public.assinaturas a
    where (select s.status from public.assinaturas_status s
           where s.assinatura_id = a.id and s.desde < v_fim order by s.desde desc, s.id desc limit 1) = 'active'
      and (a.origem = 'stripe' or (a.periodo_inicio < v_fim and a.periodo_fim >= v_fim))
    union all
    select coalesce(p.perfil_id::text, lower(nullif(p.cliente_email, '')), 'pagamento:' || p.id), 'pagamento', 2
    from public.pagamentos p
    where p.pago_em >= v_ini and p.pago_em < v_fim and p.bruto_centavos > 0
      and p.bruto_centavos > (select coalesce(sum(r.valor_centavos), 0) from public.reembolsos r
                              where r.pagamento_id = p.id and r.devolvido_em >= v_ini and r.devolvido_em < v_fim)
    union all
    select coalesce(e.perfil_id::text, lower(e.cliente_email), 'receita:' || e.id), 'receita_externa', 3
    from public.receitas_externas e
    where e.anulado_em is null and e.recebido_em >= ciclo_inicio and e.recebido_em < v_fim_data
      and e.bruto_centavos > (select coalesce(sum(r.valor_centavos), 0) from public.reembolsos r
                              where r.receita_externa_id = e.id and r.devolvido_em >= v_ini and r.devolvido_em < v_fim)
  ) x
  order by x.chave, x.prio;
end $$;
revoke all on function public.clientes_ativos(date) from public, anon;
grant execute on function public.clientes_ativos(date) to authenticated;

-- Previa do relatorio (so calcula; nao grava). Valores em centavos de EUR.
-- volatile: usa tabela temporaria (chamar por POST, como o supabase-js faz em rpc()).
create function public.relatorio_ciclo(ciclo_inicio date) returns jsonb
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
  select 'fonte;ref_id;data;conta_ou_origem;cliente;moeda;bruto;vat;taxa;bruto_eur;vat_eur;referencia' || chr(10) ||
         coalesce(string_agg(concat_ws(';', l.fonte, l.ref_id, l.data, l.conta_ou_origem,
                                       replace(replace(coalesce(l.cliente, ''), ';', ','), chr(10), ' '),
                                       l.moeda, l.bruto, l.vat, l.taxa, l.bruto_eur, l.vat_eur,
                                       replace(coalesce(l.referencia, ''), ';', ',')),
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
revoke all on function public.relatorio_ciclo(date) from public, anon;
grant execute on function public.relatorio_ciclo(date) to authenticated;

-- Fecha o Ciclo: congela a previa como nova versao (1, ou a seguinte depois de uma reabertura).
-- So depois que o Ciclo terminou. csv_sha256 = sha256 do csv guardado em dados.
create function public.fechar_ciclo(ciclo_inicio date) returns public.relatorios_ciclo
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
  -- serializa fechamentos do mesmo Ciclo
  perform pg_advisory_xact_lock(hashtextextended('fechar_ciclo:' || ciclo_inicio, 0));
  select * into v_ultima from public.relatorios_ciclo r where r.ciclo_inicio = fechar_ciclo.ciclo_inicio
  order by r.versao desc limit 1;
  if v_ultima.versao is not null and v_ultima.reaberto_em is null then
    raise exception 'ciclo_ja_fechado' using errcode = 'P0001';
  end if;
  v_dados := public.relatorio_ciclo(ciclo_inicio);
  v_dados := jsonb_set(v_dados, '{ciclo,estado}', '"fechado"');
  v_dados := jsonb_set(v_dados, '{ciclo,ultima_versao}', to_jsonb(coalesce(v_ultima.versao, 0) + 1));
  insert into public.relatorios_ciclo (ciclo_inicio, versao, ciclo_fim, dados, csv_sha256, gerado_por, motivo_reemissao)
  values (ciclo_inicio, coalesce(v_ultima.versao, 0) + 1, (ciclo_inicio + interval '1 month' - interval '1 day')::date,
          v_dados, encode(sha256(convert_to(v_dados->>'csv', 'UTF8')), 'hex'), (select auth.uid()),
          v_ultima.motivo_reabertura)
  returning * into v_novo;
  return v_novo;
end $$;
revoke all on function public.fechar_ciclo(date) from public, anon;
grant execute on function public.fechar_ciclo(date) to authenticated;

-- Reabre o Ciclo fechado (motivo obrigatorio, fica no log). O proximo fechar_ciclo grava a versao seguinte.
create function public.reabrir_ciclo(ciclo_inicio date, motivo text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_super_admin();
  if motivo is null or length(btrim(motivo)) < 5 or length(motivo) > 1000 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  update public.relatorios_ciclo r set reaberto_em = now(), reaberto_por = (select auth.uid()), motivo_reabertura = btrim(motivo)
  where r.ciclo_inicio = reabrir_ciclo.ciclo_inicio and r.reaberto_em is null
    and r.versao = (select max(x.versao) from public.relatorios_ciclo x where x.ciclo_inicio = reabrir_ciclo.ciclo_inicio);
  if not found then
    raise exception 'ciclo_nao_fechado' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.reabrir_ciclo(date, text) from public, anon;
grant execute on function public.reabrir_ciclo(date, text) to authenticated;

create function public.marcar_relatorio_enviado(ciclo_inicio date, versao int) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_super_admin();
  update public.relatorios_ciclo r set enviado_em = now()
  where r.ciclo_inicio = marcar_relatorio_enviado.ciclo_inicio and r.versao = marcar_relatorio_enviado.versao
    and r.enviado_em is null;
  if not found then
    raise exception 'relatorio_inexistente_ou_ja_enviado' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.marcar_relatorio_enviado(date, int) from public, anon;
grant execute on function public.marcar_relatorio_enviado(date, int) to authenticated;

-- Acesso pago por fora do Stripe (PRD 9.1.6 pendencia 1, A CONFIRMAR com o contratante). A receita externa
-- precisa existir, nao estar anulada e ser da mesma pessoa (ou sem perfil). Uma vigente por perfil (indice f1_13).
create function public.conceder_acesso_manual(perfil uuid, plano bigint, receita bigint, ate timestamptz) returns bigint
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
                 and (e.perfil_id is null or e.perfil_id = perfil)) then
    raise exception 'receita_invalida' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfis p where p.id = perfil) then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  begin
    insert into public.assinaturas (perfil_id, plano_id, status, origem, receita_externa_id, periodo_inicio, periodo_fim)
    values (perfil, plano, 'active', 'manual', receita, now(), ate)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'assinatura_vigente_existente' using errcode = 'P0001';
  end;
  perform private.log_rpc('assinaturas', v_id::text,
                          jsonb_build_object('rpc', 'conceder_acesso_manual', 'perfil', perfil, 'plano', plano,
                                             'receita', receita, 'ate', ate));
  return v_id;
end $$;
revoke all on function public.conceder_acesso_manual(uuid, bigint, bigint, timestamptz) from public, anon;
grant execute on function public.conceder_acesso_manual(uuid, bigint, bigint, timestamptz) to authenticated;

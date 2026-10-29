-- F1 webhook do Stripe, passo 1.2: assinatura ORFA (dono apagou a conta) passa a ter o ciclo de vida atualizado.
-- Antes (f1_11/f1_13) o evento era ignorado por completo e a linha ficava para sempre com o status antigo
-- (ex.: active), distorcendo relatorios e contagens por status. Agora, nos dois casos orfaos (vinculo do customer
-- com perfil_id nulo, ou assinatura ja existente com perfil_id nulo), a RPC atualiza SO status, periodo_inicio,
-- periodo_fim, cancela_no_fim, cancelada_em, stripe_evento_em e atualizado_em da linha existente (mesma conta),
-- com as mesmas regras de ordem do upsert normal. Nunca cria assinatura, nunca mexe em vinculo, perfil_id,
-- plano_id, conta_stripe_id nem origem; perfil nulo nao da tem_acesso, entao nenhum acesso e reaberto.
-- O texto de retorno continua 'ignorado_orfao' por compatibilidade, embora o ciclo de vida da assinatura orfa
-- seja atualizado para os relatorios ficarem corretos. A checagem de assinatura vigente nao se aplica a orfas.

-- Mesma assinatura da f1_11; muda so o upsert de assinaturas (checagem de conflito + captura de unique_violation).
-- Retorno: 'processado' | 'duplicado' | 'ignorado_antigo' | 'ignorado_tipo' | 'ignorado_orfao' | 'conflito_assinatura_vigente'.
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

    -- Status: o enum (f1_06) tem exatamente os 8 status do Stripe (active, trialing, past_due, canceled, unpaid,
    -- incomplete, incomplete_expired, paused), entao o mapa e 1:1. Status novo do Stripe nao vira acesso por
    -- palpite: falha alto, o evento volta 500 e o Stripe reenvia ate o enum ser ampliado.
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

    -- Uma vigente por perfil (indice assinaturas_perfil_vigente_uq). Conflito nao levanta excecao:
    -- o evento pode so estar fora de ordem (a antiga ainda nao foi cancelada), entao a reserva fica sem
    -- processado_em, com erro curto (sem dado pessoal), e a Edge Function responde 500 para o Stripe reenviar.
    -- Duplicata real continua falhando a cada reenvio ate alguem agir: o alerta humano e esse.
    -- So e conflito se o evento ainda e APLICAVEL: mesmo predicado do filtro de ordem do upsert, para a linha da
    -- propria assinatura. Evento obsoleto segue para o upsert, que o ignora ('ignorado_antigo'), sem alarme falso.
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
        -- current_period_*: nas APIs antigas no objeto subscription; nas novas em items.data[0].
        -- NAO VERIFICADO: confirmar o formato real com o 1o evento de teste (Erros 5.2).
        insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, origem,
                                        periodo_inicio, periodo_fim, cancela_no_fim, cancelada_em, stripe_evento_em)
        values (
          v_perfil, p_conta_stripe_id, v_obj->>'id', v_plano.id, v_status, 'stripe',
          to_timestamp(coalesce(v_obj->>'current_period_start', v_item->>'current_period_start')::bigint),
          to_timestamp(coalesce(v_obj->>'current_period_end', v_item->>'current_period_end')::bigint),
          coalesce((v_obj->>'cancel_at_period_end')::boolean, false),
          to_timestamp((v_obj->>'canceled_at')::bigint),
          v_criado)
        on conflict (stripe_subscription_id) do update set
          plano_id = excluded.plano_id,
          status = excluded.status,
          periodo_inicio = excluded.periodo_inicio,
          periodo_fim = excluded.periodo_fim,
          cancela_no_fim = excluded.cancela_no_fim,
          cancelada_em = excluded.cancelada_em,
          stripe_evento_em = excluded.stripe_evento_em
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

  else
    -- invoice.paid, invoice.payment_failed e demais: processados sem efeito (charge.refunded e decisao do cliente).
    v_resultado := 'ignorado_tipo';
  end if;

  update public.eventos_stripe set processado_em = now(), erro = null where id = v_reserva;
  return v_resultado;
end $$;

revoke all on function public.processar_evento_stripe(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.processar_evento_stripe(bigint, jsonb) to service_role;

-- F1 webhook do Stripe, passo 1 (ASS-02/03/04; plano "Webhook do Stripe", itens 4-10).
-- A Edge Function so verifica a assinatura e chama esta RPC; toda a regra mora aqui, numa transacao:
-- qualquer erro desfaz a reserva e a escrita, a funcao responde 500 e o Stripe reenvia.
-- Nenhum preco, valor ou Price ID mora aqui: plano e preco vem sempre de public.planos.

-- Fora de ordem: created do ultimo evento aplicado na assinatura; evento mais antigo nao sobrescreve.
alter table public.assinaturas add column stripe_evento_em timestamptz;

-- Vinculo Customer -> perfil (clientes_stripe): criado SO por checkout.session.completed, a partir de
-- client_reference_id (gravado pelo nosso servidor ao criar a sessao, com o usuario autenticado). metadata nunca
-- e fonte do vinculo: quem edita metadata no painel do Stripe nao pode dar acesso pago a qualquer perfil.
-- customer.subscription.* de Customer sem vinculo = erro 'cliente_desconhecido' (o Stripe reenvia; o checkout
-- costuma chegar logo depois).
-- Retorno: 'processado' | 'duplicado' | 'ignorado_antigo' | 'ignorado_tipo' | 'ignorado_orfao'.
-- Grava SO assinaturas, clientes_stripe e eventos_stripe. NUNCA planos, contas_stripe, perfis nem equipe.
create function public.processar_evento_stripe(p_conta_stripe_id bigint, p_evento jsonb) returns text
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

    -- Dono apagado (GDPR; perfil_id vira NULL por on delete set null): marca o evento processado e nao toca em
    -- assinaturas, para o Stripe nao reenviar por dias nem a assinatura ser religada a outro perfil.
    -- A CONFIRMAR COM O RAFAEL: ele pode preferir cancelar a assinatura no Stripe no fluxo de exclusao de conta.
    if v_perfil is null or exists (select 1 from public.assinaturas
                                   where stripe_subscription_id = v_obj->>'id' and perfil_id is null) then
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
    -- invoice.paid, invoice.payment_failed e demais: processados sem efeito (charge.refunded e decisao do o cliente).
    v_resultado := 'ignorado_tipo';
  end if;

  update public.eventos_stripe set processado_em = now(), erro = null where id = v_reserva;
  return v_resultado;
end $$;

revoke all on function public.processar_evento_stripe(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.processar_evento_stripe(bigint, jsonb) to service_role;

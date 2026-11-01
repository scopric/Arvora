-- F1 webhook do Stripe, passo 2: a RPC passa a gravar pagamentos e estornos (Receita Base do Ciclo, ADM-07) e a
-- data de criacao da assinatura no Stripe (regra dos 14 dias da exclusao de conta).
-- O que muda em relacao a f1_14 (o resto e identico, inclusive a idempotencia por eventos_stripe):
--   * customer.subscription.*: grava assinaturas.stripe_criada_em = subscription.created (so na 1a vez).
--   * invoice.paid: grava pagamentos + pagamentos_itens (uma vez por invoice: on conflict do nothing).
--   * checkout.session.completed com mode=payment e payment_status=paid (avulso): grava pagamentos. O evento nao
--     traz o Price, entao a linha fica com plano_id nulo e o relatorio lista como pendencia.
--   * charge.refunded: grava reembolsos com o DELTA entre amount_refunded e o que ja foi gravado para o
--     pagamento (stripe_id = id do evento). Assim o total fica certo com ou sem a lista refunds no evento
--     (nas APIs novas ela nao vem expandida); a data e a do evento.
--   * charge.dispute.closed com status lost: grava reembolsos tipo chargeback (stripe_id = id da disputa).
--   * Reembolso NAO corta acesso aqui: isso e decisao do contratante (plano "Webhook do Stripe").
-- NAO VERIFICADO (Erros 5.2): nomes dos campos nas APIs novas (parent.subscription_details.subscription,
-- lines.data[].pricing.price_details.price, total_taxes, taxes) e onde o charge aponta para a invoice/payment
-- intent. A RPC le os dois formatos com coalesce; confirmar com os primeiros eventos reais da conta de teste.
-- Pagamento nao encontrado para um estorno = excecao (500, o Stripe reenvia, a equipe ve em eventos_stripe).
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
      limit 1;
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

-- Job: zera o payload de eventos_stripe com mais de 90 dias (PRD 9.1.4). Hoje a RPC ja grava payload = null;
-- o job cobre gravacoes futuras ou feitas por fora. Retorna quantas linhas zerou.
create function private.limpar_payload_stripe() returns int
language plpgsql security definer
set search_path = ''
as $$
declare n int;
begin
  update public.eventos_stripe set payload = null
  where payload is not null and criado_em < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.limpar_payload_stripe() from public, anon, authenticated;

-- pg_cron (UTC). A extensao vem pre-carregada no Supabase (local e hospedado).
create extension if not exists pg_cron;
select cron.schedule('limpa-payload-stripe', '0 3 * * *', 'select private.limpar_payload_stripe()');

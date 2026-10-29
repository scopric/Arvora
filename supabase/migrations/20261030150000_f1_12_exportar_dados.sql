-- Exportacao dos dados pessoais da propria pessoa (GDPR art. 15 e 20).
-- public.exportar_meus_dados(): sem parametros, so le (select auth.uid()). Nao ha como pedir dado de outra pessoa,
-- nem para super_admin ou auditor (que leem tudo por RLS): a funcao devolve SO o titular logado.
--
-- ENTRA: conta (id, e-mail, datas de auth.users), perfil (todas as colunas, inclusive maior_18_em, que o
-- grant por coluna esconde da API mas e dado do titular), papel de equipe, assinaturas (plano, status,
-- periodos, origem, datas) e clientes_stripe (conta, customer, e-mail, data).
-- FICA DE FORA: eventos_stripe (log operacional de webhook, nao e dado do titular e o payload pode trazer
-- dado de terceiros), hash de senha e tokens de auth.users, ids internos de conta_stripe/plano/receita externa
-- e valores de preco (o plano e identificado por nome/nivel/intervalo).
create function public.exportar_meus_dados() returns jsonb
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
    'versao', 1,
    'exportado_em', now(),
    'conta', (select jsonb_build_object('id', u.id, 'email', u.email, 'criado_em', u.created_at,
                                        'email_confirmado_em', u.email_confirmed_at)
              from auth.users u where u.id = uid),
    'perfil', (select to_jsonb(p) from public.perfis p where p.id = uid),
    'equipe', (select e.papel from public.equipe e where e.perfil_id = uid),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plano', jsonb_build_object('nome', pl.nome, 'nivel', pl.nivel, 'intervalo', pl.intervalo),
        'status', a.status, 'origem', a.origem,
        'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim,
        'cancela_no_fim', a.cancela_no_fim, 'cancelada_em', a.cancelada_em,
        'criado_em', a.criado_em, 'atualizado_em', a.atualizado_em) order by a.id)
      from public.assinaturas a join public.planos pl on pl.id = a.plano_id
      where a.perfil_id = uid), '[]'::jsonb),
    'clientes_stripe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conta', cs.stripe_account_id, 'stripe_customer_id', c.stripe_customer_id,
        'email', c.email, 'criado_em', c.criado_em) order by c.id)
      from public.clientes_stripe c join public.contas_stripe cs on cs.id = c.conta_stripe_id
      where c.perfil_id = uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

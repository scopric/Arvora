-- Exportacao v4 (GDPR art. 15): + aceites_checkout (a prova do pedido expresso guardada no checkout, f1_21).
-- Mesma funcao da f4_03 com a chave nova; o resto do corpo e identico.
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
    'versao', 4,
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
    'aceites_checkout', coalesce((
      select jsonb_agg(jsonb_build_object('criado_em', a.criado_em, 'tipo', a.tipo, 'versao_texto', a.versao_texto,
                                          'plano', pl.nome) order by a.id)
      from private.aceites_checkout a join public.planos pl on pl.id = a.plano_id where a.perfil_id = uid), '[]'::jsonb),
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

-- GDPR depois das tabelas novas (PRD §11 e §13 F2: "uma conta excluida nao deixa entrega nem arquivo").
--
-- Exclusao (delete em auth.users pelo servico excluir-conta):
--   cascade (apagado): perfis, equipe, entregas, progresso_aula, salvos, curtidas, notificacoes, perfis_contato,
--     network_itens, conexoes, sugestoes_match.
--   set null (fica sem o titular): posts e comentarios (autoria anonimizada), denuncias, consentimentos (a prova
--     guarda o e-mail, art. 7(1)), pedidos_gdpr, empresas.dono_perfil_id, premiados/indicados.perfil_id,
--     aulas.especialista_id.
--   RETIDO POR OBRIGACAO LEGAL (6 anos, Cl. 10.5; a validar pelo solicitor): assinaturas, clientes_stripe,
--     pagamentos (com cliente_email), receitas_externas e reembolsos.
--   Arquivos: o cascade nao apaga Storage. O servico chama public.arquivos_do_titular(uid), remove cada objeto
--   pela API do Storage e so depois apaga o usuario; o gatilho abaixo BARRA a exclusao se ainda sobrar arquivo.

create function public.arquivos_do_titular(p_uid uuid) returns table (bucket text, nome text)
language sql stable security definer
set search_path = ''
as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id = 'entregas' and (storage.foldername(o.name))[1] = p_uid::text
  order by o.name;
$$;
revoke all on function public.arquivos_do_titular(uuid) from public, anon, authenticated;
grant execute on function public.arquivos_do_titular(uuid) to service_role;

create function private.perfis_sem_arquivos() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from storage.objects o
             where o.bucket_id = 'entregas' and (storage.foldername(o.name))[1] = old.id::text) then
    raise exception 'arquivos_pendentes: remova os arquivos do titular no Storage antes de apagar a conta'
      using errcode = 'P0001';
  end if;
  return old;
end $$;
revoke all on function private.perfis_sem_arquivos() from public, anon, authenticated;
create trigger perfis_sem_arquivos before delete on public.perfis
  for each row execute function private.perfis_sem_arquivos();

-- Exportacao v2 (art. 15 e 20). Mesmas regras da v1 (f1_12): sem parametros, so o titular logado; sem
-- eventos_stripe; sem ids internos de terceiros (das conexoes e sugestoes sai o status, nao quem e o outro).
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
    'versao', 2,
    'exportado_em', now(),
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
      where c.perfil_id = uid), '[]'::jsonb),
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

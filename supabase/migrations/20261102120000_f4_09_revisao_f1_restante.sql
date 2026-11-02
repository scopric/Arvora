-- Restos da revisao adversarial da F1 local (27/10, secao 6, item 3).

-- 1) EXECUTE: o "revoke ... in schema" da f1_01 nao tira o default global (PUBLIC ganha EXECUTE em toda funcao
--    nova). Sem "in schema" ele sai de vez; daqui para a frente cada funcao precisa de grant explicito.
alter default privileges for role postgres revoke execute on functions from public;

-- Funcoes de gatilho em private que herdaram EXECUTE de PUBLIC. Gatilho nao confere EXECUTE de quem dispara,
-- entao tirar e seguro; o que fica aberto a anon e intencional (tem_acesso, pode_ver_conteudo, fase*).
revoke execute on function private.consentimentos_revogar() from public;
revoke execute on function private.conteudo_comunidade_regras() from public;
revoke execute on function private.denuncias_alvo() from public;
revoke execute on function private.documentos_legais_preencher() from public;
revoke execute on function private.materiais_aula_revisao() from public;
revoke execute on function private.perfis_reaprovar() from public;
revoke execute on function private.progresso_aula_concluir() from public;
revoke execute on function private.set_atualizado_em() from public;

-- 2) Aprovacao de perfil: aprova a versao que o moderador leu (atualizado_em), nao a que estiver no banco no
--    clique. Se o membro editou no meio, perfil_mudou e a tela recarrega.
drop function public.aprovar_perfil_publico(uuid, boolean);
create function public.aprovar_perfil_publico(perfil uuid, versao timestamptz, aprovar boolean default true) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select private.papel_atual()) is null or (select private.papel_atual()) not in ('super_admin', 'moderador') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  -- A versao vai no proprio UPDATE: em READ COMMITTED ele espera a escrita do membro em andamento e reconfere o
  -- WHERE na linha nova. Um EXISTS antes, sozinho, deixaria aprovar a bio gravada no meio do clique.
  update public.perfis
     set publico_aprovado_em = case when aprovar then now() else null end
   where id = perfil and atualizado_em = versao and suspenso_em is null and (not aprovar or visibilidade = 'publico');
  if not found then
    if exists (select 1 from public.perfis where id = perfil and atualizado_em is distinct from versao) then
      raise exception 'perfil_mudou' using errcode = 'P0001';
    end if;
    raise exception 'perfil_nao_aprovavel' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.aprovar_perfil_publico(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.aprovar_perfil_publico(uuid, timestamptz, boolean) to authenticated;

-- 3) Trava aal2 onde so a equipe escreve num comando de tabela mista (membro escreve os outros comandos).
create policy empresas_2fa_apaga on public.empresas as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy pedidos_gdpr_2fa_altera on public.pedidos_gdpr as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2');

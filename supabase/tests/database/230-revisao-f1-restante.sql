-- Restos da revisao da F1 (f4_09): EXECUTE padrao fechado, lista do que anon executa e lista das tabelas
-- em que a equipe escreve sem trava aal2. Uma funcao ou tabela nova fora da lista quebra este teste de proposito:
-- ou ganha a trava, ou entra na lista com o motivo. Transacao desfeita.
begin;
select plan(9);

-- 1) funcao nova nasce sem EXECUTE para PUBLIC, em qualquer schema
create function public.tt_nova_publica() returns int language sql as 'select 1';
create function private.tt_nova_privada() returns int language sql as 'select 1';
select ok(not has_function_privilege('anon', 'public.tt_nova_publica()', 'execute'), 'funcao nova em public: anon sem execute');
select ok(not has_function_privilege('authenticated', 'public.tt_nova_publica()', 'execute'), 'funcao nova em public: authenticated sem execute');
select ok(not has_function_privilege('authenticated', 'private.tt_nova_privada()', 'execute'), 'funcao nova em private: authenticated sem execute');
drop function public.tt_nova_publica();
drop function private.tt_nova_privada();

-- 2) o que anon executa e so isto (usado nas politicas e views publicas)
select is(
  (select array_agg(n.nspname || '.' || p.proname order by n.nspname || '.' || p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')),
  array['public.fase', 'public.fase_edicao', 'public.pode_ver_conteudo', 'public.tem_acesso'],
  'anon executa so as funcoes da lista');

-- 3) escrita da equipe (papel_atual) sem restritiva aal2 no mesmo comando: so tabelas mistas, em que o membro
--    escreve o mesmo comando (a restritiva o bloquearia). Ali o aal2 vem de dentro de papel_atual().
select is(
  (select array_agg(distinct p.tablename || ' ' || p.cmd order by p.tablename || ' ' || p.cmd) from pg_policies p
    where p.schemaname = 'public' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%papel_atual%'
      and not exists (select 1 from pg_policies r where r.schemaname = 'public' and r.tablename = p.tablename
                        and r.permissive = 'RESTRICTIVE' and r.cmd in (p.cmd, 'ALL')
                        and (coalesce(r.qual, '') || coalesce(r.with_check, '')) like '%aal2%')),
  array['consentimentos INSERT', 'consentimentos UPDATE', 'empresas INSERT', 'empresas UPDATE'],
  'escrita da equipe sem trava aal2 so nas tabelas mistas conhecidas');
select ok(exists (select 1 from pg_policies where tablename = 'empresas' and policyname = 'empresas_2fa_apaga' and permissive = 'RESTRICTIVE'),
          'empresas: apagar exige aal2');
select ok(exists (select 1 from pg_policies where tablename = 'pedidos_gdpr' and policyname = 'pedidos_gdpr_2fa_altera' and permissive = 'RESTRICTIVE'),
          'pedidos_gdpr: alterar exige aal2');

-- 4) todo helper chamado numa politica tem EXECUTE para os papeis da politica (com o revoke global, um helper
--    novo sem grant derrubaria a tabela inteira com "permission denied for function").
select is(
  (select array_agg(distinct pol.policyname || ' -> ' || f.proname || ' (' || r.papel || ')'
                    order by pol.policyname || ' -> ' || f.proname || ' (' || r.papel || ')')
     from pg_policies pol
     cross join lateral unnest(pol.roles) r(papel)
     join pg_proc f on (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~ ('\m' || f.proname || '\(')
     join pg_namespace n on n.oid = f.pronamespace and n.nspname in ('public', 'private')
    where pol.schemaname in ('public', 'storage') and r.papel in ('anon', 'authenticated')
      and not has_function_privilege(r.papel, f.oid, 'execute')),
  null,
  'helpers das politicas executaveis pelos papeis da politica');

-- 5) a RPC antiga (sem versao) nao existe mais
select hasnt_function('public', 'aprovar_perfil_publico', array['uuid', 'boolean'], 'aprovar_perfil_publico sem versao foi removida');

select * from finish();
rollback;

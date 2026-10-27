-- F1 assinaturas (PRD 9.1.4): nivel de acesso derivado de assinaturas (uma so fonte de verdade, Erros 1.4).

-- Maior nivel com status vigente e periodo_fim no futuro. uid nulo (sem sessao) = visitante.
-- security definer: le assinaturas sem depender do RLS do chamador. Sem execute para anon/authenticated:
-- so as funcoes publicas abaixo (tambem security definer) a chamam.
create function private.nivel_atual(uid uuid) returns public.nivel_acesso
language sql stable security definer
set search_path = ''
as $$
  select coalesce(max(p.nivel), 'visitante'::public.nivel_acesso)
  from public.assinaturas a
  join public.planos p on p.id = a.plano_id
  where a.perfil_id = uid
    and a.status in ('active', 'trialing', 'past_due')
    and a.periodo_fim > now();
$$;
revoke all on function private.nivel_atual(uuid) from public, anon, authenticated;

-- NAO considera equipe: papel de equipe nao abre Network nem conexoes (PRD 9.1.0).
create function public.tem_acesso(minimo public.nivel_acesso) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select minimo <= (select private.nivel_atual((select auth.uid())));
$$;
revoke all on function public.tem_acesso(public.nivel_acesso) from public;
grant execute on function public.tem_acesso(public.nivel_acesso) to anon, authenticated;

-- Equipe (aal2) ve conteudo; usar SO em aulas, materiais, videos, exercicios e espacos.
create function public.pode_ver_conteudo(minimo public.nivel_acesso) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select public.tem_acesso(minimo)) or (select private.papel_atual()) is not null;
$$;
revoke all on function public.pode_ver_conteudo(public.nivel_acesso) from public;
grant execute on function public.pode_ver_conteudo(public.nivel_acesso) to anon, authenticated;

-- F1 identidade (PRD 9.1): tipos, schema private e privilegios padrao.
-- Tabelas e funcoes novas nascem SEM acesso para anon; o acesso e concedido item a item.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- O Supabase concede tudo a anon e authenticated por padrao; aqui isso acaba. Cada tabela e funcao
-- concede explicitamente o minimo (service_role continua com o padrao: ele ignora o RLS de qualquer forma).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema private revoke execute on functions from anon, authenticated, public;

-- Ordem importa: o RLS compara niveis com <=
create type public.nivel_acesso as enum ('visitante', 'clube', 'grupo');
create type public.papel_equipe as enum ('super_admin', 'editor', 'corretor', 'moderador', 'auditor');
create type public.visibilidade_perfil as enum ('membros', 'publico');

create function private.set_atualizado_em() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

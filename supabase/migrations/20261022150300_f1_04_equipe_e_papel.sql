-- equipe: papel de equipe fora de perfis, para o dono nunca se promover (ADM-08, Erros 1.4).
create table public.equipe (
  perfil_id uuid primary key references public.perfis (id) on delete cascade,
  papel public.papel_equipe not null,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

alter table public.equipe enable row level security;

grant select, insert, update, delete on public.equipe to authenticated;

-- Papel da pessoa logada, ou null se nao for equipe OU se a sessao nao for aal2 (CON-05).
-- Nao confia em user_metadata: le a tabela e o aal do JWT.
create function private.papel_atual() returns public.papel_equipe
language sql stable security definer
set search_path = ''
as $$
  select e.papel
  from public.equipe e
  where e.perfil_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2';
$$;
revoke all on function private.papel_atual() from public, anon;
grant execute on function private.papel_atual() to authenticated;

-- Quem e equipe em qualquer nivel de sessao (so para a propria pessoa saber que precisa do 2FA).
create policy equipe_dono_le on public.equipe for select to authenticated
  using (perfil_id = (select auth.uid()));

create policy equipe_super_admin_le on public.equipe for select to authenticated
  using ((select private.papel_atual()) = 'super_admin');

create policy equipe_super_admin_insere on public.equipe for insert to authenticated
  with check ((select private.papel_atual()) = 'super_admin');

create policy equipe_super_admin_altera on public.equipe for update to authenticated
  using ((select private.papel_atual()) = 'super_admin')
  with check ((select private.papel_atual()) = 'super_admin');

create policy equipe_super_admin_apaga on public.equipe for delete to authenticated
  using ((select private.papel_atual()) = 'super_admin');

-- Restritivas: nenhuma escrita em equipe sem 2FA (aal2), mesmo que outra politica seja afrouxada por engano.
-- A leitura da propria linha continua valendo em aal1, para a tela saber que precisa pedir o 2FA.
create policy equipe_2fa_insere on public.equipe as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
create policy equipe_2fa_altera on public.equipe as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
create policy equipe_2fa_apaga on public.equipe as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

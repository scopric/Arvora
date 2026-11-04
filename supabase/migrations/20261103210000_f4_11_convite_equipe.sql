-- Convite da equipe (função convidar-equipe): o inviteUserByEmail reaproveita conta ainda não confirmada.
-- Se essa conta tem senha, quem se cadastrou com o e-mail alheio entraria com o papel depois do aceite
-- (e confirmar esse cadastro também entrega a conta: a senha é de quem cadastrou).
-- Devolve o id dessa conta (ou null); a função apaga a conta, que nunca entrou (confirmação obrigatória), e convida
-- do zero, sem senha. Só a service_role chama.
create function public.email_cadastro_pendente(p_email text) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where lower(u.email) = lower(p_email)
    and u.email_confirmed_at is null
    and coalesce(u.encrypted_password, '') <> ''
  limit 1;
$$;
revoke all on function public.email_cadastro_pendente(text) from public, anon, authenticated;
grant execute on function public.email_cadastro_pendente(text) to service_role;

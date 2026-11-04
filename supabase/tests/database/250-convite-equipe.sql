-- Convite da equipe (f4_11): email_cadastro_pendente só para a service_role e só acusa cadastro não confirmado com senha.
-- Transacao desfeita. Todos os dados abaixo sao de teste.
begin;
select plan(7);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'cad-pendente@t.test', 'hash-de-teste', null, '{"nome":"A"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'convidado@t.test', '', null, '{"nome":"B"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'confirmado@t.test', 'hash-de-teste', now(), '{"nome":"C"}');

select ok(public.email_cadastro_pendente('CAD-Pendente@t.test'), 'cadastro sem confirmar com senha: pendente (sem caixa)');
select ok(not public.email_cadastro_pendente('convidado@t.test'), 'convite sem senha: não é pendente (reenvio vale)');
select ok(not public.email_cadastro_pendente('confirmado@t.test'), 'conta confirmada: não é pendente');
select ok(not public.email_cadastro_pendente('ninguem@t.test'), 'e-mail sem conta: não é pendente');
select ok(not has_function_privilege('authenticated', 'public.email_cadastro_pendente(text)', 'execute'), 'authenticated não executa');
select ok(not has_function_privilege('anon', 'public.email_cadastro_pendente(text)', 'execute'), 'anon não executa');
select ok(has_function_privilege('service_role', 'public.email_cadastro_pendente(text)', 'execute'), 'service_role executa');

select * from finish();
rollback;

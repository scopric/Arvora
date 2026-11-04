-- Entrar com Google (f4_10): conta sem declaracao de maioridade nasce, mas nao tem nivel nem paga ate declarar.
-- Transacao desfeita. Todos os dados abaixo sao de teste.
begin;
select plan(18);

truncate public.verticais, public.edicoes, public.temas, public.categorias_rede, public.espacos, public.empresas,
  public.documentos_legais, public.planos cascade;
delete from auth.users where email like '%@exemplo.invalid';
delete from public.contas_stripe where stripe_account_id = 'acct_exemplo_local';

create schema tt;
grant usage on schema tt to public;
alter default privileges in schema tt grant execute on functions to public;
create function tt.como(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;

-- a7 = veio do Google (sem maior_18, com full_name), e7 = cadastro por e-mail (com maior_18)
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  (tt.u('a7'), 'a7@t.test', '{"full_name":"Maria Google","email_verified":true}'::jsonb, now()),
  (tt.u('e7'), 'e7@t.test', '{"nome":"X","maior_18":"true"}'::jsonb, now());

select ok((select maior_18_em is null from public.perfis where id = tt.u('a7')), 'conta do Google nasce sem declaracao');
select is((select nome from public.perfis where id = tt.u('a7')), 'Maria Google', 'nome vem do full_name do Google');
select ok((select maior_18_em is not null from public.perfis where id = tt.u('e7')), 'cadastro por e-mail continua com a data');

insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_t_grupo', 'Grupo teste', 'grupo', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe;
-- assinatura ativa de a7 (ex.: criada antes de declarar por outro caminho): sem declaracao, nao vale
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u('a7'), conta_stripe_id, 'sub_a7', id, 'active', now() - interval '1 day', now() + interval '10 days' from public.planos;

select tt.como(tt.u('a7'));
select ok(not public.idade_declarada(), 'idade_declarada = false antes de declarar');
select ok(not public.tem_acesso('clube'), 'sem declaracao nao tem nivel, mesmo com assinatura ativa');
select throws_ok($$select public.registrar_aceite_checkout((select id from public.planos limit 1), 'v1')$$,
                 'P0001', 'maior_18_pendente', 'sem declaracao nao registra aceite de checkout');
select lives_ok($$select public.declarar_maior_18()$$, 'titular declara');
select ok(public.idade_declarada(), 'idade_declarada = true depois');
select ok(public.tem_acesso('grupo'), 'depois de declarar, a assinatura vale');
reset role;

-- a data da primeira declaracao nao muda
update public.perfis set maior_18_em = '2026-01-01' where id = tt.u('a7');
select tt.como(tt.u('a7'));
select public.declarar_maior_18();
reset role;
select is((select maior_18_em from public.perfis where id = tt.u('a7')), '2026-01-01'::timestamptz, 'declarar de novo nao muda a data');

-- anonimo nao chama as funcoes novas
set local role anon;
select throws_ok($$select public.idade_declarada()$$, '42501', null, 'anon nao chama idade_declarada');
select throws_ok($$select public.declarar_maior_18()$$, '42501', null, 'anon nao chama declarar_maior_18');
reset role;

-- "nao tenho 18 anos": so apaga conta sem declaracao, sem assinatura e fora da equipe
insert into auth.users (id, email, raw_user_meta_data) values (tt.u('a8'), 'a8@t.test', '{"full_name":"Menor"}'::jsonb);
select tt.como(tt.u('e7'));
select throws_ok($$select public.excluir_conta_sem_declaracao()$$, '42501', 'conta_nao_elegivel', 'conta que declarou nao usa este caminho');
reset role;
-- b1 = sem declaracao com assinatura, b2 = sem declaracao na equipe, b3 = sem declaracao com cliente Stripe
insert into auth.users (id, email, raw_user_meta_data) values
  (tt.u('b1'), 'b1@t.test', '{}'::jsonb), (tt.u('b2'), 'b2@t.test', '{}'::jsonb), (tt.u('b3'), 'b3@t.test', '{}'::jsonb);
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u('b1'), conta_stripe_id, 'sub_b1', id, 'canceled', now() - interval '1 day', now() from public.planos;
insert into public.equipe (perfil_id, papel) values (tt.u('b2'), 'editor');
insert into public.clientes_stripe (perfil_id, conta_stripe_id, stripe_customer_id, email)
select tt.u('b3'), id, 'cus_b3', 'b3@t.test' from public.contas_stripe;
select tt.como(tt.u('b1'));
select throws_ok($$select public.excluir_conta_sem_declaracao()$$, '42501', 'conta_nao_elegivel', 'conta com assinatura nao usa este caminho');
reset role;
select tt.como(tt.u('b2'));
select throws_ok($$select public.excluir_conta_sem_declaracao()$$, '42501', 'conta_nao_elegivel', 'conta da equipe nao usa este caminho');
reset role;
select tt.como(tt.u('b3'));
select throws_ok($$select public.excluir_conta_sem_declaracao()$$, '42501', 'conta_nao_elegivel', 'conta com cliente Stripe nao usa este caminho');
reset role;
select tt.como(tt.u('a8'));
select lives_ok($$select public.excluir_conta_sem_declaracao()$$, 'conta sem declaracao se apaga');
reset role;
select ok(not exists (select 1 from auth.users where id = tt.u('a8')) and not exists (select 1 from public.perfis where id = tt.u('a8')),
          'conta e perfil sumiram');

select * from finish();
rollback;

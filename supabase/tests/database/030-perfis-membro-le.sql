-- perfis_membro_le (f1_10): membro pagante le perfis de outros membros. Transacao desfeita.
-- Todos os dados abaixo sao de teste.
begin;
select plan(14);

create schema tt;
grant usage on schema tt to public;
create function tt.como(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  set local role authenticated;
end $$;
create function tt.anonimo() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;
create function tt.afeta(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function tt.u(s text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || s)::uuid $$;
create function tt.ve(s text) returns boolean language sql as $$ select exists (select 1 from public.perfis where id = tt.u(s)) $$;

-- a1=clube ativo, b1=perfil alvo (membros), c1=suspenso, e1=clube vencido, ca=cancelado, f1=sem assinatura,
-- 51=super_admin sem assinatura
insert into auth.users (id, email, raw_user_meta_data)
select tt.u(id), id || '@t.test', '{"nome":"X","maior_18":"true"}'::jsonb
from (values ('a1'), ('b1'), ('c1'), ('e1'), ('ca'), ('f1'), ('51')) v(id);
insert into public.equipe (perfil_id, papel) values (tt.u('51'), 'super_admin');
update public.perfis set suspenso_em = now() where id = tt.u('c1');

insert into public.contas_stripe (stripe_account_id, titular, pais) values ('acct_teste', 'Teste', 'IE');
insert into public.planos (conta_stripe_id, stripe_price_id, nome, nivel, intervalo, tipo_receita, valor_centavos, moeda)
select id, 'price_t_clube', 'Clube teste', 'clube', 'mes', 'assinatura', 1, 'EUR' from public.contas_stripe;
insert into public.assinaturas (perfil_id, conta_stripe_id, stripe_subscription_id, plano_id, status, periodo_inicio, periodo_fim)
select tt.u(v.s), p.conta_stripe_id, 'sub_' || v.s, p.id, v.st::public.status_assinatura, now() - interval '10 days', now() + v.fim
from public.planos p, (values ('a1', 'active', interval '10 days'), ('e1', 'active', interval '-1 day'),
                              ('ca', 'canceled', interval '10 days')) v(s, st, fim);

-- membro pagante
select tt.como(tt.u('a1'));
select ok(tt.ve('b1'), 'membro clube le perfil membros de outro');
select ok(not tt.ve('c1'), 'membro nao le perfil suspenso');
select is((select nome from public.perfis where id = tt.u('b1')), 'X', 'membro le colunas liberadas pelo grant');
select throws_ok($$select maior_18_em from public.perfis$$, '42501', null, 'membro nao le maior_18_em de ninguem');
select is((select tt.afeta($q$update public.perfis set nome = 'Hack' where id = tt.u('b1')$q$)), 0,
          'membro nao altera perfil alheio (0 linhas)');
reset role;

-- sem acesso pago
select tt.como(tt.u('f1'));
select ok(not tt.ve('b1'), 'logado sem assinatura nao le perfil membros');
reset role;
select tt.como(tt.u('e1'));
select ok(not tt.ve('b1'), 'assinatura vencida nao le perfil membros');
reset role;
select tt.como(tt.u('ca'));
select ok(not tt.ve('b1'), 'assinatura cancelada nao le perfil membros');
reset role;
select tt.anonimo();
select ok(not tt.ve('b1'), 'anon nao le perfil membros');
reset role;

-- equipe continua lendo pela politica dela (inclusive suspenso)
select tt.como(tt.u('51'), 'aal2');
select ok(tt.ve('b1') and tt.ve('c1'), 'super_admin sem assinatura le perfis pela politica da equipe');
reset role;
select tt.como(tt.u('51'), 'aal1');
select ok(not tt.ve('b1'), 'equipe sem 2FA e sem assinatura nao vira membro');
reset role;

-- suspenso some para o membro tambem com visibilidade publico
update public.perfis set visibilidade = 'publico' where id = tt.u('c1');
select tt.como(tt.u('a1'));
select ok(not tt.ve('c1'), 'perfil publico suspenso tambem some para o membro');
reset role;

-- o membro continua lendo o proprio perfil (uma linha so, sem duplicar por varias politicas)
select tt.como(tt.u('a1'));
select is((select count(*)::int from public.perfis where id = tt.u('a1')), 1, 'membro le o proprio perfil uma vez so');
reset role;

-- perfil publico ainda NAO aprovado: o PRD libera ao membro (visibilidade em membros/publico, sem exigir aprovacao)
update public.perfis set visibilidade = 'publico', publico_aprovado_em = null where id = tt.u('b1');
select tt.como(tt.u('a1'));
select ok(tt.ve('b1'), 'membro le perfil publico ainda nao aprovado (so o visitante exige aprovacao)');
reset role;

select * from finish();
rollback;

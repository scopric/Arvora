-- F1 correcoes da revisao adversarial.
-- setores_id_seq: a f1_02 (ja mesclada, nao editavel) deu usage na sequence a authenticated e comenta que a
-- coluna identity precisa disso. Esta errado: insert em coluna identity nao exige privilegio na sequence
-- (verificado em banco real). O grant so amplia superficie (nextval direto); removido aqui.
revoke usage on sequence public.setores_id_seq from authenticated;

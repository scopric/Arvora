import { useState } from "react"
import { useParams } from "react-router"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AvisoDe, Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirSemDados, useAcao, useCarga } from "../lib/consulta"
import { dataCurta } from "../lib/formato"
import { FINANCEIRO, MODERA, SUPER, usePode } from "../lib/papel"
import { classeLink } from "../lib/estilo"

// Detalhe só leitura (ADM-04). Pagamento: ação no Stripe. Suspender é da moderação (suspender_perfil).
export function Membro() {
  const t = useT()
  const caminho = useCaminho()
  const { id = "" } = useParams()
  const financeiro = usePode(FINANCEIRO)
  const modera = usePode(MODERA)
  const super_ = usePode(SUPER)
  const acao = useAcao()
  const [confirmar, setConfirmar] = useState(false)
  const carga = useCarga(async () => {
    const perfil = exigir(await supabase.from("perfis").select("id, nome, empresa_nome, cidade, pais, bio, visibilidade, suspenso_em, criado_em").eq("id", id).maybeSingle())
    let assinaturas: { id: number; plano_id: number; status: string; periodo_inicio: string; periodo_fim: string; cancela_no_fim: boolean; origem: string }[] = []
    let planos = new Map<number, string>()
    if (financeiro) {
      assinaturas = exigir(await supabase.from("assinaturas").select("id, plano_id, status, periodo_inicio, periodo_fim, cancela_no_fim, origem").eq("perfil_id", id).order("periodo_fim", { ascending: false }))
      if (assinaturas.length) planos = new Map(exigir(await supabase.from("planos").select("id, nome").in("id", assinaturas.map((a) => a.plano_id))).map((p) => [p.id, p.nome]))
    }
    // Só o super_admin lê o ID do cliente no Stripe e o e-mail (lote 2 do banco). Erro aparece: não vira lista vazia.
    const clientes = super_ ? exigir(await supabase.from("clientes_stripe").select("stripe_customer_id, email").eq("perfil_id", id)) : []
    let email: string | null = null
    let emailErro = false
    if (super_) {
      const r = await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: string | null; error: unknown }>)("email_do_membro", { perfil: id })
      if (r.error) emailErro = true
      else email = r.data
    }
    return { perfil, assinaturas, planos, clientes, email, emailErro }
  }, [id, financeiro, super_])

  return (
    <Pagina titulo="admin.membro.titulo" voltar={{ para: caminho("/admin/membros"), rotulo: t("admin.comum.voltar") }}>
      <Mostrar carga={carga}>
        {({ perfil, assinaturas, planos, clientes, email, emailErro }) => (
          <>
            <Cartao>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-titulo-p font-semibold">{perfil.nome}</h2>
                {perfil.suspenso_em ? <Selo tom="alerta">{t("admin.membros.suspenso")}</Selo> : null}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {super_ ? <div><dt className="text-corpo-p text-nevoa">{t("admin.membro.email")}</dt><dd>{emailErro ? <span role="alert" className="text-red-300">{t("admin.membro.emailErro")}</span> : (email ?? "—")}</dd></div> : null}
                <div><dt className="text-corpo-p text-nevoa">{t("admin.membros.empresa")}</dt><dd>{perfil.empresa_nome ?? "—"}</dd></div>
                <div><dt className="text-corpo-p text-nevoa">{t("admin.comum.cidade")}</dt><dd>{[perfil.cidade, perfil.pais].filter(Boolean).join(", ") || "—"}</dd></div>
                <div><dt className="text-corpo-p text-nevoa">{t("admin.membros.visibilidade")}</dt><dd>{t(`admin.membros.vis.${perfil.visibilidade}`)}</dd></div>
                <div><dt className="text-corpo-p text-nevoa">{t("admin.membros.desde")}</dt><dd>{dataCurta(perfil.criado_em)}</dd></div>
              </dl>
              {perfil.bio ? <p className="mt-4 max-w-prose text-base text-bruma">{perfil.bio}</p> : null}
              <div className="mt-4 space-y-3">
                <AvisoDe aviso={acao.aviso} />
                {modera ? <Botao type="button" variante={perfil.suspenso_em ? "contorno" : "perigo"} disabled={acao.ocupado} onClick={() => setConfirmar(true)} className="sm:w-auto">{perfil.suspenso_em ? t("admin.membro.reativar") : t("admin.membro.suspender")}</Botao> : null}
              </div>
            </Cartao>
            {financeiro ? (
              <Secao titulo="admin.membro.assinaturas">
                {assinaturas.length === 0 ? (
                  <Vazio>{t("admin.membro.semAssinaturas")}</Vazio>
                ) : (
                  <Tabela
                    legenda={t("admin.membro.assinaturas")} linhas={assinaturas} id={(a) => a.id}
                    colunas={[
                      { chave: "plano", titulo: t("admin.membros.plano"), celula: (a) => planos.get(a.plano_id) ?? "—" },
                      { chave: "status", titulo: t("admin.comum.status"), celula: (a) => t(`admin.assinatura.${a.status as "active"}`) },
                      { chave: "origem", titulo: t("admin.membro.origem"), celula: (a) => a.origem },
                      { chave: "periodo", titulo: t("admin.membro.periodo"), celula: (a) => `${dataCurta(a.periodo_inicio)} → ${dataCurta(a.periodo_fim)}` },
                      { chave: "cancela", titulo: t("admin.membro.cancelaNoFim"), celula: (a) => (a.cancela_no_fim ? t("admin.comum.sim") : t("admin.comum.nao")) },
                    ]}
                  />
                )}
                <p className="mt-4 text-corpo-p text-nevoa">{t("admin.membro.stripeNota")}</p>
                <ul className="mt-2 space-y-1">
                  {clientes.map((c) => (
                    <li key={c.stripe_customer_id}>
                      <a className={classeLink} href={`https://dashboard.stripe.com/customers/${encodeURIComponent(c.stripe_customer_id)}`} target="_blank" rel="noopener noreferrer">{t("admin.membro.abrirStripe")} ({c.stripe_customer_id})</a>
                    </li>
                  ))}
                </ul>
              </Secao>
            ) : null}
            <DialogoConfirmar
              aberto={confirmar} perigo={!perfil.suspenso_em} titulo={perfil.suspenso_em ? t("admin.membro.reativar") : t("admin.membro.suspender")} texto={t("admin.membro.suspenderTexto")}
              aoCancelar={() => setConfirmar(false)}
              aoConfirmar={() => { setConfirmar(false); void acao.rodar(async () => { exigirSemDados(await supabase.rpc("suspender_perfil", { perfil: perfil.id, suspender: !perfil.suspenso_em })); carga.recarregar() }, "admin.comum.salvo") }}
            />
          </>
        )}
      </Mostrar>
    </Pagina>
  )
}

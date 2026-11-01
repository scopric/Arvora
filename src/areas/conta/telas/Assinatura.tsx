import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { abrirPortal } from "../../../lib/assinatura"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { dataCurta, dinheiro, prazoArrependimento } from "../formato"
import { Pagina, Secao } from "../Pagina"
import { botaoContornoApp, botaoPrimarioApp } from "../../../componentes/botaoEstilo"

type Linha = {
  status: string
  origem: string
  cancela_no_fim: boolean
  periodo_fim: string
  stripe_criada_em: string | null
  criado_em: string
  planos: { nome: string; intervalo: string; valor_centavos: number; moeda: string } | null
}
type Estado = { fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; a: Linha | null }

const VIGENTES = ["active", "trialing", "past_due"]

export function Assinatura() {
  const t = useT()
  const caminho = useCaminho()
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!uid) return
    let ativo = true
    // Filtro por perfil_id explícito: financeiro e super_admin leem todas as assinaturas, e aqui só entra a do titular.
    supabase
      .from("assinaturas")
      .select("status, origem, cancela_no_fim, periodo_fim, stripe_criada_em, criado_em, planos(nome, intervalo, valor_centavos, moeda)")
      .eq("perfil_id", uid)
      .order("periodo_fim", { ascending: false })
      .limit(10)
      .then(
        ({ data, error }) => {
          if (!ativo) return
          // A vigente manda; sem vigente, mostra a mais recente (encerrada).
          setEstado(error || !data ? { fase: "erro" } : { fase: "pronto", a: data.find((l) => VIGENTES.includes(l.status)) ?? data[0] ?? null })
        },
        () => ativo && setEstado({ fase: "erro" }),
      )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])

  return (
    <Pagina titulo="conta.assinatura.titulo">
      {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
      {estado.fase === "erro" ? <Erro aoTentar={() => (setEstado({ fase: "carregando" }), setTentativa(tentativa + 1))}>{t("conta.assinatura.erro")}</Erro> : null}
      {estado.fase === "pronto" && estado.a === null ? (
        <Vazio acao={<Link to={caminho("/planos")} className={botaoPrimarioApp}>{t("conta.assinatura.verPlanos")}</Link>}>
          {t("conta.assinatura.vazio")}
        </Vazio>
      ) : null}
      {estado.fase === "pronto" && estado.a ? <Plano a={estado.a} /> : null}
      {estado.fase === "pronto" ? <DireitoDeCancelar a={estado.a} /> : null}
    </Pagina>
  )
}

// Rótulo, tom do selo e do texto de cada status do Stripe. "Encerrada" só para canceled e incomplete_expired.
function situacao(a: Linha): { selo: Chave; tom: "destaque" | "alerta" | "neutro"; aviso?: Chave; data: Chave } {
  if (a.status === "past_due") return { selo: "conta.assinatura.estado.pendente", tom: "alerta", aviso: "conta.assinatura.pendenteTexto", data: "conta.assinatura.periodoAtual" }
  if (a.status === "incomplete" || a.status === "unpaid") return { selo: "conta.assinatura.estado.naoConcluido", tom: "alerta", aviso: "conta.assinatura.naoConcluidoTexto", data: "conta.assinatura.periodoAtual" }
  if (a.status === "paused") return { selo: "conta.assinatura.estado.pausada", tom: "neutro", data: "conta.assinatura.periodoAtual" }
  if (a.status === "canceled" || a.status === "incomplete_expired") return { selo: "conta.assinatura.estado.encerrada", tom: "neutro", data: "conta.assinatura.encerradaEm" }
  if (a.cancela_no_fim) return { selo: "conta.assinatura.estado.cancelada", tom: "neutro", data: "conta.assinatura.canceladaAte" }
  return { selo: "conta.assinatura.estado.ativa", tom: "destaque", data: a.origem === "manual" ? "conta.assinatura.acessoManual" : "conta.assinatura.proxima" }
}

function Plano({ a }: { a: Linha }) {
  const t = useT()
  const idioma = useIdioma()
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const manual = a.origem === "manual"
  const sit = situacao(a)

  return (
    <Secao titulo={a.planos?.nome ?? t("conta.assinatura.titulo")}>
      {/* Molde Mercury (Plan & Billing): situação, preço e data em células lado a lado; "Gerenciar" abaixo. */}
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-legenda text-nevoa">{t("conta.assinatura.situacao")}</dt>
            <dd className="mt-1"><Selo tom={sit.tom}>{t(sit.selo)}</Selo></dd>
          </div>
          {a.planos && !manual ? (
            <div><dt className="text-legenda text-nevoa">{t("conta.assinatura.valor")}</dt><dd className="mt-0.5 text-corpo-g font-medium">{dinheiro(a.planos.valor_centavos, a.planos.moeda, idioma)} <span className="text-legenda text-nevoa">/ {t(a.planos.intervalo === "ano" ? "conta.assinatura.ano" : "conta.assinatura.mes")}</span></dd></div>
          ) : null}
          <div>
            <dt className="text-legenda text-nevoa">{t(sit.data)}</dt>
            <dd className="mt-0.5 text-corpo-g font-medium tabular-nums"><time dateTime={a.periodo_fim}>{dataCurta(a.periodo_fim, idioma)}</time></dd>
          </div>
        </dl>
      {sit.aviso ? <div className="mt-5"><Aviso tipo="erro">{t(sit.aviso)}</Aviso></div> : null}
      {erro ? <div className="mt-5"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
      {!manual ? (
        <div className="mt-6">
          <Botao
            type="button"
            variante="contorno"
            ocupado={ocupado}
            className="sm:w-auto"
            onClick={async () => {
              setErro(null)
              setOcupado(true)
              const falha = await abrirPortal(idioma)
              setOcupado(false)
              setErro(falha)
            }}
          >
            {t("conta.assinatura.gerenciar")}
          </Botao>
          <p className="mt-2 text-legenda text-nevoa">{t("conta.assinatura.gerenciarAjuda")}</p>
        </div>
      ) : null}
    </Secao>
  )
}

// PROVISÓRIO: validar com o solicitor (Decisão 50; Consumer Rights Act 2022, Parte 5). Texto de cancelamento em 14 dias
// e reembolso é regra comercial do cliente e leitura jurídica do solicitor; não é parecer.
function DireitoDeCancelar({ a }: { a: Linha | null }) {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const vigenteStripe = a !== null && VIGENTES.includes(a.status) && a.origem === "stripe"
  const prazo = vigenteStripe ? prazoArrependimento(a.stripe_criada_em ?? a.criado_em) : null
  return (
    <Secao titulo={t("conta.direito.titulo")}>
      <div className="space-y-3 text-base text-bruma">
        <p>{t("conta.direito.p1")}</p>
        <p>{t("conta.direito.p2")}</p>
        <p>{t("conta.direito.p3")}</p>
        <p>{t("conta.direito.p4")}</p>
        {prazo ? (
          <p className="font-medium text-creme">
            {t(prazo.aberto ? "conta.direito.ate" : "conta.direito.passou")}
            {prazo.aberto ? <> <time dateTime={prazo.fim}>{dataCurta(prazo.fim, idioma)}</time>.</> : null}
          </p>
        ) : null}
      </div>
      <Link to={caminho("/suporte")} className={`mt-5 ${botaoContornoApp}`}>
        {t("conta.direito.suporte")}
      </Link>
    </Secao>
  )
}

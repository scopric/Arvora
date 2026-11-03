import { useEffect, useRef, useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { useCaminho, useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { iniciarCheckoutComAceite } from "../checkout"
import { Pagina, linkContorno, linkPrimario } from "../Pagina"
import { useConsulta } from "../usarConsulta"

type Nivel = "clube" | "grupo"
type Ciclo = "mes" | "ano"
type Plano = { id: number; nivel: string | null; intervalo: string; valor_centavos: number; moeda: string; criado_em: string }

// PROVISÓRIO: o que cada nível inclui segue o deck/PRD (§7, §17.3.5) e precisa da validação do cliente; preço vem só do banco.
const LINHAS: { rotulo: Chave; clube: boolean; grupo: boolean }[] = [
  { rotulo: "publico.planos.linha.biblioteca", clube: true, grupo: true },
  { rotulo: "publico.planos.linha.directory", clube: true, grupo: true },
  { rotulo: "publico.planos.linha.comunidade", clube: true, grupo: true },
  { rotulo: "publico.planos.linha.academy", clube: true, grupo: true },
  { rotulo: "publico.planos.linha.aulas", clube: false, grupo: true },
  { rotulo: "publico.planos.linha.bemEstar", clube: false, grupo: true },
  { rotulo: "publico.planos.linha.network", clube: false, grupo: true },
  { rotulo: "publico.planos.linha.match", clube: false, grupo: true },
]
const BENEFICIOS: Record<Nivel, Chave[]> = {
  clube: ["publico.planos.clube.b1", "publico.planos.clube.b2", "publico.planos.clube.b3"],
  grupo: ["publico.planos.grupo.b1", "publico.planos.grupo.b2", "publico.planos.grupo.b3"],
}
const FAQ: [Chave, Chave][] = [
  ["publico.planos.faq.q1", "publico.planos.faq.a1"],
  ["publico.planos.faq.q2", "publico.planos.faq.a2"],
  ["publico.planos.faq.q3", "publico.planos.faq.a3"],
  ["publico.planos.faq.q4", "publico.planos.faq.a4"],
]

export function Planos() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  useTitulo("publico.planos.titulo")
  const { sessao } = useAuth()
  const acesso = useAcesso()
  const [ciclo, setCiclo] = useState<Ciclo>("mes")
  const [escolhido, setEscolhido] = useState<Plano | null>(null)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const consulta = useConsulta(
    () =>
      supabase
        .from("planos")
        .select("id,nivel,intervalo,valor_centavos,moeda,criado_em")
        .eq("ativo", true)
        .in("nivel", ["clube", "grupo"])
        .in("intervalo", ["mes", "ano"])
        .order("valor_centavos"),
    "planos",
  )

  const planos: Plano[] = consulta.dados ?? []
  const formRef = useRef<HTMLHeadingElement>(null)
  const preco = (p: Plano) =>
    new Intl.NumberFormat(idioma === "pt" ? "pt-BR" : "en-IE", { style: "currency", currency: p.moeda }).format(p.valor_centavos / 100)
  // Dois planos ativos para o mesmo nível e ciclo é erro de cadastro: vale o mais recente, e o aviso aparece só em desenvolvimento.
  const doNivel = (n: Nivel) => planos.filter((p) => p.nivel === n && p.intervalo === ciclo).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]
  useEffect(() => {
    const vistos = new Set<string>()
    for (const p of consulta.dados ?? []) {
      const k = `${p.nivel}/${p.intervalo}`
      if (vistos.has(k) && import.meta.env.DEV) console.warn(`Planos: mais de um plano ativo para ${k}; vale o mais recente.`)
      vistos.add(k)
    }
  }, [consulta.dados])
  // Ao escolher o plano, o foco vai para o formulário do aceite (o título é lido por leitor de tela).
  useEffect(() => {
    if (escolhido) formRef.current?.focus()
  }, [escolhido])

  // Sem planos ou erro de leitura: nunca uma vitrine vazia, e sim o caminho para o suporte (PRD §17.4.1).
  const semPlanos = (
    <Cartao>
      <h2 className="font-titulo text-3xl font-normal">{t("publico.planos.semPlanos.titulo")}</h2>
      <p className="mt-3 max-w-prose text-creme/80">{t("publico.planos.semPlanos.texto")}</p>
      <Link to={caminho("/suporte")} className={`${linkPrimario} mt-6`}>
        {t("publico.planos.falarSuporte")}
      </Link>
    </Cartao>
  )

  function acao(nivel: Nivel, plano: Plano) {
    if (!sessao) {
      return (
        <>
          <Link to={caminho("/cadastro")} className={`${linkPrimario} w-full`}>
            {t(nivel === "clube" ? "publico.planos.assinarClube" : "publico.planos.assinarGrupo")}
          </Link>
          <p className="mt-3 text-sm text-creme/70">
            {t("publico.planos.jaTemConta")}{" "}
            <Link to={caminho("/entrar")} state={{ de: caminho("/planos") }} className="underline decoration-dourado underline-offset-4">
              {t("nav.entrar")}
            </Link>
          </p>
        </>
      )
    }
    if (acesso.carregando) return <Esqueleto linhas={1} />
    if (acesso.erro) return <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
    if (acesso.nivel === nivel) return <Selo tom="destaque">{t("publico.planos.atual")}</Selo>
    // Quem já assina troca de plano pelo portal (Decisão 36): um segundo checkout seria recusado pelo servidor.
    if (acesso.nivel !== "visitante") {
      return (
        <p className="text-sm text-creme/80">
          {t("publico.planos.trocar")}{" "}
          <Link to={caminho("/perfil")} className="underline decoration-dourado underline-offset-4">
            {t("menu.perfil")}
          </Link>
        </p>
      )
    }
    return (
      <Botao aria-controls="aceite" aria-expanded={escolhido?.id === plano.id} onClick={() => (setEscolhido(plano), setErro(null))}>
        {t(nivel === "clube" ? "publico.planos.assinarClube" : "publico.planos.assinarGrupo")}
      </Botao>
    )
  }

  const card = (nivel: Nivel) => {
    const plano = doNivel(nivel)
    return (
      <Cartao key={nivel} className={`flex flex-col ${nivel === "grupo" ? "border-destaque! border-2" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-titulo text-4xl font-normal">{t(nivel === "clube" ? "nivel.clube" : "nivel.grupo")}</h2>
          {nivel === "grupo" ? <Selo tom="destaque">{t("publico.planos.recomendado")}</Selo> : null}
        </div>
        <p className="mt-2 text-creme/80">{t(nivel === "clube" ? "publico.planos.clube.resumo" : "publico.planos.grupo.resumo")}</p>
        <p className="mt-6 font-titulo text-5xl font-bold">
          {plano ? (
            <>
              {preco(plano)}
              <span className="ml-2 font-corpo text-base font-normal text-creme/70">{t(ciclo === "mes" ? "publico.planos.porMes" : "publico.planos.porAno")}</span>
            </>
          ) : (
            <span className="font-corpo text-base font-normal text-creme/70">{t("publico.planos.indisponivel")}</span>
          )}
        </p>
        <ul className="mt-6 flex-1 list-disc space-y-2 pl-5 text-creme/90">
          {BENEFICIOS[nivel].map((c) => (
            <li key={c}>{t(c)}</li>
          ))}
        </ul>
        <div className="mt-8">{plano ? acao(nivel, plano) : null}</div>
      </Cartao>
    )
  }

  async function ir(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!escolhido) return
    const marcou = new FormData(e.currentTarget)
    if (!marcou.get("imediato") || !marcou.get("perda")) return setErro("publico.planos.aceite.falta")
    setErro(null)
    setOcupado(true)
    const falha = await iniciarCheckoutComAceite(escolhido.id, idioma)
    // Sucesso navega para o Stripe; só a falha volta para cá.
    if (falha) {
      setOcupado(false)
      setErro(falha)
    }
  }
  return (
    <Pagina titulo={t("publico.planos.titulo")} apoio={t("publico.planos.apoio")}>
      {consulta.carregando ? (
        <Esqueleto linhas={6} />
      ) : consulta.erro || planos.length === 0 ? (
        semPlanos
      ) : (
        <>
          <fieldset className="mb-8 inline-flex rounded-full border border-creme/20 p-1">
            <legend className="sr-only">{t("publico.planos.ciclo")}</legend>
            {(["mes", "ano"] as const).map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="ciclo" value={c} checked={ciclo === c} onChange={() => (setCiclo(c), setEscolhido(null))} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center rounded-full px-6 font-semibold peer-checked:bg-creme peer-checked:text-fundo peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dourado">
                  {t(c === "mes" ? "publico.planos.mensal" : "publico.planos.anual")}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-6 md:grid-cols-2">{card("clube")}{card("grupo")}</div>
          {/* PROVISÓRIO: texto do IVA a validar (Stripe Tax, ASS-06) */}
          <p className="mt-4 text-sm text-creme/70">{t("publico.planos.vat")}</p>

          {escolhido ? (
            <form key={escolhido.id} id="aceite" onSubmit={ir} noValidate aria-labelledby="aceite-titulo" className="mt-10 space-y-5 rounded-2xl border border-creme/20 p-6">
              <h2 id="aceite-titulo" ref={formRef} tabIndex={-1} className="font-titulo text-3xl font-normal outline-none">
                {t("publico.planos.aceite.titulo")}
              </h2>
              <p className="text-creme/80">
                {escolhido.nivel === "clube" ? t("nivel.clube") : t("nivel.grupo")} · {preco(escolhido)}{" "}
                {t(escolhido.intervalo === "ano" ? "publico.planos.porAno" : "publico.planos.porMes")}
              </p>
              {/* PROVISÓRIO: validar com o solicitor (ASS-10, Decisão 50). Mudou o texto? Mude VERSAO_ACEITE em checkout.ts. */}
              <label className="flex items-start gap-3">
                <input type="checkbox" name="imediato" className="mt-1 size-5 shrink-0 accent-dourado" />
                <span>{t("publico.planos.aceite.imediato")}</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="perda" className="mt-1 size-5 shrink-0 accent-dourado" />
                <span>{t("publico.planos.aceite.perda")}</span>
              </label>
              <p className="text-sm text-creme/70">
                {t("publico.planos.aceite.termos")}{" "}
                <Link to={caminho("/termos")} className="underline decoration-dourado underline-offset-4">
                  {t("publico.termos.titulo")}
                </Link>
                .
              </p>
              {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Botao type="submit" ocupado={ocupado} className="sm:w-auto">
                  {t("publico.planos.aceite.continuar")}
                </Botao>
                <button type="button" onClick={() => (setEscolhido(null), setErro(null))} className={`${linkContorno} sm:w-auto`}>
                  {t("comum.cancelar")}
                </button>
              </div>
            </form>
          ) : null}

          <section aria-labelledby="comparar" className="mt-16">
            <h2 id="comparar" className="mb-4 font-titulo text-3xl font-normal">
              {t("publico.planos.comparar")}
            </h2>
            <Tabela
              legenda={t("publico.planos.comparar")}
              id={(l) => l.rotulo}
              linhas={LINHAS}
              colunas={[
                { chave: "item", titulo: t("publico.planos.colItem"), celula: (l) => t(l.rotulo) },
                { chave: "clube", titulo: t("nivel.clube"), celula: (l) => t(l.clube ? "publico.planos.sim" : "publico.planos.nao") },
                { chave: "grupo", titulo: t("nivel.grupo"), celula: (l) => t(l.grupo ? "publico.planos.sim" : "publico.planos.nao") },
              ]}
            />
          </section>
        </>
      )}

      <section aria-labelledby="faq" className="mt-16">
        <h2 id="faq" className="mb-4 font-titulo text-3xl font-normal">
          {t("publico.planos.faq.titulo")}
        </h2>
        <div className="max-w-3xl divide-y divide-creme/15 border-y border-creme/15">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">{t(q)}</summary>
              <p className="mt-2 max-w-prose text-creme/80">{t(a)}</p>
            </details>
          ))}
        </div>
      </section>
    </Pagina>
  )
}

import { useEffect } from "react"
import { Link, useLocation } from "react-router"
import { Cena } from "../componentes/Cena"
import { botaoPublico as botao, linkPublico, RodapePublico, TopoPublico } from "../componentes/LayoutPublico"
import { useCaminho, useT, useTitulo } from "../i18n"
import { useAuth } from "../lib/sessao"

const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as React.CSSProperties
const FRENTES = [1, 2, 3, 4] as const
const PORTAS = [1, 2, 3] as const
const ghost = `${botao} border border-superficie text-creme hover:border-destaque`
const primario = `${botao} bg-destaque text-fundo hover:shadow-brilho`
const eyebrow = "font-mono text-xs tracking-[0.08em] uppercase"

// Para onde cada frente leva. Hall of Fame é pré-renderizado fora do app: <a> comum.
const DESTINO: Record<number, string> = { 1: "/awards", 2: "/biblioteca", 3: "/biblioteca", 4: "/planos" }
// Sobre creme o anel de foco em sálvia não passa de 3:1 (WCAG 1.4.11): anel escuro.
const escuro = `${botao.replace("focus-visible:outline-destaque", "focus-visible:outline-fundo")} bg-fundo text-creme hover:shadow-brilho`
// Frases gigantes: acompanham a largura no celular e só viram display a partir de 1280 px (inglês mais longo cabia mal a 1024).
const frase = "font-titulo text-[clamp(2.25rem,11vw,3.4375rem)] font-normal text-balance xl:text-display"

// Cartão-amostra: um trecho da interface da plataforma flutuando ao lado da frase (no lugar de foto).
type ChaveAmostra = `${(typeof FRENTES)[number]}${"a" | "b"}`
function Amostra({ chave, ouro = false, className = "" }: { chave: ChaveAmostra; ouro?: boolean; className?: string }) {
  const t = useT()
  return (
    <div
      aria-hidden="true"
      className={`revela w-64 rounded-xl border border-superficie bg-painel p-5 ${className}`}
    >
      <p className={`${eyebrow} ${ouro ? "text-dourado" : "text-destaque"}`}>{t(`home.amostra.${chave}.rotulo`)}</p>
      <p className="mt-3 text-lg leading-snug font-medium text-creme">{t(`home.amostra.${chave}.texto`)}</p>
      <span className={`mt-5 block h-px w-10 ${ouro ? "bg-dourado/60" : "bg-destaque/60"}`} />
    </div>
  )
}

// Uma frente = uma frase gigante atravessando a tela, com dois cartões-amostra em volta; o alinhamento alterna.
function Frente({ n }: { n: (typeof FRENTES)[number] }) {
  const t = useT()
  const caminho = useCaminho()
  const par = n % 2 === 0
  const ouro = n === 1
  const destino = caminho(DESTINO[n])
  const classeLink = `${ghost} mt-10 ${ouro ? "border-dourado/60 hover:border-dourado" : ""}`
  return (
    <section
      id={`frente-${n}`}
      aria-labelledby={`frente-${n}-t`}
      className="relative isolate scroll-mt-20 overflow-clip px-6 py-[6.25rem] sm:px-16 lg:flex lg:min-h-[80svh] lg:items-center lg:px-24"
    >
      {/* Forma orgânica desfocada atrás dos cartões (imagem do estilo-base), do lado oposto à frase. */}
      <div
        aria-hidden="true"
        className={`absolute top-1/2 -z-10 size-[36rem] -translate-y-1/2 rounded-full blur-3xl ${par ? "-left-40 bg-superficie/30" : "-right-40 bg-destaque/10"}`}
      />
      <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className={`revela lg:col-span-7 ${par ? "lg:col-start-6 lg:row-start-1 lg:text-right" : ""}`}>
          <p className={`${eyebrow} ${ouro ? "text-dourado" : "text-destaque"}`}>
            0{n} · {t(`home.pilar.${n}.nome`)}
          </p>
          <h2 id={`frente-${n}-t`} className={`mt-6 ${frase}`}>
            {t(`home.frente.${n}.frase`)}
          </h2>
          <p className={`mt-8 max-w-lg text-xl leading-normal text-creme/70 ${par ? "lg:ml-auto" : ""}`}>{t(`home.frente.${n}.apoio`)}</p>
          {n === 1 ? (
            <a href={destino} className={classeLink}>{t("home.frente.ver")}</a>
          ) : (
            <Link to={destino} className={classeLink}>{t("home.frente.ver")}</Link>
          )}
        </div>
        <div
          className={`mt-12 flex flex-wrap gap-4 lg:col-span-5 lg:mt-0 lg:flex-col ${par ? "lg:col-start-1 lg:row-start-1 lg:items-start" : "lg:items-end"}`}
        >
          <Amostra chave={`${n}a` as const} ouro={ouro} className="lg:translate-y-8" />
          <Amostra chave={`${n}b` as const} ouro={ouro} className={par ? "lg:translate-x-16" : "lg:-translate-x-16"} />
        </div>
      </div>
    </section>
  )
}

export function EmBreve() {
  const { sessao, carregando } = useAuth()
  const t = useT()
  useTitulo("doc.titulo")
  const caminho = useCaminho()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  // Botão principal sempre montado: a altura não muda quando a sessão termina de carregar (CLS).
  const chamada = carregando ? (
    <span aria-hidden="true" className={`${botao} invisible`}>{t("nav.criarConta")}</span>
  ) : sessao ? (
    <Link to={caminho("/perfil")} className={primario}>{t("nav.perfil")}</Link>
  ) : (
    <Link to={caminho("/cadastro")} className={primario}>{t("nav.criarConta")}</Link>
  )
  return (
    <div>
      <TopoPublico />
      <main>
      <section className="relative isolate flex min-h-[calc(100dvh-4.25rem)] flex-col justify-center overflow-hidden px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div aria-hidden="true" className="absolute -top-1/4 right-0 -z-20 size-[48rem] rounded-full bg-superficie/30 blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-1/4 left-1/3 -z-20 size-[32rem] rounded-full bg-destaque/10 blur-3xl" />
        <Cena cheia className="inset-0 -z-10" classeCanvas="cena-fade-base max-lg:opacity-25" />
        {/* A largura em ch fica no h1 (o ch do wrapper seria o da fonte do corpo); o wrapper encolhe ao conteúdo. */}
        <div className="zona-limpa self-start">
          <p className={`animate-subir ${eyebrow} text-destaque`} style={atraso(0)}>
            {t("inicio.embreve")}
          </p>
          <h1
            className="animate-subir mt-6 max-w-[13ch] font-titulo text-h2 font-normal text-balance lg:max-w-[14ch] lg:text-display"
            style={atraso(100)}
          >
            {t("auth.layout.destaque")}
          </h1>
          <p className="animate-subir mt-8 max-w-lg text-xl leading-normal text-creme/70" style={atraso(240)}>
            {t("inicio.descricao")}
          </p>
          <div className="animate-subir mt-10 flex flex-wrap gap-3" style={atraso(360)}>
            {chamada}
            <a href="#frente-1" className={ghost}>{t("home.saiba")}</a>
          </div>
        </div>
      </section>

      {/* Manifesto: uma frente por tela, frase gigante e cartões-amostra flutuando (direção Patreon, Decisão 58). */}
      {FRENTES.map((n) => <Frente key={n} n={n} />)}

      {/* Duas portas, em creme (PRD §17.5.1): três passos numerados, um botão cada. */}
      <section aria-labelledby="portas" className="bg-creme px-6 py-[6.25rem] text-fundo sm:px-16 lg:px-24">
        <div className="mx-auto max-w-6xl">
          <h2 id="portas" className="max-w-3xl font-titulo text-h3 font-normal text-balance lg:text-h2">{t("home.funil.titulo")}</h2>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-10">
            {PORTAS.map((n) => (
              <li key={n} className="revela relative flex flex-col rounded-xl border border-fundo/15 bg-white/40 p-8">
                <span aria-hidden="true" className="font-titulo text-h2 leading-none">0{n}</span>
                <h3 className="mt-8 text-2xl font-medium">{t(`home.portas.${n}.nome`)}</h3>
                <p className="mt-3 grow text-fundo/70">{t(`home.portas.${n}.texto`)}</p>
                {n === 1 ? (
                  <a href={caminho("/hall-of-fame")} className={`${escuro} mt-8 self-start`}>{t("home.portas.1.acao")}</a>
                ) : (
                  <Link to={caminho("/planos")} className={`${escuro} mt-8 self-start`}>{t(`home.portas.${n}.acao`)}</Link>
                )}
                {n < 3 ? (
                  <span aria-hidden="true" className="absolute top-1/2 -right-8 hidden -translate-y-1/2 text-3xl text-fundo/40 lg:block">→</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Hall of Fame: a única faixa dourada fora do Brazilian Awards (Decisão 13). Sem cartões até haver premiados reais. */}
      <section aria-labelledby="hof" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto max-w-6xl border-t border-dourado/40 pt-12 lg:grid lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} text-dourado`}>{t("home.pilar.1.nome")}</p>
            <h2 id="hof" className={`mt-6 ${frase}`}>{t("home.hof.titulo")}</h2>
          </div>
          <div className="mt-8 lg:col-span-5 lg:mt-0">
            <p className="max-w-md text-xl leading-normal text-creme/70">{t("home.hof.texto")}</p>
            <a href={caminho("/hall-of-fame")} className={`${ghost} mt-8 border-dourado/60 hover:border-dourado`}>{t("home.hof.ver")}</a>
          </div>
        </div>
      </section>

      {/* Como funciona uma aula, em creme: frase à direita e os quatro materiais em linha. */}
      <section aria-labelledby="aula" className="bg-creme px-6 py-[6.25rem] text-fundo sm:px-16 lg:px-24">
        <div className="mx-auto max-w-6xl">
          <h2 id="aula" className="ml-auto max-w-3xl font-titulo text-h3 font-normal text-balance lg:text-right lg:text-h2">{t("home.aula.titulo")}</h2>
          <p className="mt-6 ml-auto max-w-lg text-xl leading-normal text-fundo/70 lg:text-right">{t("home.aula.apoio")}</p>
          <ol className="mt-14 grid gap-px overflow-clip rounded-xl border border-fundo/15 bg-fundo/15 sm:grid-cols-2 lg:grid-cols-4">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n} className="revela bg-creme p-6 lg:p-8">
                <span aria-hidden="true" className="font-titulo text-h3 leading-none">0{n}</span>
                <p className="mt-8 text-lg font-medium">{t(`home.aula.${n}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ em cartões escuros (MasterClass). */}
      <section aria-labelledby="faq" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 id="faq" className="font-titulo text-h3 font-normal text-balance lg:text-h2">{t("home.faq.titulo")}</h2>
          <div className="grid gap-3">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <details key={n} className="group rounded-xl border border-superficie bg-painel px-6 py-2 transition-shadow open:shadow-brilho">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 text-xl font-medium text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque [&::-webkit-details-marker]:hidden">
                  {t(`home.faq.${n}.p`)}
                  <span aria-hidden="true" className="text-2xl text-destaque transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-xl pb-4 text-creme/70">{t(`home.faq.${n}.r`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Chamada final: cartão centrado sobre as formas de luz (Patreon: cartão sobre imagem). */}
      <section className="relative isolate overflow-hidden px-6 py-32 sm:px-16 lg:px-24">
        <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-destaque/15 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-20 bottom-0 -z-10 size-[28rem] rounded-full bg-superficie/40 blur-3xl" />
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-superficie bg-painel/95 p-10 text-center shadow-brilho">
          <h2 className="font-titulo text-h3 font-normal text-balance">{t("home.cta.titulo")}</h2>
          <p className="mt-4 text-creme/70">{t("home.cta.apoio")}</p>
          <div className="mt-8 flex flex-col items-center gap-2">
            {chamada}
            {/* Segunda linha sempre presente (sem salto de layout ao carregar a sessão). */}
            {!carregando && !sessao ? (
              <Link to={caminho("/entrar")} className={linkPublico}>{t("nav.entrar")}</Link>
            ) : (
              <span aria-hidden="true" className={`${linkPublico} invisible`}>{t("nav.entrar")}</span>
            )}
          </div>
        </div>
      </section>
      </main>
      <RodapePublico />
    </div>
  )
}

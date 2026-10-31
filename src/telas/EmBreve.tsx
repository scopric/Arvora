import { useState } from "react"
import { Link } from "react-router"
import { Cena } from "../componentes/Cena"
import { Marca } from "../componentes/Marca"
import { SeletorIdioma } from "../componentes/SeletorIdioma"
import { useCaminho, useT, useTitulo } from "../i18n"
import { useAuth } from "../lib/sessao"

const link =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-creme transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const botao =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-7 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as React.CSSProperties
const PILARES = [1, 2, 3, 4] as const

// Anéis do tronco: um por frente; o do item sob o ponteiro acende. O primeiro é dourado (Brazilian Awards).
function Aneis({ ativo }: { ativo: number }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className="size-full">
      {PILARES.map((n) => (
        <circle
          key={n}
          cx="100"
          cy="100"
          r={100 - n * 20}
          fill="none"
          strokeWidth={ativo === n ? 3 : 1.2}
          className={`transition-all duration-300 ${n === 1 ? "stroke-dourado" : "stroke-destaque"}`}
          opacity={ativo === 0 || ativo === n ? 1 : 0.35}
        />
      ))}
    </svg>
  )
}

export function EmBreve() {
  const { sessao, carregando } = useAuth()
  const t = useT()
  useTitulo("doc.titulo")
  const caminho = useCaminho()
  const [ativo, setAtivo] = useState(0)
  return (
    <div>
      <header className="sticky top-0 z-20 flex min-h-17 items-center justify-between gap-3 border-b border-creme/10 bg-fundo/75 px-4 backdrop-blur-md sm:px-12 lg:px-20">
        <Marca to={caminho("/")} className="max-sm:[&>span]:hidden" />
        <nav aria-label={t("nav.principal")} className="flex items-center gap-2 text-sm font-semibold">
          <SeletorIdioma />
          {carregando ? null : sessao ? (
            <Link to={caminho("/perfil")} className={link}>{t("nav.perfil")}</Link>
          ) : (
            <>
              <Link to={caminho("/entrar")} className={link}>{t("nav.entrar")}</Link>
              <Link to={caminho("/cadastro")} className={`${botao} min-h-11 bg-creme px-5 text-sm whitespace-nowrap text-fundo hover:bg-white max-sm:hidden`}>{t("nav.criarConta")}</Link>
            </>
          )}
        </nav>
      </header>
      <main>
      <section className="relative isolate flex min-h-[calc(100dvh-4.25rem)] flex-col justify-center overflow-hidden px-6 py-16 sm:px-16 lg:px-24">
        <Cena className="inset-0 -z-10 opacity-45 lg:left-[38%] lg:opacity-100" />
        <p className="animate-subir font-mono text-xs font-semibold tracking-[0.3em] text-destaque uppercase" style={atraso(0)}>
          {t("inicio.embreve")}
        </p>
        <h1
          className="animate-subir mt-6 max-w-[12ch] font-titulo text-[clamp(3.4rem,8.5vw,7rem)] leading-[0.9] font-bold tracking-tight text-balance uppercase lg:max-w-[10ch]"
          style={atraso(100)}
        >
          {t("auth.layout.destaque")}
        </h1>
        <p className="animate-subir mt-8 max-w-lg text-lg leading-relaxed text-creme/80" style={atraso(240)}>
          {t("inicio.descricao")}
        </p>
        {!carregando && !sessao && (
          <div className="animate-subir mt-10 flex flex-wrap gap-3" style={atraso(360)}>
            <Link to={caminho("/cadastro")} className={`${botao} bg-creme text-fundo hover:bg-white`}>{t("nav.criarConta")}</Link>
            <a href="#pilares" className={`${botao} border border-creme/30 text-creme hover:border-creme/60`}>{t("home.saiba")}</a>
          </div>
        )}
      </section>

      <section aria-labelledby="pilares" className="px-6 py-24 sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="pilares" className="font-titulo text-5xl leading-[0.95] font-bold text-balance uppercase sm:text-6xl">
              {t("home.pilares.titulo")}
            </h2>
            <div className="mt-8 size-40 sm:size-56"><Aneis ativo={ativo} /></div>
          </div>
          <ol className="divide-y divide-creme/15 border-y border-creme/15">
            {PILARES.map((n) => (
              <li
                key={n}
                onPointerEnter={() => setAtivo(n)}
                onPointerLeave={() => setAtivo(0)}
                className="revela grid grid-cols-[3.5rem_1fr] gap-4 py-8"
              >
                <span aria-hidden="true" className={`font-mono text-sm ${n === 1 ? "text-dourado" : "text-destaque"}`}>0{n}</span>
                <div>
                  <h3 className="font-titulo text-4xl leading-none font-bold uppercase sm:text-5xl">{t(`home.pilar.${n}.nome`)}</h3>
                  <p className="mt-3 max-w-md text-creme/75">{t(`home.pilar.${n}.texto`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {!carregando && !sessao && (
        <section className="px-6 pt-8 pb-32 sm:px-16 lg:px-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 border-t border-dourado/60 pt-12">
            <h2 className="max-w-3xl font-titulo text-5xl leading-[0.95] font-bold text-balance uppercase sm:text-7xl">{t("home.cta.titulo")}</h2>
            <Link to={caminho("/cadastro")} className={`${botao} bg-creme text-fundo hover:bg-white`}>{t("nav.criarConta")}</Link>
          </div>
        </section>
      )}
      </main>
    </div>
  )
}

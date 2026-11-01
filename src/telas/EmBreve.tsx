import { useState } from "react"
import { Link } from "react-router"
import { Cena } from "../componentes/Cena"
import { botaoPublico as botao, RodapePublico, TopoPublico } from "../componentes/LayoutPublico"
import { useCaminho, useT, useTitulo } from "../i18n"
import { useAuth } from "../lib/sessao"

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
      <TopoPublico />
      <main>
      <section className="relative isolate flex min-h-[calc(100dvh-4.25rem)] flex-col justify-center overflow-hidden px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div aria-hidden="true" className="absolute -top-1/4 right-0 -z-20 size-[48rem] rounded-full bg-superficie/30 blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-0 left-1/3 -z-20 size-[32rem] rounded-full bg-destaque/10 blur-3xl" />
        <Cena cheia className="inset-0 -z-10" classeCanvas="max-lg:opacity-25" />
        {/* A largura em ch fica no h1 (o ch do wrapper seria o da fonte do corpo); o wrapper encolhe ao conteúdo. */}
        <div className="zona-limpa self-start">
          <p className="animate-subir font-mono text-xs tracking-[0.08em] text-destaque uppercase" style={atraso(0)}>
            {t("inicio.embreve")}
          </p>
          <h1
            className="animate-subir mt-6 max-w-[13ch] font-titulo text-h2 font-normal text-balance lg:max-w-[14ch] lg:text-display"
            style={atraso(100)}
          >
            {t("auth.layout.destaque")}
          </h1>
          <p className="animate-subir mt-8 max-w-lg text-xl text-creme/70" style={atraso(240)}>
            {t("inicio.descricao")}
          </p>
          {!carregando && !sessao && (
            <div className="animate-subir mt-10 flex flex-wrap gap-3" style={atraso(360)}>
              <Link to={caminho("/cadastro")} className={`${botao} bg-destaque text-fundo hover:shadow-brilho`}>{t("nav.criarConta")}</Link>
              <a href="#pilares" className={`${botao} border border-superficie text-creme hover:border-destaque`}>{t("home.saiba")}</a>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="pilares" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1.6fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="pilares" className="scroll-mt-24 font-titulo text-h3 font-normal text-balance lg:text-h2">
              {t("home.pilares.titulo")}
            </h2>
            <div className="mt-8 size-40 sm:size-56"><Aneis ativo={ativo} /></div>
          </div>
          <ol className="divide-y divide-superficie border-y border-superficie">
            {PILARES.map((n) => (
              <li
                key={n}
                onPointerEnter={() => setAtivo(n)}
                onPointerLeave={() => setAtivo(0)}
                className="revela grid grid-cols-[3.5rem_1fr] gap-4 py-6"
              >
                <span aria-hidden="true" className={`font-mono text-sm ${n === 1 ? "text-dourado" : "text-destaque"}`}>0{n}</span>
                <div>
                  <h3 className="font-titulo text-h3 font-normal">{t(`home.pilar.${n}.nome`)}</h3>
                  <p className="mt-3 max-w-md text-creme/70">{t(`home.pilar.${n}.texto`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="funil" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto max-w-6xl">
          <h2 id="funil" className="max-w-3xl font-titulo text-h3 font-normal text-balance lg:text-h2">{t("home.funil.titulo")}</h2>
          <ol className="relative mt-14 grid gap-10 border-l border-superficie pl-8 md:grid-cols-3 md:gap-8 md:border-t md:border-l-0 md:pt-10 md:pl-0">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="revela relative">
                <span aria-hidden="true" className="absolute top-1.5 -left-[2.4rem] size-3 rounded-full bg-destaque shadow-brilho md:-top-[2.9rem] md:left-0" />
                <p aria-hidden="true" className="font-mono text-sm text-destaque">0{n}</p>
                <h3 className="mt-2 font-titulo text-h3 font-normal">{t(`home.funil.${n}.nome`)}</h3>
                <p className="mt-3 max-w-xs text-creme/70">{t(`home.funil.${n}.texto`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="aula" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl gap-6 rounded-xl border border-superficie bg-painel p-6 shadow-brilho sm:p-14 lg:grid-cols-2">
          <h2 id="aula" className="font-titulo text-h3 font-normal text-balance lg:text-h2">{t("home.aula.titulo")}</h2>
          <ol className="grid gap-6 sm:grid-cols-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n} className="revela flex min-h-28 flex-col justify-between rounded-xl border border-superficie bg-fundo p-6">
                <span aria-hidden="true" className="font-mono text-sm text-destaque">0{n}</span>
                <span className="text-lg font-semibold">{t(`home.aula.${n}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="faq" className="px-6 py-[6.25rem] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_2fr]">
          <h2 id="faq" className="font-titulo text-h3 font-normal text-balance lg:text-h2">{t("home.faq.titulo")}</h2>
          <div className="divide-y divide-superficie border-y border-superficie">
            {([1, 2, 3] as const).map((n) => (
              <details key={n} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-xl font-medium text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque [&::-webkit-details-marker]:hidden">
                  {t(`home.faq.${n}.p`)}
                  <span aria-hidden="true" className="text-2xl text-destaque transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-xl text-creme/70">{t(`home.faq.${n}.r`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {!carregando && !sessao && (
        <section className="px-6 pt-8 pb-32 sm:px-16 lg:px-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 border-t border-superficie pt-12">
            <h2 className="max-w-3xl font-titulo text-h3 font-normal text-balance sm:text-h2">{t("home.cta.titulo")}</h2>
            <Link to={caminho("/cadastro")} className={`${botao} bg-destaque text-fundo hover:shadow-brilho`}>{t("nav.criarConta")}</Link>
          </div>
        </section>
      )}
      </main>
      <RodapePublico />
    </div>
  )
}

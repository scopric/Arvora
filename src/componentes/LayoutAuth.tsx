import type { ReactNode } from "react"
import { useCaminho, useT } from "../i18n"
import { Cena } from "./Cena"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"

// Estrutura MasterClass (dois painéis, título grande, contorno fino, sem sombra) com as cores da Árvora (Decisão 13).
export function LayoutAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  const caminho = useCaminho()
  const t = useT()
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <SeletorIdioma className="absolute top-4 right-4 z-10 sm:right-12" />
      <aside className="relative isolate hidden overflow-hidden px-16 py-16 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/4 -left-1/4 -z-10 size-[50rem] rounded-full bg-superficie/25 blur-3xl"
        />
        <Cena className="inset-x-0 top-10 bottom-[52%] -z-10" />
        <Marca to={caminho("/")} />
        <div>
          <span aria-hidden="true" className="mb-8 block h-px w-16 bg-dourado" />
          <p className="max-w-md font-titulo text-6xl leading-[0.92] font-bold tracking-tight text-balance uppercase">
            {t("auth.layout.destaque")}
          </p>
        </div>
        <p className="max-w-sm text-sm text-creme/60">
          {t("auth.layout.apoio")}
        </p>
      </aside>

      <main className="flex items-center justify-center bg-painel px-6 pt-20 pb-12 sm:px-12 lg:py-12">
        <div className="w-full max-w-md">
          <Marca to={caminho("/")} className="mb-10 lg:hidden" />
          <h1 className="font-titulo text-5xl leading-none font-bold uppercase">{titulo}</h1>
          <p className="mt-3 text-creme/70">{subtitulo}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

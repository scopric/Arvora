import { useT, useTitulo, type Chave } from "../i18n"

// Tela provisória de cada rota. Quem entrega a tela troca o element da rota em src/areas/<area>/rotas.tsx.
export function EmConstrucao({ titulo }: { titulo: Chave }) {
  const t = useT()
  useTitulo(titulo, true)
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-titulo text-4xl leading-none font-normal text-balance sm:text-5xl">{t(titulo)}</h1>
      <p className="mt-4 opacity-75">{t("comum.emConstrucao")}</p>
    </div>
  )
}

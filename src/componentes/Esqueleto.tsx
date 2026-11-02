import { useT } from "../i18n"
import { useApp } from "./escopo"

// Carregamento por bloco cinza pulsante, nunca spinner solto. `linhas` = quantas barras; o texto para leitor de tela é um só.
export function Esqueleto({ linhas = 3, className = "" }: { linhas?: number; className?: string }) {
  const t = useT()
  const barra = useApp() ? "h-4 animate-pulse rounded-sm bg-fumaca/60 motion-reduce:animate-none" : "h-5 animate-pulse rounded-lg bg-current/15 motion-reduce:animate-none"
  return (
    <div role="status" aria-busy="true" aria-label={t("comum.carregandoConteudo")} className={`space-y-3 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} aria-hidden="true" className={`${barra} ${i === linhas - 1 && linhas > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  )
}

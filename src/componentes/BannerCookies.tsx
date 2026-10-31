import { useEffect, useRef, useSyncExternalStore } from "react"
import { textosDe, useIdiomaUrl } from "../i18n"
import { aoMudarConsentimento, gravarConsentimento, lerConsentimento, type Escolha } from "../lib/consentimento"
import { Botao } from "./Botao"

// Vive no layout raiz (cobre também as páginas pré-renderizadas); idioma pela URL.
// Só no cliente: no servidor/hidratação o snapshot é false, então o HTML não diverge.
// Textos (cookies.*) PROVISÓRIOS: a validar pelo cliente/solicitor.
export function BannerCookies() {
  const idioma = useIdiomaUrl()
  const t = textosDe(idioma)
  const visivel = useSyncExternalStore(aoMudarConsentimento, () => lerConsentimento() === null, () => false)
  const ref = useRef<HTMLElement>(null)

  // Reserva espaço no fim da página para o banner fixo não cobrir botões de formulário.
  useEffect(() => {
    if (!visivel || !ref.current) return
    document.body.style.paddingBottom = `${ref.current.offsetHeight}px`
    return () => {
      document.body.style.paddingBottom = ""
    }
  }, [visivel, idioma])

  if (!visivel) return null
  const escolher = (e: Escolha) => gravarConsentimento(e)

  return (
    <section
      ref={ref}
      aria-labelledby="cookies-titulo"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-creme/20 bg-fundo p-4 text-creme shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p id="cookies-titulo" className="font-semibold">{t["cookies.titulo"]}</p>
          <p>
            {t["cookies.texto"]}{" "}
            <a href={`/${idioma}/cookies`} className="underline">{t["cookies.politica"]}</a>
          </p>
        </div>
        <div className="flex gap-3 sm:w-72">
          <Botao variante="contorno" onClick={() => escolher("recusado")}>{t["cookies.recusar"]}</Botao>
          <Botao variante="contorno" onClick={() => escolher("aceito")}>{t["cookies.aceitar"]}</Botao>
        </div>
      </div>
    </section>
  )
}

import { Botao } from "../componentes/Botao"
import { useCaminho, useT, useTitulo } from "../i18n"
import { limparConsentimento } from "../lib/consentimento"

// Textos PROVISÓRIOS: a validar pelo cliente/solicitor.
export function Cookies() {
  const t = useT()
  const caminho = useCaminho()
  useTitulo("titulo.cookies")
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">{t("cookies.pag.titulo")}</h1>
      <h2 className="mt-8 font-semibold">{t("cookies.pag.guardado")}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{t("cookies.pag.idioma")}</li>
        <li>{t("cookies.pag.sessao")}</li>
        <li>{t("cookies.pag.escolha")}</li>
      </ul>
      <p className="mt-4">{t("cookies.pag.rastreio")}</p>
      <div className="mt-8 max-w-xs">
        <Botao variante="contorno" onClick={limparConsentimento}>{t("cookies.pag.alterar")}</Botao>
      </div>
      <a href={caminho("/")} className="mt-8 inline-block underline">{t("sistema.voltar")}</a>
    </main>
  )
}

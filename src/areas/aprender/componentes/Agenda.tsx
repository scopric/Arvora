import { useIdioma, useT } from "../../../i18n"
import { baixarIcs, botaoContorno, linkGoogleAgenda, linkTexto, type AulaAgenda } from "../util"

// AUL-01: arquivo .ics (gerado aqui, sem servidor) e link "adicionar ao Google Agenda".
export function Agenda({ aula }: { aula: AulaAgenda }) {
  const t = useT()
  const lang = useIdioma()
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <button type="button" onClick={() => baixarIcs(aula, lang)} className={botaoContorno}>
        {t("aprender.agenda.ics")}
      </button>
      <a href={linkGoogleAgenda(aula, lang)} target="_blank" rel="noopener noreferrer" className={linkTexto}>
        {t("aprender.agenda.google")}
        <span className="sr-only"> {t("aprender.abreFora")}</span>
      </a>
    </div>
  )
}

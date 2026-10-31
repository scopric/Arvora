import { useIdioma, useT } from "../../../i18n"
import { dataLonga, hora } from "../util"

// Data e hora absolutas nos dois fusos. Sem contagem regressiva (PRD §17.1 nº6).
export function QuandoAula({ inicio }: { inicio: string }) {
  const t = useT()
  const lang = useIdioma()
  return (
    <time dateTime={inicio}>
      {dataLonga(inicio, lang)} ({t("aprender.fuso.dublin")}) · {hora(inicio, lang, "America/Sao_Paulo")} ({t("aprender.fuso.brasilia")})
    </time>
  )
}

import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { Pagina } from "../componentes/Pagina"

// Revisão de IA é P1 e fica fora do MVP (PRD §17.4.5, ADM-03): a tela só avisa.
export function RevisaoIA() {
  const t = useT()
  return (
    <Pagina titulo="admin.ia.titulo">
      <Vazio titulo={t("admin.ia.aviso.titulo")}>{t("admin.ia.aviso.texto")}</Vazio>
    </Pagina>
  )
}

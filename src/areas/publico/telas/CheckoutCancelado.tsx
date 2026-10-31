import { Link } from "react-router"
import { useCaminho, useT, useTitulo } from "../../../i18n"
import { Pagina, linkPrimario } from "../Pagina"

export function CheckoutCancelado() {
  const t = useT()
  const caminho = useCaminho()
  useTitulo("publico.checkoutCancelado.titulo", true)
  return (
    <Pagina titulo={t("publico.checkoutCancelado.titulo")} largura="max-w-3xl">
      <p className="max-w-prose text-lg">{t("publico.checkoutCancelado.texto")}</p>
      <Link to={caminho("/planos")} className={`${linkPrimario} mt-6`}>
        {t("publico.checkoutCancelado.voltar")}
      </Link>
    </Pagina>
  )
}

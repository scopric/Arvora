import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useT } from "../../../i18n"
import { useAuth } from "../../../lib/sessao"
import { BlocoConsentimento } from "../BlocoConsentimento"
import { useConsentimentos } from "../consentimentos"
import { Pagina } from "../Pagina"

export function Emails() {
  const t = useT()
  const { sessao } = useAuth()
  const { estado, recarregar } = useConsentimentos(sessao?.user.id)
  return (
    <Pagina titulo="conta.emails.titulo">
      <Cartao>
        <h2 className="text-corpo-g font-semibold">{t("conta.emails.transacional.titulo")}</h2>
        {/* Transacional não desliga (EML-07): o interruptor aparece ligado e travado para deixar isso claro. */}
        <label className="mt-4 flex min-h-11 items-center gap-3 font-semibold">
          <input type="checkbox" role="switch" checked disabled readOnly className="size-5 accent-dourado" />
          {t("conta.emails.transacional.rotulo")}
        </label>
        <p className="mt-2 text-sm text-creme/70">{t("conta.emails.transacional.texto")}</p>
      </Cartao>
      <Cartao>
        <h2 className="text-corpo-g font-semibold">{t("conta.emails.marketing.titulo")}</h2>
        <div className="mt-4">
          {estado.fase === "carregando" ? <Esqueleto linhas={2} /> : null}
          {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("conta.erroCarregar")}</Erro> : null}
          {estado.fase === "pronto" ? (
            <BlocoConsentimento tipo="marketing" rotulo="conta.emails.marketing.rotulo" ajuda="conta.emails.marketing.texto" docs={estado.docs} aceites={estado.aceites} aoMudar={recarregar} />
          ) : null}
        </div>
      </Cartao>
    </Pagina>
  )
}

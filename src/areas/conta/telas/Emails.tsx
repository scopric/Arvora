import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useT } from "../../../i18n"
import { useAuth } from "../../../lib/sessao"
import { BlocoConsentimento } from "../BlocoConsentimento"
import { useConsentimentos } from "../consentimentos"
import { Interruptor, Pagina, Secao } from "../Pagina"

export function Emails() {
  const t = useT()
  const { sessao } = useAuth()
  const { estado, recarregar } = useConsentimentos(sessao?.user.id)
  return (
    <Pagina titulo="conta.emails.titulo">
      <Secao titulo={t("conta.emails.transacional.titulo")}>
        {/* Transacional não desliga (EML-07): o interruptor aparece ligado e travado para deixar isso claro. */}
        <Interruptor rotulo={t("conta.emails.transacional.rotulo")} ajuda={t("conta.emails.transacional.texto")} idAjuda="emails-transacional-ajuda" checked disabled readOnly />
      </Secao>
      <Secao titulo={t("conta.emails.marketing.titulo")}>
        {estado.fase === "carregando" ? <Esqueleto linhas={2} /> : null}
        {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("conta.erroCarregar")}</Erro> : null}
        {estado.fase === "pronto" ? (
          <BlocoConsentimento tipo="marketing" rotulo="conta.emails.marketing.rotulo" ajuda="conta.emails.marketing.texto" docs={estado.docs} aceites={estado.aceites} aoMudar={recarregar} />
        ) : null}
      </Secao>
    </Pagina>
  )
}

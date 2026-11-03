import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useCaminho, useT, useTitulo } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { Pagina } from "../Pagina"
import { linkContorno, linkPrimario } from "../../../componentes/botaoEstilo"

const A_CADA_MS = 3000
const DESISTE_MS = 30_000

// Volta do Stripe: o acesso só muda quando o webhook processa o pagamento (ASS-03), então a tela pergunta ao banco até ~30 s.
// Passou disso, não é erro: a mensagem diz que pode levar alguns minutos (PRD §17.4.1).
export function CheckoutSucesso() {
  const t = useT()
  const caminho = useCaminho()
  const { sessao, carregando: sessaoCarregando } = useAuth()
  const { nivel, erro, recarregar } = useAcesso()
  const [desistiu, setDesistiu] = useState(false)
  const confirmado = nivel !== "visitante"
  // Título neutro enquanto confirma; "confirmada" só quando o acesso chegou.
  const titulo = confirmado ? "publico.checkoutSucesso.titulo" : "publico.checkoutSucesso.tituloConfirmando"
  useTitulo(titulo, true)
  const esperando = Boolean(sessao) && !confirmado && !erro && !desistiu

  useEffect(() => {
    if (!esperando) return
    const intervalo = setInterval(recarregar, A_CADA_MS)
    const prazo = setTimeout(() => setDesistiu(true), DESISTE_MS)
    return () => {
      clearInterval(intervalo)
      clearTimeout(prazo)
    }
  }, [esperando, recarregar])

  if (sessaoCarregando) {
    return (
      <Pagina titulo={t(titulo)} largura="max-w-3xl">
        <Esqueleto />
      </Pagina>
    )
  }
  if (!sessao) {
    return (
      <Pagina titulo={t(titulo)} largura="max-w-3xl">
        <p className="max-w-prose text-lg">{t("publico.checkoutSucesso.semSessao")}</p>
        <Link to={caminho("/entrar")} className={`${linkPrimario} mt-6`}>
          {t("nav.entrar")}
        </Link>
      </Pagina>
    )
  }
  return (
    <Pagina titulo={t(titulo)} largura="max-w-3xl">
      {confirmado ? (
        <div role="status">
          <p className="max-w-prose text-lg">{t("publico.checkoutSucesso.confirmado")}</p>
          <Link to={caminho("/bem-vindo")} className={`${linkPrimario} mt-6`}>
            {t("publico.checkoutSucesso.comecar")}
          </Link>
        </div>
      ) : erro ? (
        <Erro aoTentar={recarregar}>{t("acesso.erro")}</Erro>
      ) : desistiu ? (
        <div role="status">
          <p className="max-w-prose text-lg">{t("publico.checkoutSucesso.demora")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setDesistiu(false)
                recarregar()
              }}
              className={linkContorno}
            >
              {t("publico.checkoutSucesso.verificar")}
            </button>
            <Link to={caminho("/suporte")} className={linkContorno}>
              {t("menu.suporte")}
            </Link>
          </div>
        </div>
      ) : (
        <div role="status" aria-busy="true">
          <p className="max-w-prose text-lg">{t("publico.checkoutSucesso.confirmando")}</p>
          <Esqueleto linhas={2} className="mt-6 max-w-md" />
        </div>
      )}
    </Pagina>
  )
}

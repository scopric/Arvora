import { useState, type ReactNode } from "react"
import { useLocation } from "react-router"
import { useCaminho, useT } from "../i18n"
import { useAcesso } from "../lib/acesso"
import { barraContaDoPainel, linkSite } from "../lib/enderecos"
import { sair, useAuth } from "../lib/sessao"
import { ADMIN_URL } from "../site"
import { Aviso } from "./Aviso"
import { Botao } from "./Botao"
import { Carregando } from "./Carregando"

// Sai e só então troca de página: se o signOut falhar, a sessão continua e a pessoa precisa saber.
export function BotaoSair({ destino, className = "" }: { destino: string; className?: string }) {
  const t = useT()
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  async function sairDaConta() {
    setOcupado(true)
    const { error } = await sair()
    setOcupado(false)
    if (error) return setFalhou(true)
    window.location.assign(destino)
  }
  return (
    <div className={className}>
      {falhou ? <div className="mb-3"><Aviso tipo="erro">{t("sistema.erro")}</Aviso></div> : null}
      <Botao variante="contorno" onClick={sairDaConta} ocupado={ocupado}>{t("menu.sair")}</Botao>
    </div>
  )
}

// Decisão 67: conta da equipe não usa o app. Fica em volta de todas as rotas do app (inclui planos, checkout e
// as páginas com casca do membro). Barreira de interface; quem barra os dados é o RLS.
export function SoMembroNoApp({ children }: { children: ReactNode }) {
  const { sessao } = useAuth()
  const acesso = useAcesso()
  const { pathname } = useLocation()
  const origem = window.location.origin
  if (!sessao || !barraContaDoPainel(origem, pathname, true)) return children
  if (acesso.carregando) return <Carregando />
  return barraContaDoPainel(origem, pathname, acesso.equipe) ? <ContaDoPainel /> : children
}

function ContaDoPainel() {
  const t = useT()
  const caminho = useCaminho()
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">{t("contaPainel.titulo")}</h1>
      <p className="mt-4 text-creme/75">{t("contaPainel.texto")}</p>
      <div className="mt-8 flex flex-wrap items-start gap-3">
        <a href={`${ADMIN_URL}${caminho("/entrar")}`} className="inline-flex min-h-11 items-center underline decoration-dourado underline-offset-4">{t("contaPainel.irPainel")}</a>
        <BotaoSair destino={linkSite(caminho("/"))} />
      </div>
    </main>
  )
}

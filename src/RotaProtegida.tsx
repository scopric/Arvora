import { Navigate, Outlet, useLocation } from "react-router"
import { Botao } from "./componentes/Botao"
import { useCaminho, useT } from "./i18n"
import { useAcesso } from "./lib/acesso"
import { ehAppSeparado, linkSite } from "./lib/enderecos"
import { sair, useAuth } from "./lib/sessao"

export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const acesso = useAcesso()
  const caminho = useCaminho()
  const t = useT()
  const local = useLocation()
  // No app separado, conta da equipe não entra (Decisão 67): espera o acesso para decidir.
  const conferir = ehAppSeparado(window.location.origin)
  if (carregando || (sessao && conferir && acesso.carregando)) return <p role="status" className="p-12 text-creme/70">{t("comum.carregando")}</p>
  if (!sessao) return <Navigate to={caminho("/entrar")} replace state={{ de: local.pathname }} />
  if (conferir && acesso.equipe) return <ContaDoPainel />
  return <Outlet />
}

// Barreira de interface: separa as contas, não protege dados (quem barra é o RLS, e a equipe já lê mais que o membro).
function ContaDoPainel() {
  const t = useT()
  const caminho = useCaminho()
  async function sairDaConta() {
    await sair()
    window.location.assign(linkSite(caminho("/")))
  }
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">{t("contaPainel.titulo")}</h1>
      <p className="mt-4 text-creme/75">{t("contaPainel.texto")}</p>
      <Botao onClick={sairDaConta} className="mt-8">{t("menu.sair")}</Botao>
    </main>
  )
}

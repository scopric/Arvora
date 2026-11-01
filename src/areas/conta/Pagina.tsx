import type { ReactNode } from "react"
import { NavLink } from "react-router"
import { abaApp } from "../../componentes/menuApp"
import { useCaminho, useT, useTitulo, type Chave } from "../../i18n"

const ABAS: { rota: string; rotulo: Chave; fim?: boolean }[] = [
  { rota: "/configuracoes", rotulo: "conta.menu.conta", fim: true },
  { rota: "/configuracoes/privacidade", rotulo: "conta.privacidade.titulo" },
  { rota: "/configuracoes/emails", rotulo: "conta.emails.titulo" },
  { rota: "/configuracoes/assinatura", rotulo: "conta.assinatura.titulo" },
  { rota: "/configuracoes/dados", rotulo: "conta.dados.titulo" },
]

// Casca das telas da conta: título (h1), <title> sem indexação e, nas configurações, o menu entre as páginas.
// Não renderiza <main>: o layout do membro já tem.
export function Pagina({ titulo, menu = true, children }: { titulo: Chave; menu?: boolean; children: ReactNode }) {
  const t = useT()
  const caminho = useCaminho()
  useTitulo(titulo, true)
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <h1 className="text-subtitulo font-semibold sm:text-titulo-p">{t(titulo)}</h1>
      {menu ? (
        <nav aria-label={t("conta.menu")} className="mt-6 flex flex-wrap gap-1 pb-1">
          {ABAS.map((a) => (
            <NavLink
              key={a.rota}
              to={caminho(a.rota)}
              end={a.fim}
              className={abaApp}
            >
              {t(a.rotulo)}
            </NavLink>
          ))}
        </nav>
      ) : null}
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  )
}

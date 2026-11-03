import { useId, type ComponentProps, type ReactNode } from "react"
import { NavLink } from "react-router"
import { linkMenuApp } from "../../componentes/menuApp"
import { useCaminho, useT, useTitulo, type Chave } from "../../i18n"

const ABAS: { rota: string; rotulo: Chave; fim?: boolean }[] = [
  { rota: "/configuracoes", rotulo: "conta.menu.conta", fim: true },
  { rota: "/configuracoes/privacidade", rotulo: "conta.privacidade.titulo" },
  { rota: "/configuracoes/emails", rotulo: "conta.emails.titulo" },
  { rota: "/configuracoes/assinatura", rotulo: "conta.assinatura.titulo" },
  { rota: "/configuracoes/dados", rotulo: "conta.dados.titulo" },
]

// Casca das telas da conta: título (h1), <title> sem indexação e, nas configurações, o menu entre as páginas.
// Molde Linear (settings): sub-sidebar à esquerda no desktop (fixa ao rolar), pílulas no celular; o item ativo
// usa o mesmo desenho da sidebar do app. Não renderiza <main>: o layout do membro já tem.
export function Pagina({ titulo, menu = true, children }: { titulo: Chave; menu?: boolean; children: ReactNode }) {
  const t = useT()
  const caminho = useCaminho()
  useTitulo(titulo, true)
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 ${menu ? "max-w-5xl" : "max-w-3xl"}`}>
      <h1 className="text-titulo-p font-semibold sm:text-titulo">{t(titulo)}</h1>
      <div className={menu ? "mt-6 grid gap-8 lg:grid-cols-[13rem_1fr]" : "mt-8"}>
        {menu ? (
          <nav aria-label={t("conta.menu")} className="flex flex-wrap gap-1 lg:sticky lg:top-16 lg:flex-col lg:gap-0.5 lg:self-start">
            {ABAS.map((a) => (
              <NavLink key={a.rota} to={caminho(a.rota)} end={a.fim} className={linkMenuApp}>
                {t(a.rotulo)}
              </NavLink>
            ))}
          </nav>
        ) : null}
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    </div>
  )
}

// Seção de configurações (molde Linear): título e explicação fora do painel; o painel é uma moldura por hairline.
export function Secao({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold">{titulo}</h2>
      {texto ? <p className="mt-1 text-corpo-p text-nevoa">{texto}</p> : null}
      <div className="mt-4 rounded-xl p-5 shadow-borda">{children}</div>
    </section>
  )
}

// Interruptor (molde Linear): rótulo e ajuda à esquerda, trilho à direita; o dourado é o indicador de "ligado".
// É um <input type="checkbox" role="switch"> de verdade dentro do <label>: nome acessível e teclado vêm de graça.
// O rótulo fica num <label htmlFor> (é só ele que vira o nome acessível); a ajuda vai por aria-describedby; o trilho é um
// segundo <label> que envolve só o input, para o clique no trilho também alternar.
export function Interruptor({ rotulo, ajuda, idAjuda, className = "", ...resto }: Omit<ComponentProps<"input">, "type" | "role" | "id"> & { rotulo: ReactNode; ajuda?: ReactNode; idAjuda?: string }) {
  const id = useId()
  const idDesc = idAjuda ?? `${id}-ajuda`
  return (
    <div className={`group flex min-h-9 items-start justify-between gap-4 pointer-coarse:min-h-11 ${className}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-base font-medium group-has-disabled:cursor-not-allowed">{rotulo}</label>
        {ajuda ? <p id={idDesc} className="mt-0.5 text-corpo-p text-nevoa">{ajuda}</p> : null}
      </div>
      <label className="relative -my-1.5 flex min-h-9 shrink-0 cursor-pointer items-center pointer-coarse:-my-2.5 pointer-coarse:min-h-11 has-disabled:cursor-not-allowed">
        <input id={id} type="checkbox" role="switch" aria-describedby={ajuda ? idDesc : undefined} className="peer sr-only" {...resto} />
        <span
          aria-hidden="true"
          className="relative h-5 w-9 rounded-full bg-fumaca transition-colors peer-checked:bg-dourado peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dourado after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-creme after:transition-transform peer-checked:after:translate-x-4"
        />
      </label>
    </div>
  )
}

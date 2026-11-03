import { useId, type ComponentProps, type ReactNode } from "react"
import { NavLink } from "react-router"
import { Cartao } from "../../componentes/Cartao"
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
// Molde Linear (settings, tela 04b0ed10) sobre a camada de vidro: sub-menu num bloco de vidro-fundo à esquerda no
// desktop (fixo ao rolar), em linha (mesmos itens, sem bloco) no celular; o item ativo usa o mesmo desenho do menu do admin.
// Não renderiza <main>: o layout do membro já tem.
export function Pagina({ titulo, menu = true, children }: { titulo: Chave; menu?: boolean; children: ReactNode }) {
  const t = useT()
  const caminho = useCaminho()
  useTitulo(titulo, true)
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 ${menu ? "max-w-5xl" : "max-w-3xl"}`}>
      <h1 className="text-titulo-p font-semibold sm:text-titulo">{t(titulo)}</h1>
      <div className={menu ? "mt-6 grid gap-8 lg:grid-cols-[13rem_1fr]" : "mt-8"}>
        {menu ? (
          <nav aria-label={t("conta.menu")} className="flex flex-wrap gap-1 lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:self-start lg:rounded-lg lg:p-2 lg:vidro-fundo">
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

// Seção de configurações (molde Linear 068eb844): título 20/600 e explicação em cinza fora do painel; o painel é um
// cartão de vidro (Decisão 70).
export function Secao({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-subtitulo font-semibold">{titulo}</h2>
      {texto ? <p className="mt-1 text-corpo text-cinza">{texto}</p> : null}
      <Cartao className="mt-4">{children}</Cartao>
    </section>
  )
}

// Interruptor (molde Linear): rótulo e ajuda à esquerda, trilho à direita; o dourado é o indicador de "ligado".
// Trilho com borda cinza (3,6:1 sobre fumaça, 5,3 sobre o vidro) e botão creme; ligado, trilho dourado e botão em breu
// (8,3:1). A borda e o botão em CanvasText seguem visíveis no modo de cores forçadas.
// É um <input type="checkbox" role="switch"> de verdade dentro do <label>: nome acessível e teclado vêm de graça.
// O rótulo fica num <label htmlFor> (é só ele que vira o nome acessível); a ajuda vai por aria-describedby; o trilho é um
// segundo <label> que envolve só o input, para o clique no trilho também alternar.
export function Interruptor({ rotulo, ajuda, idAjuda, className = "", ...resto }: Omit<ComponentProps<"input">, "type" | "role" | "id"> & { rotulo: ReactNode; ajuda?: ReactNode; idAjuda?: string }) {
  const id = useId()
  const idDesc = idAjuda ?? `${id}-ajuda`
  return (
    <div className={`group flex min-h-9 items-start justify-between gap-4 pointer-coarse:min-h-11 ${className}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-corpo font-semibold group-has-disabled:cursor-not-allowed">{rotulo}</label>
        {ajuda ? <p id={idDesc} className="mt-0.5 text-corpo-p text-cinza">{ajuda}</p> : null}
      </div>
      <label className="relative -my-1.5 flex min-h-9 shrink-0 cursor-pointer items-center pointer-coarse:-my-2.5 pointer-coarse:min-h-11 has-disabled:cursor-not-allowed">
        <input id={id} type="checkbox" role="switch" aria-describedby={ajuda ? idDesc : undefined} className="peer sr-only" {...resto} />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 rounded-full border border-cinza bg-fumaca transition-colors peer-checked:border-dourado peer-checked:bg-dourado motion-reduce:transition-none motion-reduce:after:transition-none peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dourado after:absolute after:top-px after:left-px after:size-5 after:rounded-full after:bg-creme after:transition-[translate,background-color] peer-checked:after:translate-x-5 peer-checked:after:bg-breu forced-colors:after:bg-[CanvasText]! forced-colors:after:[forced-color-adjust:none]"
        />
      </label>
    </div>
  )
}

// Classes compartilhadas da navegação do app (LayoutMembro e LayoutAdmin), molde Linear.
// Item ativo: fundo creme/5, texto creme, ícone dourado E uma barra de 2px dourada à esquerda — a forma não
// depende só de cor (WCAG 1.4.1).
export const focoApp = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
export const linkMenuApp = `relative flex h-8 items-center gap-2 rounded-md px-2 text-legenda font-medium text-nevoa transition-colors pointer-coarse:min-h-11 hover:bg-creme/5 hover:text-creme aria-[current=page]:bg-creme/5 aria-[current=page]:text-creme aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-dourado [&[aria-current=page]>svg:first-child]:text-dourado ${focoApp}`
export const rotuloGrupoApp = "px-2 pt-4 pb-1 text-[11px] font-medium text-nevoa"
// Abas e submenus em pílula: a ativa ganha fundo creme/5 e uma barra dourada embaixo (forma + cor).
export const abaApp = `relative inline-flex h-8 shrink-0 items-center rounded-md px-3 text-legenda font-medium text-nevoa transition-colors pointer-coarse:min-h-11 hover:text-creme aria-selected:bg-creme/5 aria-selected:text-creme aria-selected:after:absolute aria-selected:after:inset-x-3 aria-selected:after:-bottom-1 aria-selected:after:h-0.5 aria-selected:after:rounded-full aria-selected:after:bg-dourado aria-[current=page]:bg-creme/5 aria-[current=page]:text-creme aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-dourado ${focoApp}`
// Mesmo item para listas de aulas (CursoAula): altura mínima em vez de fixa, porque o título pode ocupar duas linhas.
export const linkListaApp = linkMenuApp.replace("flex h-8 ", "flex min-h-9 py-1.5 ")
// Link de texto do app: creme, sublinhado em cinza que acende no hover.
export const linkTextoApp = `rounded-sm font-medium text-creme underline decoration-cinza underline-offset-4 transition-colors hover:decoration-creme ${focoApp}`

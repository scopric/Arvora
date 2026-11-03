// Classes compartilhadas da navegação do app (LayoutMembro e LayoutAdmin), molde MasterClass (Decisão 70).
// A ativa nunca depende só de cor (WCAG 1.4.1): ganha fundo (menu) ou sublinhado (abas e topo).
export const focoApp = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const ativoMenu = "aria-[current=page]:bg-placa aria-[current=page]:text-creme [&[aria-current=page]>svg:first-child]:text-dourado"
// Item da sidebar do admin (molde Linear settings sobre os tokens do MasterClass): 40px, raio 8, 14px/600 cinza; ativo em placa.
export const linkMenuApp = `relative flex h-10 items-center gap-2 rounded-lg px-3 text-corpo-p font-semibold text-cinza transition-colors pointer-coarse:min-h-11 hover:bg-placa/60 hover:text-creme ${ativoMenu} ${focoApp}`
// Mesmo item para listas de aulas (CursoAula): altura mínima em vez de fixa, porque o título pode ocupar duas linhas.
export const linkListaApp = `relative flex min-h-10 items-center gap-2 rounded-lg px-3 py-1.5 text-corpo-p font-semibold text-cinza transition-colors pointer-coarse:min-h-11 hover:bg-placa/60 hover:text-creme ${ativoMenu} ${focoApp}`
export const rotuloGrupoApp = "px-3 pt-5 pb-1 text-legenda font-semibold text-cinza"
// Links de área na barra superior do membro (Início · Aprender · Rede · Awards): 16px/600, o atual em creme com sublinhado dourado.
export const linkTopoApp = `relative inline-flex min-h-11 items-center rounded-lg px-3 text-corpo font-semibold text-cinza transition-colors hover:text-creme aria-[current=page]:text-creme aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-dourado ${focoApp}`
// Abas e sub-navegação (All Lessons / My Notes): texto 16px/600 cinza, a ativa em creme com sublinhado dourado de 2px.
export const abaApp = `-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent text-corpo font-semibold text-cinza transition-colors hover:text-creme aria-selected:border-dourado aria-selected:text-creme aria-[current=page]:border-dourado aria-[current=page]:text-creme ${focoApp}`
// Link de texto do app: creme, sublinhado em cinza que acende no hover.
export const linkTextoApp = `rounded-sm font-semibold text-creme underline decoration-cinza underline-offset-4 transition-colors hover:decoration-creme ${focoApp}`

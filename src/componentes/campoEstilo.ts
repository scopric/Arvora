import { useApp } from "./escopo"

const publico = {
  rotulo: "mb-2 block text-sm font-semibold text-creme",
  campo: "w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40",
  bordaOk: "border-creme/25",
  erro: "mt-2 text-sm text-red-300",
  ajuda: "mt-2 text-sm text-creme/60",
}

// App (MasterClass, "Search Input"): rótulo 14px/600 creme; campo raio 4, fundo ardósia, borda cinza de 1px
// (5,4:1), foco = borda creme + anel interno de 1px (o "2px inner ring" do DESIGN.md). Texto digitado em 16px
// (PRD §17.7.3; também evita o zoom do iOS).
const app = {
  rotulo: "mb-2 block text-corpo-p font-semibold text-creme",
  campo: "w-full rounded-sm border bg-ardosia px-4 py-2.5 text-corpo text-creme placeholder:text-cinza outline-none transition-colors focus-visible:border-creme focus-visible:ring-1 focus-visible:ring-creme focus-visible:ring-inset",
  bordaOk: "border-cinza",
  erro: "mt-2 text-corpo-p text-red-300",
  ajuda: "mt-2 text-corpo-p text-cinza",
}

// Um só lugar decide o visual de campo: Campo/Selecao e AreaTexto/Caixa do admin.
export function useEstiloCampo() {
  return useApp() ? app : publico
}
// Campo solto (textarea sem Campo) das áreas que só existem no app (aprender, rede): a mesma string do app, com a borda normal.
export const campoApp = `${app.campo} ${app.bordaOk}`

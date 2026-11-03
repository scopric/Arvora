import { useApp } from "./escopo"

const publico = {
  rotulo: "mb-2 block text-sm font-semibold text-creme",
  campo: "w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40",
  bordaOk: "border-creme/25",
  erro: "mt-2 text-sm text-red-300",
  ajuda: "mt-2 text-sm text-creme/60",
}

// App (Linear): rótulo 13px/510 bruma; campo raio 6, fundo creme/2, borda cinza (3,35:1, o mínimo da WCAG 1.4.11),
// foco só pela borda em bruma, sem anel. O texto digitado fica em 16px (PRD §17.7.3; também evita o zoom do iOS).
const app = {
  rotulo: "mb-1.5 block text-corpo-p font-medium text-bruma",
  campo: "w-full rounded-md border bg-creme/2 px-3.5 py-3 text-base text-creme placeholder:text-nevoa outline-none transition-colors focus-visible:border-bruma",
  bordaOk: "border-cinza",
  erro: "mt-1.5 text-corpo-p text-red-300",
  ajuda: "mt-1.5 text-corpo-p text-nevoa",
}

// Um só lugar decide o visual de campo: Campo/Selecao e AreaTexto/Caixa do admin.
export function useEstiloCampo() {
  return useApp() ? app : publico
}
// Campo solto (textarea sem Campo) das áreas que só existem no app (aprender, rede): a mesma string do app, com a borda normal.
export const campoApp = `${app.campo} ${app.bordaOk}`

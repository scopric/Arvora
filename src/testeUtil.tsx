import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, Route, Routes } from "react-router"

// Monta `ui` sob /:lang (o idioma vem da URL, como no app). Só para testes.
export const renderiza = (ui: ReactElement, url = "/pt") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/:lang/*" element={ui} />
      </Routes>
    </MemoryRouter>,
  )

// jsdom não implementa showModal/close do <dialog>: simula só o atributo `open` (foco preso e Esc não são testáveis aqui).
export function simularDialog() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
  }
}

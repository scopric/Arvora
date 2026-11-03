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
// jsdom esconde [popover] mas não tem showPopover nem popovertarget: abre e fecha pelo estilo, e o clique no botão alterna.
export function simularPopover() {
  HTMLElement.prototype.showPopover = function () {
    this.style.display = "block"
  }
  HTMLElement.prototype.hidePopover = function () {
    this.style.display = ""
  }
  document.addEventListener("click", (e) => {
    const alvo = (e.target as Element).closest?.("[popovertarget]")
    const p = alvo && document.getElementById(alvo.getAttribute("popovertarget") ?? "")
    if (p) p.style.display = p.style.display === "block" ? "" : "block"
  })
}

export function simularDialog() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
  }
}

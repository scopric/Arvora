import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { renderiza } from "../testeUtil"
import { PlayerVideo } from "./PlayerVideo"

afterEach(cleanup)
const montar = (props: Parameters<typeof PlayerVideo>[0]) => renderiza(<PlayerVideo {...props} />)

describe("PlayerVideo", () => {
  it("arquivo vira <video> com controles, sem autoplay, e legenda ligada por padrão", () => {
    const { container } = montar({ titulo: "Aula 1", tipo: "arquivo", src: "https://exemplo.invalid/a.mp4", legendas: [{ src: "https://exemplo.invalid/a.vtt", idioma: "pt", rotulo: "Português", padrao: true }] })
    const v = container.querySelector("video")!
    expect(v.controls).toBe(true)
    expect(v.autoplay).toBe(false)
    expect(v.getAttribute("aria-label")).toBe("Aula 1")
    const faixa = v.querySelector("track")!
    expect(faixa.default).toBe(true)
    expect(faixa.getAttribute("srclang")).toBe("pt")
  })

  it("embed vira <iframe> com título", () => {
    montar({ titulo: "Aula 2", tipo: "embed", src: "https://player.exemplo.invalid/v/1" })
    expect(screen.getByTitle("Aula 2").tagName).toBe("IFRAME")
  })

  it("recusa URL que não é https (javascript:, data:, http:) e mostra o erro", () => {
    for (const src of ["javascript:alert(1)", "data:text/html,x", "http://exemplo.invalid/a.mp4"]) {
      const { container, unmount } = montar({ titulo: "x", tipo: "embed", src })
      expect(container.querySelector("iframe")).toBeNull()
      expect(screen.getByRole("alert").textContent).toContain("Não conseguimos abrir este vídeo")
      unmount()
    }
  })

  it("falha de carregamento do arquivo vira erro na tela", () => {
    const { container } = montar({ titulo: "Aula 3", tipo: "arquivo", src: "https://exemplo.invalid/b.mp4" })
    fireEvent.error(container.querySelector("video")!)
    expect(screen.getByRole("alert")).toBeTruthy()
  })
})

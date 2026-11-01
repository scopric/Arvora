import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderiza, simularDialog } from "../testeUtil"
import { DialogoConfirmar } from "./DialogoConfirmar"

simularDialog()
afterEach(cleanup)
const montar = (aberto: boolean, aoConfirmar = vi.fn(), aoCancelar = vi.fn()) =>
  renderiza(<DialogoConfirmar aberto={aberto} titulo="Apagar?" texto="Não dá para desfazer." confirmar="Apagar" aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} />)

describe("DialogoConfirmar", () => {
  it("abre e fecha conforme `aberto` (showModal/close nativos)", () => {
    montar(false)
    expect(screen.queryByRole("dialog")).toBeNull() // fechado: fora da árvore de acessibilidade
    cleanup()
    montar(true)
    expect(screen.getByRole("dialog", { name: "Apagar?" })).toBeTruthy()
  })

  it("chama confirmar e cancelar", async () => {
    const ok = vi.fn()
    const nao = vi.fn()
    montar(true, ok, nao)
    const u = userEvent.setup()
    await u.click(screen.getByRole("button", { name: "Apagar" }))
    expect(ok).toHaveBeenCalledOnce()
    await u.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(nao).toHaveBeenCalledOnce()
  })

  it("Esc (evento cancel) pede para cancelar em vez de fechar sozinho", () => {
    const nao = vi.fn()
    montar(true, vi.fn(), nao)
    const d = document.querySelector("dialog")!
    const e = new Event("cancel", { cancelable: true })
    d.dispatchEvent(e)
    expect(nao).toHaveBeenCalledOnce()
    expect(e.defaultPrevented).toBe(true)
  })
})

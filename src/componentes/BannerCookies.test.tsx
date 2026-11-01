import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { consentimentoAnalytics, limparConsentimento, VERSAO_CONSENTIMENTO } from "../lib/consentimento"
import { BannerCookies } from "./BannerCookies"

const montar = (url = "/pt") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BannerCookies />
    </MemoryRouter>,
  )
const guardado = () => JSON.parse(localStorage.getItem("arvora.consentimento") ?? "null")

beforeEach(() => {
  localStorage.clear()
  limparConsentimento()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("BannerCookies", () => {
  it("aparece sem escolha, em PT e EN, com link da política", async () => {
    montar()
    expect(await screen.findByRole("region", { name: "Cookies" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Política de Cookies" })).toBeTruthy()
    cleanup()
    montar("/en/hall-of-fame")
    expect(await screen.findByRole("button", { name: "Decline" })).toBeTruthy()
  })

  it("aparece em rota fora do App (hall-of-fame) e no fallback sem idioma", async () => {
    montar("/pt/hall-of-fame/exemplo-2025/maria-exemplo")
    expect(await screen.findByRole("region", { name: "Cookies" })).toBeTruthy()
  })

  it("reserva espaço no fim da página enquanto aberto e devolve ao fechar", async () => {
    montar()
    await userEvent.click(await screen.findByRole("button", { name: "Aceitar" }))
    expect(document.body.style.paddingBottom).toBe("")
  })

  it("aceitar grava {versao, escolha, em}, esconde e libera o hook", async () => {
    montar()
    await userEvent.click(await screen.findByRole("button", { name: "Aceitar" }))
    expect(guardado()).toMatchObject({ versao: VERSAO_CONSENTIMENTO, escolha: "aceito" })
    expect(Number.isNaN(Date.parse(guardado().em))).toBe(false)
    expect(screen.queryByRole("region")).toBeNull()
    expect(consentimentoAnalytics()).toBe(true)
  })

  it("recusar é tão fácil quanto aceitar: mesmo tipo de elemento, mesma classe, um clique", async () => {
    montar()
    const [recusar, aceitar] = [await screen.findByRole("button", { name: "Recusar" }), screen.getByRole("button", { name: "Aceitar" })]
    expect(recusar.className).toBe(aceitar.className)
    await userEvent.click(recusar)
    expect(guardado().escolha).toBe("recusado")
    expect(screen.queryByRole("region")).toBeNull()
    expect(consentimentoAnalytics()).toBe(false)
  })

  it("não volta com escolha da versão atual; volta se a versão mudou", async () => {
    localStorage.setItem("arvora.consentimento", JSON.stringify({ versao: VERSAO_CONSENTIMENTO, escolha: "recusado", em: "2026-01-01T00:00:00Z" }))
    montar()
    await Promise.resolve()
    expect(screen.queryByRole("region")).toBeNull()
    cleanup()
    localStorage.setItem("arvora.consentimento", JSON.stringify({ versao: "antiga", escolha: "aceito", em: "2026-01-01T00:00:00Z" }))
    montar()
    expect(await screen.findByRole("region")).toBeTruthy()
    expect(consentimentoAnalytics()).toBe(false)
  })

  it("localStorage indisponível não quebra", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado") })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado") })
    montar()
    await userEvent.click(await screen.findByRole("button", { name: "Recusar" }))
    expect(screen.queryByRole("region")).toBeNull()
    expect(consentimentoAnalytics()).toBe(false)
  })

  it("hook devolve false por padrão", () => {
    expect(consentimentoAnalytics()).toBe(false)
  })

  it("fecha quando outra aba grava a escolha (evento storage) e reabre quando ela retira", async () => {
    montar()
    expect(await screen.findByRole("region", { name: "Cookies" })).toBeTruthy()
    const salvo = JSON.stringify({ versao: VERSAO_CONSENTIMENTO, escolha: "recusado", em: new Date().toISOString() })
    localStorage.setItem("arvora.consentimento", salvo)
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "arvora.consentimento", newValue: salvo }))
    })
    await waitFor(() => expect(screen.queryByRole("region", { name: "Cookies" })).toBeNull())
    localStorage.removeItem("arvora.consentimento")
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "arvora.consentimento", newValue: null }))
    })
    expect(await screen.findByRole("region", { name: "Cookies" })).toBeTruthy()
  })

  it("acompanha a altura do banner com ResizeObserver (girar o celular) e desliga ao fechar", async () => {
    let aoRedimensionar: () => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          aoRedimensionar = cb
        }
        observe() {}
        disconnect = disconnect
      },
    )
    let altura = 100
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => altura)
    montar()
    await screen.findByRole("region", { name: "Cookies" })
    expect(document.body.style.paddingBottom).toBe("100px")
    altura = 180 // girou: o texto quebrou em mais linhas
    act(() => aoRedimensionar())
    expect(document.body.style.paddingBottom).toBe("180px")
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }))
    expect(document.body.style.paddingBottom).toBe("")
    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

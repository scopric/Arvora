import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"
import { Erro } from "./Erro"

afterEach(cleanup)

describe("Erro", () => {
  it("mostra a mensagem padrão e só oferece 'tentar de novo' quando há ação", async () => {
    const tentar = vi.fn()
    const { unmount } = renderiza(<Erro />)
    expect(screen.getByRole("alert").textContent).toContain("Algo deu errado do nosso lado")
    expect(screen.queryByRole("button")).toBeNull()
    unmount()
    renderiza(<Erro aoTentar={tentar} />, "/en")
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(tentar).toHaveBeenCalledOnce()
  })
})

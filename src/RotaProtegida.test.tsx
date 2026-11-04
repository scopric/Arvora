import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RotaProtegida } from "./RotaProtegida"

const rpc = vi.hoisted(() => vi.fn())
const estado = vi.hoisted(() => ({ sessao: null as object | null }))
const sairMock = vi.hoisted(() => vi.fn())
vi.mock("./lib/sessao", () => ({ useAuth: () => ({ sessao: estado.sessao, carregando: false }), sair: sairMock }))
vi.mock("./lib/supabase", () => ({ supabase: { rpc } }))

beforeEach(() => rpc.mockReset())
afterEach(cleanup)

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/pt/inicio"]}>
      <Routes>
        <Route path="/:lang" element={<RotaProtegida />}>
          <Route path="inicio" element={<p>área do membro</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe("RotaProtegida: declaração de 18 anos (f4_10)", () => {
  it("cadastro por e-mail (maior_18 nos metadados) entra direto, sem perguntar ao banco", async () => {
    estado.sessao = { user: { id: "u1", user_metadata: { maior_18: "true" } } }
    montar()
    expect(await screen.findByText("área do membro")).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("conta do Google sem declaração vê a tela e entra depois de declarar", async () => {
    estado.sessao = { user: { id: "u2", user_metadata: { full_name: "Maria" } } }
    rpc.mockImplementation((nome: string) => Promise.resolve(nome === "idade_declarada" ? { data: false, error: null } : { data: null, error: null }))
    montar()
    await userEvent.click(await screen.findByRole("button", { name: "Tenho 18 anos ou mais" }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("declarar_maior_18"))
    expect(await screen.findByText("área do membro")).toBeTruthy()
  })

  it("quem não tem 18 anos apaga a conta e sai", async () => {
    estado.sessao = { user: { id: "u4", user_metadata: {} } }
    rpc.mockImplementation((nome: string) => Promise.resolve(nome === "idade_declarada" ? { data: false, error: null } : { data: null, error: null }))
    montar()
    await userEvent.click(await screen.findByRole("button", { name: "Não tenho 18 anos — apagar minha conta" }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("excluir_conta_sem_declaracao"))
    expect(sairMock).toHaveBeenCalled()
  })

  it("conta do Google que já declarou entra direto", async () => {
    estado.sessao = { user: { id: "u3", user_metadata: {} } }
    rpc.mockResolvedValue({ data: true, error: null })
    montar()
    expect(await screen.findByText("área do membro")).toBeTruthy()
  })
})

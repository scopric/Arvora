import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { AcessoContext, type PapelEquipe } from "../../../lib/acesso"

// Monta uma tela do admin na rota certa (para useParams) com o papel dado.
export function montar(ui: ReactElement, rota: string, url: string, papel: PapelEquipe = "super_admin") {
  return render(
    <AcessoContext value={{ carregando: false, erro: false, nivel: "grupo", premiado: false, equipe: true, papel, recarregar: () => {} }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={`/:lang/admin${rota}`} element={ui} />
        </Routes>
      </MemoryRouter>
    </AcessoContext>,
  )
}

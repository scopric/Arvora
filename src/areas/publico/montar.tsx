import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { AcessoContext, type Acesso } from "../../lib/acesso"

const padrao: Acesso = { carregando: false, erro: false, nivel: "visitante", premiado: false, equipe: false, papel: null, recarregar: () => {} }

// Só para testes: monta a tela na rota certa (para useParams) com o acesso escolhido.
export function montar(ui: ReactElement, rota: string, url: string, acesso: Partial<Acesso> = {}) {
  return render(
    <AcessoContext value={{ ...padrao, ...acesso }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={rota} element={ui} />
        </Routes>
      </MemoryRouter>
    </AcessoContext>,
  )
}

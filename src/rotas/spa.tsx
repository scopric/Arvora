import { lazy, Suspense } from "react"
import { Carregando } from "../componentes/Carregando"

// Carregado sob demanda: o supabase.ts exige variáveis de ambiente ao ser avaliado,
// e as páginas públicas pré-renderizadas não devem carregar o app logado.
const App = lazy(() => import("../App"))

export default function Spa() {
  return (
    <Suspense fallback={<Carregando />}>
      <App />
    </Suspense>
  )
}

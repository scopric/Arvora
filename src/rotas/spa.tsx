import { lazy, Suspense } from "react"
import { Carregando } from "../componentes/Carregando"

// Carregado sob demanda: o supabase.ts exige variáveis de ambiente ao ser avaliado,
// e o build não deve avaliá-lo.
const App = lazy(() => import("../App"))

export default function Spa() {
  return (
    <Suspense fallback={<Carregando />}>
      <App />
    </Suspense>
  )
}

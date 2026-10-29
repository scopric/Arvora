import { lazy, Suspense } from "react"

// Carregado sob demanda: o supabase.ts exige variáveis de ambiente ao ser avaliado,
// e as páginas públicas pré-renderizadas não devem carregar o app logado.
const App = lazy(() => import("../App"))

export default function Spa() {
  return (
    <Suspense fallback={<p role="status" className="p-12 text-creme/70">Carregando…</p>}>
      <App />
    </Suspense>
  )
}

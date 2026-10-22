import { Navigate, Outlet, useLocation } from "react-router"
import { useAuth } from "./lib/sessao"

export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const local = useLocation()
  if (carregando) return <p role="status" className="p-12 text-creme/70">Carregando…</p>
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  return <Outlet />
}

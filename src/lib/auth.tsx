import { useEffect, useState, type ReactNode } from "react"
import { AuthContext, type EstadoAuth } from "./sessao"
import { supabase } from "./supabase"

// Fonte única da sessão (Erros 3.1): só onAuthStateChange. Ele já emite INITIAL_SESSION ao assinar.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ sessao: null, carregando: true })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEstado({ sessao, carregando: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext value={estado}>{children}</AuthContext>
}

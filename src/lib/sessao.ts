import type { Session } from "@supabase/supabase-js"
import { createContext, useContext } from "react"
import { supabase } from "./supabase"

export type EstadoAuth = { sessao: Session | null; carregando: boolean }

export const AuthContext = createContext<EstadoAuth>({ sessao: null, carregando: true })

export function useAuth() {
  return useContext(AuthContext)
}

// Sair só desta sessão: o logout global derrubava o admin em outros aparelhos (Erros 3.3).
export function sair() {
  return supabase.auth.signOut({ scope: "local" })
}

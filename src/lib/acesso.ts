import { createContext, useContext } from "react"

export type Nivel = "visitante" | "clube" | "grupo"
export type PapelEquipe = "super_admin" | "editor" | "corretor" | "moderador" | "auditor"

export type Acesso = {
  carregando: boolean
  // true quando alguma leitura falhou: a tela mostra o erro com "tentar de novo"; nunca trate como "sem acesso".
  erro: boolean
  nivel: Nivel
  premiado: boolean
  // Linha em `equipe` (vale em sessão aal1). Entrar no admin ainda exige aal2 (LayoutAdmin).
  equipe: boolean
  papel: PapelEquipe | null
  recarregar: () => void
}

export const ORDEM: Record<Nivel, number> = { visitante: 0, clube: 1, grupo: 2 }
export const temNivel = (atual: Nivel, minimo: Nivel) => ORDEM[atual] >= ORDEM[minimo]

const inicial: Acesso = {
  carregando: true,
  erro: false,
  nivel: "visitante",
  premiado: false,
  equipe: false,
  papel: null,
  recarregar: () => {},
}
export const AcessoContext = createContext<Acesso>(inicial)

// Nível, premiado e equipe do usuário logado. Sem sessão: visitante, já carregado. Os dados vêm do banco
// (tem_acesso, equipe, premiados); o front só decide o que mostrar, quem barra é o RLS.
export function useAcesso() {
  return useContext(AcessoContext)
}

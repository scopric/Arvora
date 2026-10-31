import { useCallback, useEffect, useState, type ReactNode } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AcessoContext, type Acesso, type Nivel, type PapelEquipe } from "./acesso"
import { useAuth } from "./sessao"
import { supabase } from "./supabase"

type Dados = Pick<Acesso, "nivel" | "premiado" | "equipe" | "papel">
type Estado = { uid: string | null; fase: "carregando" | "erro" | "pronto"; dados: Dados }
const vazio: Dados = { nivel: "visitante", premiado: false, equipe: false, papel: null }

async function ler(uid: string): Promise<Dados> {
  // `premiados` ainda não está em database.types.ts (tabela da migration da branch plataforma-banco): cliente sem tipos aqui.
  // ponytail: trocar por supabase.from("premiados") ao regenerar os tipos.
  const solto = supabase as unknown as SupabaseClient
  const [grupo, clube, eq, prem] = await Promise.all([
    supabase.rpc("tem_acesso", { minimo: "grupo" }),
    supabase.rpc("tem_acesso", { minimo: "clube" }),
    supabase.from("equipe").select("papel").eq("perfil_id", uid).maybeSingle(),
    solto.from("premiados").select("id").eq("perfil_id", uid).limit(1),
  ])
  const falha = grupo.error ?? clube.error ?? eq.error ?? prem.error
  if (falha) throw falha
  const nivel: Nivel = grupo.data ? "grupo" : clube.data ? "clube" : "visitante"
  return { nivel, premiado: (prem.data?.length ?? 0) > 0, equipe: !!eq.data, papel: (eq.data?.papel as PapelEquipe | undefined) ?? null }
}

export function AcessoProvider({ children }: { children: ReactNode }) {
  const { sessao, carregando: sessaoCarregando } = useAuth()
  const uid = sessao?.user.id ?? null
  const [estado, setEstado] = useState<Estado>({ uid: null, fase: "carregando", dados: vazio })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!uid) return
    let ativo = true
    ler(uid).then(
      (dados) => ativo && setEstado({ uid, fase: "pronto", dados }),
      () => ativo && setEstado({ uid, fase: "erro", dados: vazio }),
    )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])

  const recarregar = useCallback(() => {
    setEstado((e) => ({ ...e, fase: "carregando" }))
    setTentativa((n) => n + 1)
  }, [])

  // Sem sessão não há o que ler; com sessão, enquanto o resultado é de outro usuário (ou ainda não veio) vale "carregando".
  const valor: Acesso = !uid
    ? { ...vazio, carregando: sessaoCarregando, erro: false, recarregar }
    : { ...estado.dados, carregando: estado.uid !== uid || estado.fase === "carregando", erro: estado.uid === uid && estado.fase === "erro", recarregar }
  return <AcessoContext value={valor}>{children}</AcessoContext>
}

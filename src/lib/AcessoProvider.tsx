import { useCallback, useEffect, useState, type ReactNode } from "react"
import { AcessoContext, type Acesso, type Nivel, type PapelEquipe } from "./acesso"
import { useAuth } from "./sessao"
import { supabase } from "./supabase"

type Dados = Pick<Acesso, "nivel" | "premiado" | "equipe" | "papel">
type Estado = { uid: string | null; fase: "carregando" | "erro" | "pronto"; dados: Dados }
const vazio: Dados = { nivel: "visitante", premiado: false, equipe: false, papel: null }

// Premiado é só um selo e o bloco Meu Award: se a leitura falhar (ou a tabela ainda não existir), vale `false` e um aviso no console
// de desenvolvimento; nível e equipe não dependem dela.
async function lerPremiado(uid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("premiados").select("id").eq("perfil_id", uid).limit(1)
    if (error) throw error
    return (data?.length ?? 0) > 0
  } catch (e) {
    if (import.meta.env.DEV) console.warn("useAcesso: não foi possível ler premiados; premiado = false", e)
    return false
  }
}

async function ler(uid: string): Promise<Dados> {
  // ponytail: duas chamadas de tem_acesso (grupo e clube). Uma só exigiria uma RPC nova que devolva o nível; fica para quando o banco tiver.
  const [grupo, clube, eq, premiado] = await Promise.all([
    supabase.rpc("tem_acesso", { minimo: "grupo" }),
    supabase.rpc("tem_acesso", { minimo: "clube" }),
    supabase.from("equipe").select("papel").eq("perfil_id", uid).maybeSingle(),
    lerPremiado(uid),
  ])
  const falha = grupo.error ?? clube.error ?? eq.error
  if (falha) throw falha
  const nivel: Nivel = grupo.data ? "grupo" : clube.data ? "clube" : "visitante"
  return { nivel, premiado, equipe: !!eq.data, papel: (eq.data?.papel as PapelEquipe | undefined) ?? null }
}

export function AcessoProvider({ children }: { children: ReactNode }) {
  const { sessao, carregando: sessaoCarregando } = useAuth()
  const uid = sessao?.user.id ?? null
  const [estado, setEstado] = useState<Estado>({ uid: null, fase: "carregando", dados: vazio })
  const [tentativa, setTentativa] = useState(0)
  // Saiu da conta: esquece o que foi lido (se a mesma pessoa voltar, lê de novo em vez de reaproveitar). Ajuste durante a renderização.
  if (!uid && estado.uid !== null) setEstado({ uid: null, fase: "carregando", dados: vazio })

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

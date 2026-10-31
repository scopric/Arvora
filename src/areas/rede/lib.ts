import { useEffect, useEffectEvent, useState } from "react"
import type { Chave } from "../../i18n"
import { supabase } from "../../lib/supabase"

// Colunas de perfis_vitrine (nunca select *): só o que é público entre membros.
export const VITRINE = "id, nome, slug, foto_path, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio"
export type Vitrine = {
  id: string | null
  nome: string | null
  slug: string | null
  foto_path: string | null
  empresa_nome: string | null
  setor_id: number | null
  cidade: string | null
  pais: string | null
  linkedin_url: string | null
  instagram: string | null
  bio: string | null
}
export type Setor = { id: number; nome: string; nome_en: string | null }
export type Categoria = { id: number; nome: string; nome_en: string | null }
export type Item = { perfil_id: string; tipo: "procura" | "oferece"; categoria_id: number; texto: string | null }
export type Conexao = {
  id: number
  solicitante_id: string
  destinatario_id: string
  status: "pendente" | "aceita" | "recusada" | "cancelada"
  origem: "busca" | "match"
  mensagem: string | null
  respondida_em: string | null
  pedida_em: string
}
export const COLUNAS_CONEXAO = "id, solicitante_id, destinatario_id, status, origem, mensagem, respondida_em, pedida_em"

export const DIAS_NOVO_PEDIDO = 30 // PROVISÓRIO: igual ao gatilho do banco (conexoes_transicao)

type Carga<T> = { fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; dados: T }

// Carrega ao montar e quando `chave` muda. `recarregar()` busca de novo SEM voltar ao esqueleto (abas e foco não se perdem).
// Falha vira fase "erro", nunca lista vazia (Erros 3.2). `buscar` deve lançar quando o banco devolver erro.
export function useCarga<T>(buscar: () => Promise<T>, chave: string | number) {
  const [estado, setEstado] = useState<Carga<T>>({ fase: "carregando" })
  const [n, setN] = useState(0)
  const [chaveVista, setChaveVista] = useState(chave)
  if (chaveVista !== chave) {
    setChaveVista(chave)
    setEstado({ fase: "carregando" })
  }
  const executar = useEffectEvent(buscar)
  useEffect(() => {
    let ativo = true
    executar().then(
      (dados) => ativo && setEstado({ fase: "pronto", dados }),
      () => ativo && setEstado({ fase: "erro" }),
    )
    return () => {
      ativo = false
    }
  }, [n, chave])
  return { estado, recarregar: () => setN((v) => v + 1) }
}

// Lança se o banco devolveu erro.
export function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error || r.data === null) throw r.error ?? new Error("sem dados")
  return r.data
}

export const nomeDe = (o: { nome: string; nome_en: string | null }, idioma: string) => (idioma === "en" ? (o.nome_en ?? o.nome) : o.nome)

export const iniciais = (nome: string | null) =>
  (nome ?? "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"

export const chaveSlug = (v: Vitrine) => v.slug ?? v.id ?? ""

export const quando = (iso: string, idioma: string) =>
  new Intl.DateTimeFormat(idioma, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
export const dia = (iso: string, idioma: string) => new Intl.DateTimeFormat(idioma, { dateStyle: "medium" }).format(new Date(iso))

// Data a partir da qual um pedido recusado/cancelado pode ser refeito.
export const podePedirDe = (c: Conexao): Date => new Date(new Date(c.respondida_em ?? c.pedida_em).getTime() + DIAS_NOVO_PEDIDO * 86_400_000)

// Mensagem clara para o que o gatilho/RLS de conexões recusa (limite 20/24 h, 30 dias, destinatário fora da rede).
export function erroConexao(e: { code?: string; message?: string } | null): Chave {
  const m = e?.message ?? ""
  if (m.includes("limite_conexoes")) return "rede.conexao.erroLimite"
  if (m.includes("30 dias")) return "rede.conexao.erro30dias"
  if (m.includes("destinatario_indisponivel")) return "rede.conexao.erroIndisponivel"
  if (e?.code === "23505") return "rede.conexao.erroExiste"
  if (e?.code === "42501" || m.includes("sem_acesso")) return "rede.conexao.erroAcesso"
  return "rede.conexao.erro"
}

// UPDATE sob RLS/gatilho: resposta vazia é erro (Erros 2.5). Devolve a mensagem de erro ou null.
export async function mudarStatus(id: number, status: Conexao["status"]): Promise<Chave | null> {
  const { data, error } = await supabase.from("conexoes").update({ status }).eq("id", id).select("id")
  if (error) return erroConexao(error)
  return data && data.length > 0 ? null : "rede.conexao.erro"
}

// Pedido novo (insert; o solicitante vem do banco, por padrão auth.uid()) ou refeito depois de 30 dias (update da linha existente, que o banco exige única por par).
export async function pedirConexao(outro: string, origem: Conexao["origem"], mensagem: string, existente?: Conexao): Promise<Chave | null> {
  const texto = mensagem.trim() || null
  if (existente) {
    const { data, error } = await supabase.from("conexoes").update({ status: "pendente", mensagem: texto }).eq("id", existente.id).select("id")
    if (error) return erroConexao(error)
    return data && data.length > 0 ? null : "rede.conexao.erro"
  }
  const { error } = await supabase.from("conexoes").insert({ destinatario_id: outro, origem, mensagem: texto }).select("id")
  return error ? erroConexao(error) : null
}

// Nomes de autores e afins, só por perfis_vitrine (listar perfis alheios só por ela).
export async function vitrinesPorId(ids: (string | null)[]): Promise<Map<string, Vitrine>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))]
  if (unicos.length === 0) return new Map()
  const lista = ok(await supabase.from("perfis_vitrine").select(VITRINE).in("id", unicos))
  return new Map(lista.map((v) => [v.id as string, v]))
}

export const nomeSetor = (setores: Setor[], id: number | null, idioma: string) => {
  const s = setores.find((x) => x.id === id)
  return s ? nomeDe(s, idioma) : undefined
}
export const nomeCategoria = (categorias: Categoria[], id: number, idioma: string) => {
  const c = categorias.find((x) => x.id === id)
  return c ? nomeDe(c, idioma) : String(id)
}

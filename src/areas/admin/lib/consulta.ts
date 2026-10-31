import { useCallback, useEffect, useRef, useState } from "react"
import { useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"

// UPDATE/DELETE sob RLS que não casa linha volta 200 com lista vazia: aqui vira erro (CLAUDE.md, regra 5).
export class SemLinha extends Error {
  constructor() {
    super("sem_linha")
  }
}

export function exigir<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error
  if (r.data === null) throw new SemLinha()
  return r.data
}
export function exigirSemDados(r: { error: unknown }) {
  if (r.error) throw r.error
}
export function exigirLinha(r: { data: unknown[] | null; error: unknown }) {
  if (r.error) throw r.error
  if (!r.data || r.data.length === 0) throw new SemLinha()
}

// Cliente sem tipagem por tabela, só para os componentes genéricos (CrudTabela). As telas específicas usam o tipado.
export type Solto = PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }> & {
  select: (colunas: string, opcoes?: object) => Solto
  insert: (v: unknown) => Solto
  update: (v: unknown) => Solto
  delete: () => Solto
  eq: (c: string, v: unknown) => Solto
  order: (c: string, o?: { ascending: boolean }) => Solto
  limit: (n: number) => Solto
}
export const tabelaSolta = (nome: string) => supabase.from(nome as never) as unknown as Solto

export type Carga<T> =
  | { fase: "carregando"; recarregar: () => void }
  | { fase: "erro"; recarregar: () => void }
  | { fase: "pronto"; dados: T; recarregar: () => void }

// Carrega ao montar e quando `deps` muda. Falha vira fase "erro" (a tela mostra o erro com "tentar de novo"), nunca lista vazia.
export function useCarga<T>(buscar: () => Promise<T>, deps: readonly unknown[]): Carga<T> {
  const [estado, setEstado] = useState<{ fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; dados: T }>({ fase: "carregando" })
  const [volta, setVolta] = useState(0)
  const recarregar = useCallback(() => setVolta((n) => n + 1), [])
  const ultimo = useRef(buscar)
  ultimo.current = buscar
  useEffect(() => {
    let ativo = true
    setEstado({ fase: "carregando" })
    ultimo
      .current()
      .then((dados) => ativo && setEstado({ fase: "pronto", dados }))
      .catch(() => ativo && setEstado({ fase: "erro" }))
    return () => {
      ativo = false
    }
  }, [...deps, volta])
  return { ...estado, recarregar } as Carga<T>
}

export type AvisoAcao = { tipo: "ok" | "erro"; texto: string } | null

// Códigos que o banco levanta (raise exception) e que a equipe precisa entender sem abrir o log.
const CODIGOS: Record<string, Chave> = {
  ciclo_em_andamento: "admin.cod.ciclo_em_andamento",
  ciclo_ja_fechado: "admin.cod.ciclo_ja_fechado",
  ciclo_nao_fechado: "admin.cod.ciclo_nao_fechado",
  ciclo_fechado: "admin.cod.ciclo_fechado",
  cambio_ausente: "admin.cod.cambio_ausente",
  item_sem_plano: "admin.cod.item_sem_plano",
  motivo_obrigatorio: "admin.cod.motivo_obrigatorio",
  ja_anulado: "admin.cod.ja_anulado",
  consentimento_ausente_ou_revogado: "admin.cod.consentimento_ausente_ou_revogado",
  devolutiva_obrigatoria: "admin.cod.devolutiva_obrigatoria",
  entrega_inexistente_ou_ja_corrigida: "admin.cod.entrega_ja_corrigida",
  relatorio_inexistente_ou_ja_enviado: "admin.cod.relatorio_ja_enviado",
  perfil_da_equipe: "admin.cod.perfil_da_equipe",
  sem_permissao: "admin.erro.permissao",
  comprovante_obrigatorio: "admin.cod.comprovante_obrigatorio",
  valor_invalido: "admin.cod.valor_invalido",
  material_vazio: "admin.cod.material_vazio",
}

export function textoErro(e: unknown, t: (c: Chave) => string): string {
  const err = (e ?? {}) as { code?: string; message?: string }
  if (e instanceof SemLinha) return t("admin.erro.semLinha")
  if (err.code === "42501") return t("admin.erro.permissao")
  if (err.code === "23505") return t("admin.erro.duplicado")
  if (err.message && CODIGOS[err.message]) return t(CODIGOS[err.message])
  const detalhe = err.message && /^[a-z0-9_]+$/.test(err.message) ? ` (${err.message})` : ""
  return t("admin.erro.salvar") + detalhe
}

// Ação de escrita: ocupado, aviso de sucesso ou erro com texto na tela (nunca silencioso).
export function useAcao() {
  const t = useT()
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<AvisoAcao>(null)
  async function rodar(fn: () => Promise<void>, ok?: Chave): Promise<boolean> {
    setOcupado(true)
    setAviso(null)
    try {
      await fn()
      setAviso(ok ? { tipo: "ok", texto: t(ok) } : null)
      return true
    } catch (e) {
      setAviso({ tipo: "erro", texto: textoErro(e, t) })
      return false
    } finally {
      setOcupado(false)
    }
  }
  return { ocupado, aviso, rodar, limpar: () => setAviso(null) }
}

// Envia arquivo ao bucket e devolve o caminho. Nome saneado; prefixo de tempo evita colisão.
export async function enviarArquivo(bucket: string, pasta: string, arquivo: File): Promise<string> {
  const nome = arquivo.name.normalize("NFD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80)
  const caminho = `${pasta}/${Date.now()}-${nome}`
  const r = await supabase.storage.from(bucket).upload(caminho, arquivo, { upsert: false })
  if (r.error) throw r.error
  return caminho
}

export async function abrirAssinado(bucket: string, caminho: string) {
  const r = await supabase.storage.from(bucket).createSignedUrl(caminho, 300)
  if (r.error || !r.data) throw r.error ?? new SemLinha()
  window.open(r.data.signedUrl, "_blank", "noopener,noreferrer")
}

import { useCallback, useEffect, useState } from "react"
import { useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"

// UPDATE/DELETE sob RLS que não casa linha volta 200 com lista vazia: aqui vira erro (CLAUDE.md, regra 5).
export class SemLinha extends Error {
  constructor() {
    super("sem_linha")
  }
}

export function exigir<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error
  if (r.data === null || r.data === undefined) throw new SemLinha()
  return r.data
}
// Resultado de RPC que devolve texto: nulo é válido (campo vazio), erro não.
export function exigirSemNulo(r: { data: string | null; error: unknown }): string | null {
  if (r.error) throw r.error
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
  const [volta, setVolta] = useState(0)
  const chave = `${JSON.stringify(deps)}#${volta}`
  const [estado, setEstado] = useState<{ chave: string; fase: "erro" } | { chave: string; fase: "pronto"; dados: T }>({ chave: "", fase: "erro" })
  const recarregar = useCallback(() => setVolta((n) => n + 1), [])
  useEffect(() => {
    let ativo = true
    buscar()
      .then((dados) => ativo && setEstado({ chave, fase: "pronto", dados }))
      .catch(() => ativo && setEstado({ chave, fase: "erro" }))
    return () => {
      ativo = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `chave` resume as deps; `buscar` é recriada a cada render
  }, [chave])
  // Enquanto o resultado guardado não é desta chave (deps mudaram ou recarregar), a tela mostra "carregando".
  if (estado.chave !== chave) return { fase: "carregando", recarregar }
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
  ciclo_com_pendencias: "admin.cod.ciclo_com_pendencias",
  receita_com_estorno: "admin.cod.receita_com_estorno",
  receita_ja_usada: "admin.cod.receita_ja_usada",
  receita_invalida: "admin.cod.receita_invalida",
  consentimento_de_outra_pessoa: "admin.cod.consentimento_de_outra_pessoa",
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

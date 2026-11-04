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
  | { fase: "pronto"; dados: T; recarregar: () => void; recarregando?: boolean }

// Carrega ao montar e quando `deps` muda. Falha vira fase "erro" (a tela mostra o erro com "tentar de novo"), nunca lista vazia.
export function useCarga<T>(buscar: () => Promise<T>, deps: readonly unknown[]): Carga<T> {
  const [volta, setVolta] = useState(0)
  const depsKey = JSON.stringify(deps)
  const chave = `${depsKey}#${volta}`
  const [estado, setEstado] = useState<{ chave: string; depsKey: string; fase: "erro" } | { chave: string; depsKey: string; fase: "pronto"; dados: T }>({ chave: "", depsKey: "", fase: "erro" })
  const recarregar = useCallback(() => setVolta((n) => n + 1), [])
  useEffect(() => {
    let ativo = true
    buscar()
      .then((dados) => ativo && setEstado({ chave, depsKey, fase: "pronto", dados }))
      .catch(() => ativo && setEstado({ chave, depsKey, fase: "erro" }))
    return () => {
      ativo = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `chave` resume as deps; `buscar` é recriada a cada render
  }, [chave])
  if (estado.chave === chave) return { ...estado, recarregar } as Carga<T>
  // Só `recarregar` mudou (mesmas deps): mantém os dados na tela enquanto busca de novo, para não perder aviso de sucesso nem edição não salva.
  if (estado.fase === "pronto" && estado.depsKey === depsKey) return { fase: "pronto", dados: estado.dados, recarregar, recarregando: true }
  // Deps mudaram: tela de "carregando".
  return { fase: "carregando", recarregar }
}

export type AvisoAcao = { tipo: "ok" | "erro"; texto: string } | null

// Códigos que o banco levanta (raise exception) e que a equipe precisa entender sem abrir o log.
const CODIGOS: Record<string, Chave> = {
  ciclo_em_andamento: "admin.cod.ciclo_em_andamento",
  perfil_mudou: "admin.cod.perfil_mudou",
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
  estorno_maior_que_pagamento: "admin.cod.estorno_maior_que_pagamento",
  moeda_divergente: "admin.cod.moeda_divergente",
  receita_inexistente_ou_anulada: "admin.cod.receita_inexistente_ou_anulada",
  periodo_invalido: "admin.cod.periodo_invalido",
  plano_invalido: "admin.cod.plano_invalido",
  perfil_inexistente: "admin.cod.perfil_inexistente",
  assinatura_vigente_existente_ou_receita_ja_usada: "admin.cod.assinatura_vigente",
  assinatura_vigente_existente: "admin.cod.assinatura_vigente",
  campo_obrigatorio: "admin.erro.obrigatorio",
  cambio_existente: "admin.cod.cambio_existente",
  moeda_invalida: "admin.cod.moeda_invalida",
  vat_maior_que_bruto: "admin.cod.vat_maior_que_bruto",
  data_fora_do_ciclo: "admin.cod.data_fora_do_ciclo",
  plano_obrigatorio: "admin.cod.plano_obrigatorio",
  receita_obrigatoria: "admin.cod.receita_obrigatoria",
  membro_obrigatorio: "admin.cod.membro_obrigatorio",
  valor_maior_que_receita: "admin.cod.valor_maior_que_receita",
  meet_nao_configurado: "admin.cod.meet_nao_configurado",
  google: "admin.cod.meet_google",
  conta_existe: "admin.cod.conta_existe",
  papel: "admin.cod.convite_papel",
  entrada: "admin.cod.convite_entrada",
}

export function textoErro(e: unknown, t: (c: Chave) => string): string {
  const err = (e ?? {}) as { code?: string; message?: string }
  if (e instanceof SemLinha) return t("admin.erro.semLinha")
  // Função que o banco local/produção ainda não tem (migration por aplicar): erro visível, nunca silêncio.
  if (err.code === "PGRST202" || err.code === "42883") return t("admin.erro.funcaoAusente")
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

// Envia arquivo ao bucket e devolve o caminho. Nome aleatório (o original pode ter nome de pessoa, e o bucket
// `imagens` é público): só a extensão do arquivo é aproveitada.
export async function enviarArquivo(bucket: string, pasta: string, arquivo: File): Promise<string> {
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(arquivo.name)?.[0].toLowerCase() ?? ""
  const caminho = `${pasta}/${crypto.randomUUID()}${ext}`
  const r = await supabase.storage.from(bucket).upload(caminho, arquivo, { upsert: false })
  if (r.error) throw r.error
  return caminho
}

// Sempre como download: o arquivo de entrega vem do membro, com o tipo que ele declarou.
export async function abrirAssinado(bucket: string, caminho: string) {
  const r = await supabase.storage.from(bucket).createSignedUrl(caminho, 300, { download: true })
  if (r.error || !r.data) throw r.error ?? new SemLinha()
  window.open(r.data.signedUrl, "_blank", "noopener,noreferrer")
}

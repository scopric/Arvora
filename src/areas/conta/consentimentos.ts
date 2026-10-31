import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export type Documento = { id: number; tipo: string; idioma: string; versao: string; titulo: string }
export type Aceite = {
  id: number
  aceito_em: string
  revogado_em: string | null
  documentos_legais: { tipo: string; versao: string; titulo: string } | null
}
export type EstadoConsentimentos =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "pronto"; docs: Documento[]; aceites: Aceite[] }

// Textos vigentes (todos leem) e os aceites do próprio titular. O filtro por perfil_id é explícito: o super_admin
// também lê os consentimentos de todo mundo, e esta tela mostra só os dele.
export function useConsentimentos(uid: string | undefined) {
  const [estado, setEstado] = useState<EstadoConsentimentos>({ fase: "carregando" })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    if (!uid) return
    let ativo = true
    Promise.all([
      supabase.from("documentos_legais").select("id, tipo, idioma, versao, titulo").lte("vigente_desde", new Date().toISOString()).order("vigente_desde", { ascending: false }),
      supabase.from("consentimentos").select("id, aceito_em, revogado_em, documentos_legais(tipo, versao, titulo)").eq("perfil_id", uid).order("aceito_em", { ascending: false }),
    ]).then(
      ([d, c]) => {
        if (!ativo) return
        setEstado(d.error || c.error ? { fase: "erro" } : { fase: "pronto", docs: d.data, aceites: c.data })
      },
      () => ativo && setEstado({ fase: "erro" }),
    )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])
  return { estado, recarregar: () => setTentativa((n) => n + 1) }
}

// Texto vigente mais novo; prefere o idioma do membro, senão qualquer idioma (hoje os textos podem existir só em um).
export const documentoVigente = (docs: Documento[], tipo: string, idioma: string) =>
  docs.find((d) => d.tipo === tipo && d.idioma === idioma) ?? docs.find((d) => d.tipo === tipo)

export const aceitesAtivos = (aceites: Aceite[], tipo: string) =>
  aceites.filter((a) => a.revogado_em === null && a.documentos_legais?.tipo === tipo)

// Insert e update confirmam com .select('id'): sob RLS, resposta vazia é erro, não sucesso (Erros 2.5).
export async function conceder(uid: string, email: string, doc: Documento) {
  const { data, error } = await supabase
    .from("consentimentos")
    .insert({ documento_id: doc.id, perfil_id: uid, titular_email: email, evidencia: `interruptor nas configuracoes; versao ${doc.versao}` })
    .select("id")
  return !error && !!data && data.length === 1
}

export async function revogar(ids: number[]) {
  const { data, error } = await supabase.from("consentimentos").update({ revogado_em: new Date().toISOString() }).in("id", ids).select("id")
  return !error && !!data && data.length === ids.length
}

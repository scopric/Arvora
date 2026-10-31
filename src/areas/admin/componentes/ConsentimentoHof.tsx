import { useState } from "react"
import { Selo } from "../../../componentes/Selo"
import { useIdioma, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { exigir, exigirLinha, useAcao, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { SUPER, usePode } from "../lib/papel"
import { classeAcao } from "./Campos"
import { FormularioRegistro, type CampoDef } from "./FormularioRegistro"
import { AvisoDe, Mostrar } from "./Pagina"

// Consentimento do Hall of Fame (HOF-04): data e versão do documento ficam em `consentimentos`. Só o super_admin registra e revoga
// (RLS). Premiado/indicado só publica com consentimento vigente do PRÓPRIO titular: use o e-mail dele (o banco confere).
export function ConsentimentoHof({ id, emailInicial, nomeInicial, aoRegistrar, aoMudar }: {
  id: number | null
  emailInicial?: string
  nomeInicial?: string
  aoRegistrar: (id: number) => Promise<void>
  aoMudar: () => void
}) {
  const t = useT()
  const lang = useIdioma()
  const pode = usePode(SUPER)
  const acao = useAcao()
  const [versao, setVersao] = useState(0)
  const carga = useCarga(async () => {
    if (!pode) return null
    const docs = exigir(await supabase.from("documentos_legais").select("id, versao, idioma, vigente_desde").eq("tipo", "hall_of_fame").order("vigente_desde", { ascending: false }))
    let atual = null
    if (id !== null) {
      const r = await supabase.from("consentimentos").select("id, documento_id, titular_email, titular_nome, aceito_em, revogado_em").eq("id", id).maybeSingle()
      if (r.error) throw r.error
      atual = r.data
    }
    return { docs, atual }
  }, [pode, id, versao])

  if (!pode) return <p className="text-sm opacity-75">{id ? `${t("admin.consent.registrado")} #${id}` : t("admin.consent.soSuper")}</p>
  return (
    <Mostrar carga={carga}>
      {(d) => {
        if (!d) return null
        const campos: CampoDef[] = [
          { chave: "documento_id", rotulo: "admin.consent.documento", tipo: "selecao", obrigatorio: true, opcoes: d.docs.map((x) => ({ valor: String(x.id), texto: `v${x.versao} (${x.idioma})` })) },
          { chave: "titular_email", rotulo: "admin.comum.email", tipo: "email", obrigatorio: true, ajuda: "admin.consent.emailAjuda" },
          { chave: "titular_nome", rotulo: "admin.comum.nome", tipo: "texto" },
          { chave: "aceito_em", rotulo: "admin.consent.aceitoEm", tipo: "dataHora", obrigatorio: true },
          { chave: "evidencia", rotulo: "admin.consent.evidencia", tipo: "texto", ajuda: "admin.consent.evidenciaAjuda" },
        ]
        const doc = d.docs.find((x) => x.id === d.atual?.documento_id)
        return (
          <div className="space-y-4 rounded-2xl border border-current/15 p-5">
            <h3 className="text-lg font-semibold">{t("admin.consent.titulo")}</h3>
            {d.atual ? (
              <div className="space-y-2 text-sm">
                <p>
                  #{d.atual.id} · {d.atual.titular_email} · {t("admin.consent.aceitoEm")}: {dataHora(d.atual.aceito_em, lang)} · {t("admin.consent.versao")}: {doc ? `v${doc.versao}` : d.atual.documento_id}
                </p>
                {d.atual.revogado_em ? (
                  <Selo tom="alerta">{t("admin.consent.revogado")} {dataHora(d.atual.revogado_em, lang)}</Selo>
                ) : (
                  <>
                    <Selo tom="destaque">{t("admin.consent.vigente")}</Selo>{" "}
                    <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => void acao.rodar(async () => { exigirLinha(await supabase.from("consentimentos").update({ revogado_em: new Date().toISOString() }).eq("id", d.atual!.id).select("id")); setVersao((v) => v + 1); aoMudar() }, "admin.consent.revogou")}>{t("admin.consent.revogar")}</button>
                  </>
                )}
                <AvisoDe aviso={acao.aviso} />
              </div>
            ) : null}
            {d.docs.length === 0 ? (
              <p className="text-sm">{t("admin.consent.semDocumento")}</p>
            ) : (
              <>
                <h4 className="font-semibold">{d.atual ? t("admin.consent.novoRegistro") : t("admin.consent.registrar")}</h4>
                <FormularioRegistro
                  campos={campos} linha={{ titular_email: emailInicial ?? "", titular_nome: nomeInicial ?? "", documento_id: d.docs[0]?.id }}
                  aoSalvar={async (c) => {
                    const r = await supabase.from("consentimentos").insert(c as never).select("id")
                    exigirLinha(r)
                    await aoRegistrar(r.data![0].id)
                    setVersao((v) => v + 1)
                  }}
                />
              </>
            )}
          </div>
        )
      }}
    </Mostrar>
  )
}
